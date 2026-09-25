jest.mock('../src/modules/audit/audit.service', () => ({
  auditService: {
    logSimple: jest.fn().mockResolvedValue(undefined),
  },
}));

import {
  Ticket,
  TicketActor,
  TicketAuditGateway,
  TicketRepository,
  TicketService,
} from '../src/modules/ticket/ticket.service';
import { CreateTicketInput } from '../src/modules/ticket/ticket.validator';

const technicianId = '550e8400-e29b-41d4-a716-446655440110';
const otherTechnicianId = '550e8400-e29b-41d4-a716-446655440111';
const managerId = '550e8400-e29b-41d4-a716-446655440112';
const ticketId = '550e8400-e29b-41d4-a716-446655440120';

const technician: TicketActor = { id: technicianId, role: 'TECHNICIAN' };
const otherTechnician: TicketActor = {
  id: otherTechnicianId,
  role: 'TECHNICIAN',
};
const manager: TicketActor = { id: managerId, role: 'MANAGER' };

const createTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: ticketId,
  title: 'Refrigerator not cooling',
  description: 'The unit is not reaching the configured temperature.',
  status: 'ASSIGNED',
  assignedTechnicianId: technicianId,
  contractId: '550e8400-e29b-41d4-a716-446655440001',
  assetId: null,
  createdById: managerId,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  resolvedAt: null,
  slaResponseDeadline: null,
  slaResolutionDeadline: new Date('2026-01-02T00:00:00.000Z'),
  slaBreachedAt: null,
  escalatedAt: null,
  ...overrides,
});

const createInput: CreateTicketInput = {
  title: 'Refrigerator not cooling',
  description: 'The unit is not reaching the configured temperature.',
  assignedTechnicianId: technicianId,
  contractId: '550e8400-e29b-41d4-a716-446655440001',
};

describe('TicketService', () => {
  let repository: TicketRepository;
  let audit: TicketAuditGateway;
  let service: TicketService;
  const now = new Date('2026-01-01T09:00:00.000Z');

  beforeEach(() => {
    repository = {
      list: jest.fn().mockResolvedValue({
        tickets: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      }),
      findById: jest.fn().mockResolvedValue(createTicket()),
      isActiveTechnician: jest.fn().mockResolvedValue(true),
      create: jest.fn().mockImplementation(async (input) =>
        createTicket({
          title: input.title,
          description: input.description,
          assignedTechnicianId: input.assignedTechnicianId,
          contractId: input.contractId ?? null,
          assetId: input.assetId ?? null,
          createdById: input.createdById,
          createdAt: input.createdAt,
        })
      ),
      assignTechnician: jest.fn().mockImplementation(async (input) =>
        createTicket({
          assignedTechnicianId: input.technicianId,
          updatedAt: input.assignedAt,
        })
      ),
      updateStatus: jest.fn().mockImplementation(async (input) =>
        createTicket({
          status: input.status,
          updatedAt: input.changedAt,
          resolvedAt: input.status === 'RESOLVED' ? input.changedAt : null,
        })
      ),
    };
    audit = {
      logSimple: jest.fn().mockResolvedValue(undefined),
    };
    service = new TicketService(repository, audit, () => now);
  });

  it('creates a ticket in ASSIGNED state with an active technician', async () => {
    const result = await service.create(createInput, manager);

    expect(result.status).toBe('ASSIGNED');
    expect(result.assignedTechnicianId).toBe(technicianId);
    expect(repository.isActiveTechnician).toHaveBeenCalledWith(technicianId);
    expect(audit.logSimple).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TICKET_CREATED' })
    );
  });

  it('rejects creation when the assigned user is not an active technician', async () => {
    jest.mocked(repository.isActiveTechnician).mockResolvedValue(false);

    await expect(service.create(createInput, manager)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Assigned technician must be an active technician',
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('scopes ticket lists for technicians', async () => {
    await service.list(
      { page: 1, limit: 10, assignedTechnicianId: otherTechnicianId },
      technician
    );

    expect(repository.list).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      assignedTechnicianId: technicianId,
    });
  });

  it('allows an assigned technician to move ASSIGNED to IN_PROGRESS', async () => {
    const result = await service.updateStatus(
      ticketId,
      { status: 'IN_PROGRESS' },
      technician
    );

    expect(result.status).toBe('IN_PROGRESS');
    expect(repository.updateStatus).toHaveBeenCalledWith({
      ticketId,
      expectedStatus: 'ASSIGNED',
      status: 'IN_PROGRESS',
      changedAt: now,
    });
  });

  it('allows an assigned technician to move IN_PROGRESS to RESOLVED', async () => {
    jest.mocked(repository.findById).mockResolvedValue(
      createTicket({ status: 'IN_PROGRESS' })
    );

    const result = await service.updateStatus(
      ticketId,
      { status: 'RESOLVED' },
      technician
    );

    expect(result.status).toBe('RESOLVED');
    expect(result.resolvedAt).toEqual(now);
  });

  it('rejects invalid ticket transitions with HTTP 409', async () => {
    await expect(
      service.updateStatus(ticketId, { status: 'RESOLVED' }, technician)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Invalid ticket state transition: ASSIGNED -> RESOLVED',
    });
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('prevents an unassigned technician from updating a ticket', async () => {
    await expect(
      service.updateStatus(ticketId, { status: 'IN_PROGRESS' }, otherTechnician)
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Technicians can only access their assigned tickets',
    });
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('prevents a manager from bypassing the assigned-technician rule', async () => {
    await expect(
      service.updateStatus(ticketId, { status: 'IN_PROGRESS' }, manager)
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Only the assigned technician can update this ticket',
    });
  });

  it('allows a manager to reassign an ASSIGNED ticket', async () => {
    const result = await service.assignTechnician(
      ticketId,
      { technicianId: otherTechnicianId },
      manager
    );

    expect(result.assignedTechnicianId).toBe(otherTechnicianId);
    expect(audit.logSimple).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TICKET_ASSIGNED' })
    );
  });

  it('does not allow assignment after work has started', async () => {
    jest.mocked(repository.findById).mockResolvedValue(
      createTicket({ status: 'IN_PROGRESS' })
    );

    await expect(
      service.assignTechnician(
        ticketId,
        { technicianId: otherTechnicianId },
        manager
      )
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repository.assignTechnician).not.toHaveBeenCalled();
  });
});
