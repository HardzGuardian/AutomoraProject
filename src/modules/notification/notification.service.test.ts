/**
 * De-duplication tests exercise the REAL persistence path: the mocked
 * NotificationLog store enforces the same compound unique constraint as
 * `prisma/schema.prisma` (@@unique([eventKey, channel, recipient])), so a
 * regression back to `create` fails these tests exactly as it would in
 * production.
 */
jest.mock('../../config/db', () => {
  const store: Array<Record<string, unknown>> = [];

  const matches = (row: Record<string, unknown>, where: Record<string, any>) => {
    if (where.eventKey !== undefined && row.eventKey !== where.eventKey) {
      return false;
    }
    if (where.channel !== undefined && row.channel !== where.channel) {
      return false;
    }
    if (where.recipient !== undefined && row.recipient !== where.recipient) {
      return false;
    }
    if (where.status?.in && !where.status.in.includes(row.status)) {
      return false;
    }
    return true;
  };

  return {
    __esModule: true,
    default: {
      notificationLog: {
        findFirst: jest.fn(async ({ where }: Record<string, any>) => {
          return store.find((row) => matches(row, where)) ?? null;
        }),
        create: jest.fn(async ({ data }: Record<string, any>) => {
          const duplicate = store.some(
            (row) =>
              row.eventKey === data.eventKey &&
              row.channel === data.channel &&
              row.recipient === data.recipient
          );
          if (duplicate) {
            const error = new Error(
              'Unique constraint failed on the fields: (`eventKey`,`channel`,`recipient`)'
            ) as Error & { code: string };
            error.code = 'P2002';
            throw error;
          }
          store.push({ ...data });
          return data;
        }),
        upsert: jest.fn(
          async ({
            where,
            create,
            update,
          }: Record<string, any>) => {
            const key = where.eventKey_channel_recipient;
            const existing = store.find(
              (row) =>
                row.eventKey === key.eventKey &&
                row.channel === key.channel &&
                row.recipient === key.recipient
            );
            if (existing) {
              Object.assign(existing, update);
              return existing;
            }
            store.push({ ...create });
            return create;
          }
        ),
      },
    },
    __store: store,
    __reset: () => {
      store.length = 0;
    },
  };
});

jest.mock('../audit/audit.service', () => ({
  auditService: {
    log: jest.fn().mockResolvedValue(undefined),
    logSimple: jest.fn().mockResolvedValue(undefined),
  },
}));

import prisma from '../../config/db';
import { NotificationService } from './notification.service';
import { NotificationProvider } from './providers/notification.provider';
import { SlaBreachNotification } from './slaBreach.types';

const db = prisma as unknown as {
  notificationLog: {
    findFirst: jest.Mock;
    create: jest.Mock;
    upsert: jest.Mock;
  };
};
const { __reset, __store } = require('../../config/db');

function sentProvider(channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' = 'EMAIL') {
  return {
    channel,
    name: `test-${channel.toLowerCase()}`,
    send: jest.fn().mockResolvedValue({ status: 'SENT', provider: `test-${channel.toLowerCase()}` }),
  } as NotificationProvider;
}

function failingProvider(): NotificationProvider {
  return {
    channel: 'EMAIL',
    name: 'failing-email',
    send: jest.fn().mockRejectedValue(new Error('provider unavailable')),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  __reset();
});

