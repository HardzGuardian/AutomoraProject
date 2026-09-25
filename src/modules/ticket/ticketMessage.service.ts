import { ApiError } from '../../utils/ApiError';
import { AuditLogParams } from '../../types';
import { auditService } from '../audit/audit.service';
import { ticketService, Ticket, TicketActor } from './ticket.service';
import {
  ListTicketMessagesQuery,
  TicketMessageInput,
} from './ticket.validator';

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  message: string;
  createdAt: Date;
}

export interface TicketMessageListResult {
  messages: TicketMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface TicketReader {
  getById(id: string, actor: TicketActor): Promise<Ticket>;
}

export interface TicketMessageRepository {
  create(input: {
    ticketId: string;
    authorId: string;
    message: string;
    createdAt: Date;
  }): Promise<TicketMessage>;
  list(
    ticketId: string,
    query: ListTicketMessagesQuery
  ): Promise<TicketMessageListResult>;
}

export interface TicketMessageAuditGateway {
  logSimple(params: AuditLogParams): Promise<void>;
}

export class TicketMessageService {
  constructor(
    private readonly tickets: TicketReader,
    private readonly repository: TicketMessageRepository,
    private readonly audit: TicketMessageAuditGateway = auditService,
    private readonly now: () => Date = () => new Date()
  ) {}

  async addMessage(
    ticketId: string,
    data: TicketMessageInput,
    actor: TicketActor
  ): Promise<TicketMessage> {
    await this.tickets.getById(ticketId, actor);
    const message = data.message.trim();
    if (!message || message.length > 5000) {
      throw ApiError.badRequest(
        'Message must be between 1 and 5000 characters'
      );
    }

    const created = await this.repository.create({
      ticketId,
      authorId: actor.id,
      message,
      createdAt: this.now(),
    });

    await this.audit.logSimple({
      userId: actor.id,
      action: 'TICKET_MESSAGE_ADDED',
      entity: 'TicketMessage',
      entityId: created.id,
      metadata: {
        ticketId,
        authorId: actor.id,
      },
    });

    return created;
  }

  async listMessages(
    ticketId: string,
    query: ListTicketMessagesQuery,
    actor: TicketActor
  ): Promise<TicketMessageListResult> {
    await this.tickets.getById(ticketId, actor);
    return this.repository.list(ticketId, query);
  }
}

class PendingTicketMessageRepository implements TicketMessageRepository {
  async create(): Promise<TicketMessage> {
    throw this.pendingError();
  }

  async list(): Promise<TicketMessageListResult> {
    throw this.pendingError();
  }

  private pendingError(): ApiError {
    return ApiError.internal(
      'DEPENDENCY — waiting for Person 1: TicketMessage persistence is not available'
    );
  }
}

export const ticketMessageService = new TicketMessageService(
  ticketService,
  new PendingTicketMessageRepository()
);
