// Pins the payload the contract module's renewal reminder job sends to
// sendRenewalReminder(). If this shape changes, that job breaks silently.
import { NotificationService } from '../modules/notification/notification.service';
import { NotificationProvider } from '../modules/notification/providers/notification.provider';
import { RenewalReminderInput } from '../modules/notification/notification.types';

jest.mock('../modules/audit/audit.service', () => ({
  auditService: {
    log: jest.fn().mockResolvedValue(undefined),
    logSimple: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../config/db', () => ({
  __esModule: true,
  default: {
    notificationLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({}),
    },
  },
}));

const RENEWAL_REMINDER_FIELDS = [
  'contractId',
  'contractNumber',
  'clientName',
  'clientEmail',
  'endDate',
  'reminderType',
  'daysUntilExpiry',
] as const;

function emailProvider(): NotificationProvider {
  return {
    channel: 'EMAIL',
    name: 'test-email',
    send: jest.fn().mockResolvedValue({ status: 'SENT', provider: 'test-email' }),
  };
}

describe('renewal reminder job compatibility', () => {
  const params: RenewalReminderInput = {
    contractId: 'contract-1',
    contractNumber: 'AMC-1',
    clientName: 'Client',
    clientEmail: 'client@example.com',
    endDate: new Date('2026-12-31T00:00:00Z'),
    reminderType: '30_DAY',
    daysUntilExpiry: 30,
  };

  it('accepts exactly the seven fields the renewal job sends', () => {
    expect(Object.keys(params).sort()).toEqual([...RENEWAL_REMINDER_FIELDS].sort());
  });

  it('types endDate as a Date and reminderType as a string', () => {
    expect(params.endDate).toBeInstanceOf(Date);
    expect(typeof params.reminderType).toBe('string');
    expect(typeof params.daysUntilExpiry).toBe('number');
  });

  it('maps the contract fields onto the outgoing notification', async () => {
    const provider = emailProvider();
    const service = new NotificationService({ EMAIL: provider });

    await service.sendRenewalReminder(params);

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'renewal-reminder:contract-1:30_DAY',
        channel: 'EMAIL',
        recipient: 'client@example.com',
        relatedId: 'contract-1',
        subject: 'Contract renewal reminder: AMC-1',
        message: expect.stringContaining('AMC-1'),
        metadata: {
          contractId: 'contract-1',
          contractNumber: 'AMC-1',
          reminderType: '30_DAY',
          daysUntilExpiry: 30,
        },
      })
    );
  });

  it('derives one de-duplication key per contract and reminder type', async () => {
    const provider = emailProvider();
    const service = new NotificationService({ EMAIL: provider });

    await service.sendRenewalReminder({ ...params, reminderType: '30_DAY' });
    await service.sendRenewalReminder({ ...params, reminderType: '60_DAY' });

    const keys = (provider.send as jest.Mock).mock.calls.map(
      (call: [{ eventKey: string }]) => call[0].eventKey
    );
    expect(keys).toEqual([
      'renewal-reminder:contract-1:30_DAY',
      'renewal-reminder:contract-1:60_DAY',
    ]);
  });

  it('does not throw when the client has no email on file', async () => {
    const provider = emailProvider();
    const service = new NotificationService({ EMAIL: provider });

    await expect(
      service.sendRenewalReminder({ ...params, clientEmail: '' })
    ).resolves.toBeUndefined();
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('keeps sendRenewalReminder returning void, not a result object', async () => {
    const service = new NotificationService({ EMAIL: emailProvider() });
    await expect(service.sendRenewalReminder(params)).resolves.toBeUndefined();
  });
});
