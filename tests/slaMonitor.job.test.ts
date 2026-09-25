jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../src/modules/audit/audit.service', () => ({
  auditService: {
    logSimple: jest.fn().mockResolvedValue(undefined),
  },
}));

import {
  EscalatedTicket,
  SlaEscalationService,
  SlaMonitorJob,
  SlaNotificationGateway,
} from '../src/jobs/slaMonitor.job';
import { Ticket } from '../src/modules/ticket/ticket.service';

const now = new Date('2026-01-02T12:00:00.000Z');

const ticket: Ticket = {
  id: '550e8400-e29b-41d4-a716-446655440120',
  title: 'Refrigerator not cooling',
  description: 'The unit is not reaching the configured temperature.',
  status: 'ASSIGNED',
  assignedTechnicianId: '550e8400-e29b-41d4-a716-446655440110',
  contractId: '550e8400-e29b-41d4-a716-446655440001',
  assetId: null,
  createdById: '550e8400-e29b-41d4-a716-446655440112',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: now,
  resolvedAt: null,
  slaResponseDeadline: null,
  slaResolutionDeadline: new Date('2026-01-02T00:00:00.000Z'),
  slaBreachedAt: now,
  escalatedAt: now,
};

const escalated: EscalatedTicket = {
  ticket,
  resolutionDeadline: new Date('2026-01-02T00:00:00.000Z'),
  escalatedAt: now,
};

describe('SlaMonitorJob', () => {
  let slaService: SlaEscalationService;
  let notifications: SlaNotificationGateway;
  let job: SlaMonitorJob;

  beforeEach(() => {
    slaService = {
      escalateBreachedTickets: jest.fn().mockResolvedValue([escalated]),
    };
    notifications = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    job = new SlaMonitorJob(slaService, notifications, () => now);
  });

  it('escalates breached tickets and sends one notification per new escalation', async () => {
    const result = await job.run();

    expect(slaService.escalateBreachedTickets).toHaveBeenCalledWith(now);
    expect(notifications.send).toHaveBeenCalledWith({
      ticketId: ticket.id,
      assignedTechnicianId: ticket.assignedTechnicianId,
      resolutionDeadline: escalated.resolutionDeadline,
      escalatedAt: now,
    });
    expect(result).toEqual({
      escalated: 1,
      notificationsSent: 1,
      errors: 0,
    });
  });

  it('does not send duplicate notifications when no new escalation is returned', async () => {
    jest.mocked(slaService.escalateBreachedTickets).mockResolvedValueOnce([
      escalated,
    ]);
    jest.mocked(slaService.escalateBreachedTickets).mockResolvedValueOnce([]);

    await job.run();
    const second = await job.run();

    expect(second).toEqual({
      escalated: 0,
      notificationsSent: 0,
      errors: 0,
    });
    expect(notifications.send).toHaveBeenCalledTimes(1);
  });

  it('records notification errors without losing the escalation result', async () => {
    jest.mocked(notifications.send).mockRejectedValue(new Error('provider unavailable'));

    const result = await job.run();

    expect(result).toEqual({
      escalated: 1,
      notificationsSent: 0,
      errors: 1,
    });
  });

  it('skips overlapping runs', async () => {
    let release: (() => void) | undefined;
    jest
      .mocked(slaService.escalateBreachedTickets)
      .mockReturnValueOnce(
        new Promise<EscalatedTicket[]>((resolve) => {
          release = () => resolve([]);
        })
      );

    const firstRun = job.run();
    await Promise.resolve();
    const overlappingRun = await job.run();

    expect(overlappingRun).toEqual({
      escalated: 0,
      notificationsSent: 0,
      errors: 0,
    });
    release?.();
    await firstRun;
    expect(slaService.escalateBreachedTickets).toHaveBeenCalledTimes(1);
  });
});