describe('NotificationService de-duplication', () => {
  it('dispatches only once for a repeated event key, channel, and recipient', async () => {
    const provider = sentProvider();
    const service = new NotificationService({ EMAIL: provider });

    const first = await service.send({
      eventKey: 'invoice-issued:invoice-1',
      channel: 'EMAIL',
      recipient: 'client@example.com',
      message: 'Invoice INV-1 is due',
    });
    const second = await service.send({
      eventKey: 'invoice-issued:invoice-1',
      channel: 'EMAIL',
      recipient: 'client@example.com',
      message: 'Invoice INV-1 is due',
    });

    expect(first.status).toBe('SENT');
    expect(second.status).toBe('SKIPPED');
    expect(second.duplicate).toBe(true);
    expect(provider.send).toHaveBeenCalledTimes(1);
    expect(__store).toHaveLength(1);
  });

  it('persists a retry outcome instead of colliding with the unique constraint', async () => {
    const failing = failingProvider();
    const service = new NotificationService({ EMAIL: failing });

    const failed = await service.send({
      eventKey: 'payment-reminder:invoice-9:overdue',
      channel: 'EMAIL',
      recipient: 'client@example.com',
      message: 'Payment due',
    });

    expect(failed.status).toBe('FAILED');
    expect(__store).toHaveLength(1);
    expect(__store[0].status).toBe('FAILED');

    // Retry with a provider that succeeds.
    const recovering = sentProvider();
    const retryService = new NotificationService({ EMAIL: recovering });
    const retried = await retryService.send({
      eventKey: 'payment-reminder:invoice-9:overdue',
      channel: 'EMAIL',
      recipient: 'client@example.com',
      message: 'Payment due',
    });

    expect(recovering.send).toHaveBeenCalledTimes(1);
    expect(retried.status).toBe('SENT');
    // Still one row: the retry updated the existing de-duplication key.
    expect(__store).toHaveLength(1);
    expect(__store[0].status).toBe('SENT');
  });

  it('uses upsert rather than create so a retry never violates the unique key', async () => {
    const service = new NotificationService({ EMAIL: failingProvider() });

    await service.send({
      eventKey: 'event-upsert-check',
      channel: 'EMAIL',
      recipient: 'client@example.com',
      message: 'first',
    });
    await service.send({
      eventKey: 'event-upsert-check',
      channel: 'EMAIL',
      recipient: 'client@example.com',
      message: 'retry',
    });

    expect(db.notificationLog.upsert).toHaveBeenCalledTimes(2);
    expect(db.notificationLog.create).not.toHaveBeenCalled();
  });

  it('treats SKIPPED as already handled and FAILED as retryable', async () => {
    const service = new NotificationService({ EMAIL: sentProvider() });

    await service.send({
      eventKey: 'event-status-check',
      channel: 'EMAIL',
      recipient: 'client@example.com',
      message: 'hello',
    });
    __store[0].status = 'SKIPPED';

    const afterSkipped = await service.send({
      eventKey: 'event-status-check',
      channel: 'EMAIL',
      recipient: 'client@example.com',
      message: 'hello',
    });
    expect(afterSkipped.duplicate).toBe(true);

    __store[0].status = 'FAILED';
    const afterFailed = await service.send({
      eventKey: 'event-status-check',
      channel: 'EMAIL',
      recipient: 'client@example.com',
      message: 'hello',
    });
    expect(afterFailed.duplicate).toBeUndefined();
  });

  it('treats the channel as part of the de-duplication key', async () => {
    const email = sentProvider('EMAIL');
    const sms = sentProvider('SMS');
    const service = new NotificationService({ EMAIL: email, SMS: sms });

    await service.send({
      eventKey: 'multi-channel-event',
      channel: 'EMAIL',
      recipient: 'client@example.com',
      message: 'hello',
    });
    await service.send({
      eventKey: 'multi-channel-event',
      channel: 'SMS',
      recipient: '+919999999999',
      message: 'hello',
    });

    expect(email.send).toHaveBeenCalledTimes(1);
    expect(sms.send).toHaveBeenCalledTimes(1);
    expect(__store).toHaveLength(2);
  });
});

