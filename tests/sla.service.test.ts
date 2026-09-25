jest.mock('../src/modules/audit/audit.service', () => ({
  auditService: {
    logSimple: jest.fn().mockResolvedValue(undefined),
  },
}));

import {
  SlaAuditGateway,
  SlaBreachCandidate,
  SlaRepository,
  SlaService,
} from '../src/modules/sla/sla.service';
import { Ticket } from '../src/modules/ticket/ticket.service';

const ticketId = '550e8400-e29b-41d4-a716-446655440120';
const now = new Date('2026-01-02T12:00:00.000Z');

const createTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: ticketId,
  title: 'Refrigerator not cooling',
  description: 'The unit is not reaching the configured temperature.',
  status: 'ASSIGNED',
  assignedTechnicianId: '550e8400-e29b-41d4-a716-446655440110',
  contractId: '550e8400-e29b-41d4-a716-446655440001',
  assetId: null,
  createdById: '550e8400-e29b-41d4-a716-446655440112',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  resolvedAt: null,
  slaResponseDeadline: new Date('2026-01-01T04:00:00.000Z'),
  slaResolutionDeadline: new Date('2026-01-02T00:00:00.000Z'),
  slaBreachedAt: null,
  escalatedAt: null,
  ...overrides,
});

const candidate = (
  ticket: Ticket,
  resolutionDeadline = new Date('2026-01-02T00:00:00.000Z')
): SlaBreachCandidate => ({ ticket, resolutionDeadline });

describe('SlaService', () => {
  let repository: SlaRepository;
  let audit: SlaAuditGateway;
  let service: SlaService;

  beforeEach(() => {
    repository = {
      findBreachCandidates: jest.fn().mockResolvedValue([]),
      flagBreach: jest.fn().mockImplementation(async (input) =>
        createTicket({ slaBreachedAt: input.flaggedAt })
      ),
      escalateBreach: jest.fn().mockImplementation(async (input) =>
        createTicket({
          slaBreachedAt: input.flaggedAt,
          escalatedAt: input.escalatedAt,
        })
      ),
    };
    audit = {
      logSimple: jest.fn().mockResolvedValue(undefined),
    };
    service = new SlaService(repository, audit, () => now);
  });

  it('calculates an SLA deadline from a start time and hours', () => {
    const result = service.calculateDeadline(
      new Date('2026-01-01T00:00:00.000Z'),
      4
    );

    expect(result.toISOString()).toBe('2026-01-01T04:00:00.000Z');
  });

  it('calculates response and resolution deadlines from ContractSLA fields', () => {
    const openedAt = new Date('2026-01-01T00:00:00.000Z');

    expect(
      service.calculateResponseDeadline(openedAt, {
        responseTimeHours: 2,
        resolutionTimeHours: 8,
      })
    ).toEqual(new Date('2026-01-01T02:00:00.000Z'));
    expect(
      service.calculateResolutionDeadline(openedAt, {
        responseTimeHours: 2,
        resolutionTimeHours: 8,
      })
    ).toEqual(new Date('2026-01-01T08:00:00.000Z'));
  });

  it('does not report a non-breached ticket', async () => {
    jest.mocked(repository.findBreachCandidates).mockResolvedValue([
      candidate(createTicket(), new Date('2026-01-02T12:00:00.001Z')),
    ]);

    await expect(service.findBreaches(now)).resolves.toEqual([]);
  });

  it('reports a ticket whose resolution deadline has passed', async () => {
    const ticket = createTicket();
    jest
      .mocked(repository.findBreachCandidates)
      .mockResolvedValue([candidate(ticket)]);

    await expect(service.findBreaches(now)).resolves.toEqual([
      candidate(ticket),
    ]);
  });

  it('does not report resolved tickets even when their deadline passed', async () => {
    jest.mocked(repository.findBreachCandidates).mockResolvedValue([
      candidate(createTicket({ status: 'RESOLVED' })),
    ]);

    await expect(service.findBreaches(now)).resolves.toEqual([]);
  });

  it('flags and escalates a newly breached ticket', async () => {
    jest.mocked(repository.findBreachCandidates).mockResolvedValue([
      candidate(createTicket()),
    ]);

    const result = await service.escalateBreachedTickets(now);

    expect(result).toHaveLength(1);
    expect(repository.flagBreach).toHaveBeenCalledWith({
      ticketId,
      resolutionDeadline: new Date('2026-01-02T00:00:00.000Z'),
      flaggedAt: now,
    });
    expect(repository.escalateBreach).toHaveBeenCalledWith({
      ticketId,
      flaggedAt: now,
      escalatedAt: now,
    });
    expect(audit.logSimple).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SLA_BREACH_FLAGGED' })
    );
    expect(audit.logSimple).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SLA_BREACH_ESCALATED' })
    );
  });

  it('does not escalate a ticket that is already escalated', async () => {
    jest.mocked(repository.findBreachCandidates).mockResolvedValue([
      candidate(createTicket({ slaBreachedAt: now, escalatedAt: now })),
    ]);

    await expect(service.escalateBreachedTickets(now)).resolves.toEqual([]);
    expect(repository.flagBreach).not.toHaveBeenCalled();
    expect(repository.escalateBreach).not.toHaveBeenCalled();
  });

  it('skips escalation when another monitor wins the flag race', async () => {
    jest.mocked(repository.findBreachCandidates).mockResolvedValue([
      candidate(createTicket()),
    ]);
    jest.mocked(repository.flagBreach).mockResolvedValue(null);

    await expect(service.escalateBreachedTickets(now)).resolves.toEqual([]);
    expect(repository.escalateBreach).not.toHaveBeenCalled();
  });

  it('rejects invalid SLA policy values', () => {
    expect(() =>
      service.calculateResolutionDeadline(new Date(), {
        responseTimeHours: 1,
        resolutionTimeHours: 0,
      })
    ).toThrow('SLA response and resolution hours must be positive');
  });
});
