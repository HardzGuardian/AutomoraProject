import { ApiError } from '../../utils/ApiError';
import { AuditLogParams, UserRole } from '../../types';
import { auditService } from '../audit/audit.service';
import {
  AssignTicketInput,
  CreateTicketInput,
  ListTicketsQuery,
  TicketStatus,
  UpdateTicketStatusInput,
} from './ticket.validator';

export interface TicketActor {
  id: string;
  role: UserRole;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  assignedTechnicianId: string;
  contractId: string | null;
  assetId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  /** Proposed Person 1 SLA/breach fields; no Prisma model exists yet. */
  slaResponseDeadline: Date | null;
  slaResolutionDeadline: Date | null;
  slaBreachedAt: Date | null;
  escalatedAt: Date | null;
}

export interface TicketListResult {
  tickets: Ticket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Person 3 persistence boundary. The future adapter must make create and
 * assignment changes atomic and update status conditionally on expectedStatus.
 */
export interface TicketRepository {
  list(query: ListTicketsQuery): Promise<TicketListResult>;
  findById(id: string): Promise<Ticket | null>;
  isActiveTechnician(technicianId: string): Promise<boolean>;
  create(input: {
    title: string;
    description: string;
    assignedTechnicianId: string;
    contractId?: string;
    assetId?: string;
    createdById: string;
    status: 'ASSIGNED';
    createdAt: Date;
  }): Promise<Ticket>;
  assignTechnician(input: {
    ticketId: string;
    expectedStatus: 'ASSIGNED';
    technicianId: string;
    assignedAt: Date;
  }): Promise<Ticket | null>;
  updateStatus(input: {
    ticketId: string;
    expectedStatus: TicketStatus;
    status: TicketStatus;
    changedAt: Date;
  }): Promise<Ticket | null>;
}

export interface TicketAuditGateway {
  logSimple(params: AuditLogParams): Promise<void>;
}

export class TicketService {
  constructor(
    private readonly repository: TicketRepository,
    private readonly audit: TicketAuditGateway = auditService,
    private readonly now: () => Date = () => new Date()
  ) {}

  async create(data: CreateTicketInput, actor: TicketActor): Promise<Ticket> {
    this.assertManager(actor);
    await this.assertActiveTechnician(data.assignedTechnicianId);

    const ticket = await this.repository.create({
      title: data.title,
      description: data.description,
      assignedTechnicianId: data.assignedTechnicianId,
      contractId: data.contractId,
      assetId: data.assetId,
      createdById: actor.id,
      status: 'ASSIGNED',
      createdAt: this.now(),
    });

    await this.audit.logSimple({
      userId: actor.id,
      action: 'TICKET_CREATED',
      entity: 'Ticket',
      entityId: ticket.id,
      metadata: {
        assignedTechnicianId: ticket.assignedTechnicianId,
        contractId: ticket.contractId,
        assetId: ticket.assetId,
        status: ticket.status,
      },
    });

    return ticket;
  }

  async list(query: ListTicketsQuery, actor: TicketActor): Promise<TicketListResult> {
    this.assertCanRead(actor);
    const scopedQuery =
      actor.role === 'TECHNICIAN'
        ? { ...query, assignedTechnicianId: actor.id }
        : query;
    return this.repository.list(scopedQuery);
  }

  async getById(id: string, actor: TicketActor): Promise<Ticket> {
    this.assertCanRead(actor);
    const ticket = await this.requireTicket(id);
    this.assertCanAccess(actor, ticket);
    return ticket;
  }

  async assignTechnician(
    id: string,
    data: AssignTicketInput,
    actor: TicketActor
  ): Promise<Ticket> {
    this.assertManager(actor);
    const ticket = await this.requireTicket(id);
    if (ticket.status !== 'ASSIGNED') {
      throw ApiError.conflict(
        `Cannot assign a ticket in ${ticket.status} status`
      );
    }

    await this.assertActiveTechnician(data.technicianId);
    const updated = await this.repository.assignTechnician({
      ticketId: id,
      expectedStatus: 'ASSIGNED',
      technicianId: data.technicianId,
      assignedAt: this.now(),
    });
    if (!updated) {
      throw ApiError.conflict('Ticket status changed before it could be assigned');
    }

    await this.audit.logSimple({
      userId: actor.id,
      action: 'TICKET_ASSIGNED',
      entity: 'Ticket',
      entityId: id,
      metadata: {
        previousTechnicianId: ticket.assignedTechnicianId,
        assignedTechnicianId: data.technicianId,
      },
    });

    return updated;
  }

