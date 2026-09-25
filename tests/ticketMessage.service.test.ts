jest.mock('../src/modules/audit/audit.service', () => ({
  auditService: {
    logSimple: jest.fn().mockResolvedValue(undefined),
  },
}));

import { ApiError } from '../src/utils/ApiError';
import { Ticket, TicketActor } from '../src/modules/ticket/ticket.service';
import {
  TicketMessage,
  TicketMessageAuditGateway,
  TicketMessageRepository,
  TicketMessageService,
  TicketReader,
} from '../src/modules/ticket/ticketMessage.service';
import { ListTicketMessagesQuery } from '../src/modules/ticket/ticket.validator';

const technicianId = '550e8400-e29b-41d4-a716-446655440110';
const otherTechnicianId = '550e8400-e29b-41d4-a716-446655440111';
const managerId = '550e8400-e29b-41d4-a716-446655440112';
const ticketId = '550e8400-e29b-41d4-a716-446655440120';
const now = new Date('2026-01-01T09:00:00.000Z');

const technician: TicketActor = { id: technicianId, role: 'TECHNICIAN' };
const otherTechnician: TicketActor = {
  id: otherTechnicianId,
  role: 'TECHNICIAN',
};
const manager: TicketActor = { id: managerId, role: 'MANAGER' };

const ticket: Ticket = {
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
};

const message: TicketMessage = {
  id: '550e8400-e29b-41d4-a716-446655440121',
  ticketId,
  authorId: technicianId,
  message: 'I will inspect the unit this afternoon.',
  createdAt: now,
};

const listQuery: ListTicketMessagesQuery = { page: 1, limit: 20 };

describe('TicketMessageService', () => {
  let reader: TicketReader;
  let repository: TicketMessageRepository;
  let audit: TicketMessageAuditGateway;
  let service: TicketMessageService;

  beforeEach(() => {
    reader = {
      getById: jest.fn().mockImplementation(
        async (_id: string, actor: TicketActor): Promise<Ticket> => {
          if (actor.role === 'TECHNICIAN' && actor.id !== technicianId) {
            throw ApiError.forbidden(
              'Technicians can only access their assigned tickets'
            );
          }
          return ticket;
        }
      ),
    };
    repository = {
      create: jest.fn().mockImplementation(
        async (input): Promise<TicketMessage> => ({
          id: message.id,
          ticketId: input.ticketId,
          authorId: input.authorId,
          message: input.message,
          createdAt: input.createdAt,
        })
      ),
      list: jest.fn().mockResolvedValue({
        messages: [message],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      }),
    };
    audit = {
      logSimple: jest.fn().mockResolvedValue(undefined),
    };
    service = new TicketMessageService(reader, repository, audit, () => now);
  });

  it('allows an assigned technician to create a ticket message', async () => {
    const result = await service.addMessage(
      ticketId,
      { message: '  I will inspect the unit this afternoon.  ' },
      technician
    );

    expect(result.message).toBe('I will inspect the unit this afternoon.');
    expect(repository.create).toHaveBeenCalledWith({
      ticketId,
      authorId: technicianId,
      message: 'I will inspect the unit this afternoon.',
      createdAt: now,
    });
    expect(audit.logSimple).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TICKET_MESSAGE_ADDED' })
    );
  });

  it('rejects message creation by an unassigned technician', async () => {
    await expect(
      service.addMessage(ticketId, { message: 'Unauthorized update' }, otherTechnician)
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('allows a manager to list messages', async () => {
    const result = await service.listMessages(ticketId, listQuery, manager);

    expect(result.messages).toHaveLength(1);
    expect(repository.list).toHaveBeenCalledWith(ticketId, listQuery);
  });

  it('rejects blank messages before persistence', async () => {
    await expect(
      service.addMessage(ticketId, { message: '   ' }, technician)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.create).not.toHaveBeenCalled();
  });
});