describe('NotificationService providers', () => {
  it('delivers an IN_APP notification now that a provider is registered', async () => {
    const service = new NotificationService({ IN_APP: sentProvider('IN_APP') });

    const result = await service.send({
      eventKey: 'in-app-event',
      channel: 'IN_APP',
      recipient: 'user-1',
      message: 'You have a new update',
    });

    expect(result.status).toBe('SENT');
  });

  it('reports a failure for a channel with no provider', async () => {
    const service = new NotificationService({ EMAIL: sentProvider() });

    const result = await service.send({
      eventKey: 'no-provider-event',
      channel: 'WHATSAPP',
      recipient: '+919999999999',
      message: 'hello',
    });

    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('No provider configured');
  });

  it('records a missing recipient as skipped instead of throwing', async () => {
    const provider = sentProvider();
    const service = new NotificationService({ EMAIL: provider });

    const result = await service.send({
      eventKey: 'missing-recipient',
      channel: 'EMAIL',
      recipient: '',
      message: 'hello',
    });

    expect(result.status).toBe('SKIPPED');
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('returns a failed result when a provider throws', async () => {
    const service = new NotificationService({ EMAIL: failingProvider() });

    const result = await service.send({
      eventKey: 'provider-failure:1',
      channel: 'EMAIL',
      recipient: 'client@example.com',
      message: 'Test',
    });

    expect(result.status).toBe('FAILED');
    expect(result.error).toBe('provider unavailable');
  });
});

describe('NotificationService payment reminders', () => {
  it('fans out to the available channels and tallies the outcome', async () => {
    const email = sentProvider('EMAIL');
    const sms = sentProvider('SMS');
    const service = new NotificationService({ EMAIL: email, SMS: sms });

    const result = await service.sendPaymentReminder({
      invoiceId: 'invoice-1',
      invoiceNumber: 'INV-1',
      email: 'client@example.com',
      phone: '+919999999999',
      amount: '100',
      dueDate: '2026-01-01',
      channels: ['EMAIL', 'SMS'],
    });

    expect(result.attempted).toBe(2);
    expect(result.sent).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(sms.send).toHaveBeenCalledTimes(1);
  });

  it('records a skipped reminder when no recipient is available', async () => {
    const service = new NotificationService({ EMAIL: sentProvider() });

    const result = await service.sendPaymentReminder({
      invoiceId: 'invoice-1',
      invoiceNumber: 'INV-1',
      amount: '100',
      dueDate: '2026-01-01',
    });

    expect(result.attempted).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
  });
});

describe('NotificationService contract compatibility', () => {
  it('preserves the Person 2 renewal reminder contract exactly', async () => {
    const emailProvider = sentProvider();
    const service = new NotificationService({ EMAIL: emailProvider });

    await service.sendRenewalReminder({
      contractId: 'contract-1',
      contractNumber: 'AMC-1',
      clientName: 'Client',
      clientEmail: 'client@example.com',
      endDate: new Date('2026-12-31'),
      reminderType: '30_DAY',
      daysUntilExpiry: 30,
    });

    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'renewal-reminder:contract-1:30_DAY',
        channel: 'EMAIL',
        recipient: 'client@example.com',
        relatedId: 'contract-1',
        metadata: expect.objectContaining({
          contractId: 'contract-1',
          contractNumber: 'AMC-1',
          reminderType: '30_DAY',
          daysUntilExpiry: 30,
        }),
      })
    );
  });

  it('de-duplicates repeated renewal reminders for the same reminder type', async () => {
    const emailProvider = sentProvider();
    const service = new NotificationService({ EMAIL: emailProvider });
    const params = {
      contractId: 'contract-1',
      contractNumber: 'AMC-1',
      clientName: 'Client',
      clientEmail: 'client@example.com',
      endDate: new Date('2026-12-31'),
      reminderType: '30_DAY',
      daysUntilExpiry: 30,
    };

    await service.sendRenewalReminder(params);
    await service.sendRenewalReminder(params);

    expect(emailProvider.send).toHaveBeenCalledTimes(1);
  });
});

describe('NotificationService.sendSlaBreach', () => {
  function technicianPort(email: string | null) {
    return {
      getById: jest.fn(),
      getEmailFor: jest.fn().mockResolvedValue(email),
    };
  }

  const breach: SlaBreachNotification = {
    ticketId: 'ticket-1',
    assignedTechnicianId: 'tech-1',
    resolutionDeadline: new Date('2026-05-01T10:00:00Z'),
    escalatedAt: new Date('2026-05-01T10:00:01Z'),
  };

  it('resolves the technician and derives a stable de-duplication key', async () => {
    const provider = sentProvider();
    const technicians = technicianPort('tech@example.com');
    const service = new NotificationService({ EMAIL: provider }, technicians as never);

    await service.sendSlaBreach(breach);

    expect(technicians.getEmailFor).toHaveBeenCalledWith('tech-1');
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'sla-breach:ticket-1',
        channel: 'EMAIL',
        recipient: 'tech@example.com',
        relatedId: 'ticket-1',
        metadata: expect.objectContaining({
          ticketId: 'ticket-1',
          assignedTechnicianId: 'tech-1',
        }),
      })
    );
  });

  it('resolves to void, matching the Person 3 gateway contract', async () => {
    const service = new NotificationService(
      { EMAIL: sentProvider() },
      technicianPort('tech@example.com') as never
    );

    await expect(service.sendSlaBreach(breach)).resolves.toBeUndefined();
  });

  it('skips without throwing when the technician has no email', async () => {
    const provider = sentProvider();
    const service = new NotificationService(
      { EMAIL: provider },
      technicianPort(null) as never
    );

    await expect(service.sendSlaBreach(breach)).resolves.toBeUndefined();
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('de-duplicates repeated escalations of the same ticket', async () => {
    const provider = sentProvider();
    const service = new NotificationService(
      { EMAIL: provider },
      technicianPort('tech@example.com') as never
    );

    await service.sendSlaBreach(breach);
    await service.sendSlaBreach(breach);

    expect(provider.send).toHaveBeenCalledTimes(1);
  });
});