  async updateStatus(
    id: string,
    data: UpdateTicketStatusInput,
    actor: TicketActor
  ): Promise<Ticket> {
    const ticket = await this.requireTicket(id);
    this.assertAssignedTechnician(actor, ticket);
    this.assertTransition(ticket.status, data.status);

    const updated = await this.repository.updateStatus({
      ticketId: id,
      expectedStatus: ticket.status,
      status: data.status,
      changedAt: this.now(),
    });
    if (!updated) {
      throw ApiError.conflict('Ticket status changed before it could be updated');
    }

    await this.audit.logSimple({
      userId: actor.id,
      action: 'TICKET_STATUS_CHANGED',
      entity: 'Ticket',
      entityId: id,
      metadata: {
        previousStatus: ticket.status,
        newStatus: updated.status,
        assignedTechnicianId: ticket.assignedTechnicianId,
      },
    });

    return updated;
  }

  private async requireTicket(id: string): Promise<Ticket> {
    const ticket = await this.repository.findById(id);
    if (!ticket) {
      throw ApiError.notFound('Ticket not found');
    }
    return ticket;
  }

  private async assertActiveTechnician(technicianId: string): Promise<void> {
    if (!(await this.repository.isActiveTechnician(technicianId))) {
      throw ApiError.badRequest('Assigned technician must be an active technician');
    }
  }

  private assertManager(actor: TicketActor): void {
    if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
      throw ApiError.forbidden('Only managers and administrators can manage tickets');
    }
  }

  private assertCanRead(actor: TicketActor): void {
    if (
      actor.role !== 'ADMIN' &&
      actor.role !== 'MANAGER' &&
      actor.role !== 'TECHNICIAN'
    ) {
      throw ApiError.forbidden('Access to tickets is not allowed');
    }
  }

  private assertCanAccess(actor: TicketActor, ticket: Ticket): void {
    this.assertCanRead(actor);
    if (
      actor.role === 'TECHNICIAN' &&
      actor.id !== ticket.assignedTechnicianId
    ) {
      throw ApiError.forbidden('Technicians can only access their assigned tickets');
    }
  }

  private assertAssignedTechnician(actor: TicketActor, ticket: Ticket): void {
    this.assertCanAccess(actor, ticket);
    if (actor.role !== 'TECHNICIAN') {
      throw ApiError.forbidden('Only the assigned technician can update this ticket');
    }
  }

  private assertTransition(current: TicketStatus, target: TicketStatus): void {
    const transitions: Record<TicketStatus, TicketStatus | null> = {
      ASSIGNED: 'IN_PROGRESS',
      IN_PROGRESS: 'RESOLVED',
      RESOLVED: null,
    };

    if (transitions[current] !== target) {
      throw ApiError.conflict(
        `Invalid ticket state transition: ${current} -> ${target}`
      );
    }
  }
}

/**
 * Explicit integration stub until Person 1 supplies Ticket persistence and
 * technician assignment models.
 */
class PendingTicketRepository implements TicketRepository {
  async list(): Promise<TicketListResult> {
    throw this.pendingError();
  }

  async findById(): Promise<Ticket | null> {
    throw this.pendingError();
  }

  async isActiveTechnician(): Promise<boolean> {
    throw this.pendingError();
  }

  async create(): Promise<Ticket> {
    throw this.pendingError();
  }

  async assignTechnician(): Promise<Ticket | null> {
    throw this.pendingError();
  }

  async updateStatus(): Promise<Ticket | null> {
    throw this.pendingError();
  }

  private pendingError(): ApiError {
    return ApiError.internal(
      'DEPENDENCY — waiting for Person 1: Ticket persistence is not available'
    );
  }
}

export const ticketService = new TicketService(new PendingTicketRepository());
