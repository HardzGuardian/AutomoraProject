import { ApiError } from '../../utils/ApiError';
import { DateHelpers } from '../../utils/dateHelpers';
import { AuditLogParams } from '../../types';
import { auditService } from '../audit/audit.service';
import { Ticket } from '../ticket/ticket.service';

export interface SlaPolicy {
  responseTimeHours: number;
  resolutionTimeHours: number;
}

export interface SlaBreachCandidate {
  ticket: Ticket;
  resolutionDeadline: Date;
}

export interface EscalatedTicket {
  ticket: Ticket;
  resolutionDeadline: Date;
  escalatedAt: Date;
}

/**
 * Person 3 SLA persistence boundary.
 *
 * flagBreach and escalateBreach must use conditional updates so concurrent
 * monitor runs cannot flag or escalate the same ticket more than once.
 */
export interface SlaRepository {
  findBreachCandidates(now: Date): Promise<SlaBreachCandidate[]>;
  flagBreach(input: {
    ticketId: string;
    resolutionDeadline: Date;
    flaggedAt: Date;
  }): Promise<Ticket | null>;
  escalateBreach(input: {
    ticketId: string;
    flaggedAt: Date;
    escalatedAt: Date;
  }): Promise<Ticket | null>;
}

export interface SlaAuditGateway {
  logSimple(params: AuditLogParams): Promise<void>;
}

export class SlaService {
  constructor(
    private readonly repository: SlaRepository,
    private readonly audit: SlaAuditGateway = auditService,
    private readonly now: () => Date = () => new Date()
  ) {}

  calculateDeadline(startAt: Date, hours: number): Date {
    if (Number.isNaN(startAt.getTime())) {
      throw ApiError.badRequest('SLA start date must be a valid date');
    }
    if (!Number.isFinite(hours) || hours <= 0) {
      throw ApiError.badRequest('SLA duration must be greater than zero hours');
    }

    return DateHelpers.addHours(startAt, hours);
  }

  /** Public SLA-specific name used by ticket and monitoring integrations. */
  calculateSlaDeadline(startAt: Date, hours: number): Date {
    return this.calculateDeadline(startAt, hours);
  }

  calculateResponseDeadline(openedAt: Date, policy: SlaPolicy): Date {
    this.validatePolicy(policy);
    return this.calculateDeadline(openedAt, policy.responseTimeHours);
  }

  calculateResolutionDeadline(openedAt: Date, policy: SlaPolicy): Date {
    this.validatePolicy(policy);
    return this.calculateDeadline(openedAt, policy.resolutionTimeHours);
  }

  /**
   * Return unresolved tickets whose resolution SLA deadline has passed.
   * Equality counts as breached at the deadline instant.
   */
  async findBreaches(now: Date = this.now()): Promise<SlaBreachCandidate[]> {
    if (Number.isNaN(now.getTime())) {
      throw ApiError.badRequest('SLA monitoring time must be a valid date');
    }

    const candidates = await this.repository.findBreachCandidates(now);
    return candidates.filter(
      (candidate) =>
        candidate.ticket.status !== 'RESOLVED' &&
        candidate.resolutionDeadline.getTime() <= now.getTime()
    );
  }

  /** Public SLA-specific alias for callers outside the monitor job. */
  async findSlaBreaches(now: Date = this.now()): Promise<SlaBreachCandidate[]> {
    return this.findBreaches(now);
  }

  /**
   * Flag and escalate each newly breached, unresolved ticket exactly once.
   * Conditional repository updates make repeated monitor runs idempotent.
   */
  async escalateBreachedTickets(
    now: Date = this.now()
  ): Promise<EscalatedTicket[]> {
    const candidates = await this.findBreaches(now);
    const escalated: EscalatedTicket[] = [];

    for (const candidate of candidates) {
      let ticket = candidate.ticket;

      if (!ticket.slaBreachedAt) {
        const flagged = await this.repository.flagBreach({
          ticketId: ticket.id,
          resolutionDeadline: candidate.resolutionDeadline,
          flaggedAt: now,
        });
        if (!flagged) {
          continue;
        }
        ticket = flagged;

        await this.audit.logSimple({
          action: 'SLA_BREACH_FLAGGED',
          entity: 'Ticket',
          entityId: ticket.id,
          metadata: {
            resolutionDeadline: candidate.resolutionDeadline.toISOString(),
            flaggedAt: now.toISOString(),
          },
        });
      }

      if (ticket.escalatedAt) {
        continue;
      }

      const escalatedTicket = await this.repository.escalateBreach({
        ticketId: ticket.id,
        flaggedAt: ticket.slaBreachedAt ?? now,
        escalatedAt: now,
      });
      if (!escalatedTicket) {
        continue;
      }

      await this.audit.logSimple({
        action: 'SLA_BREACH_ESCALATED',
        entity: 'Ticket',
        entityId: ticket.id,
        metadata: {
          resolutionDeadline: candidate.resolutionDeadline.toISOString(),
          escalatedAt: now.toISOString(),
        },
      });
      escalated.push({
        ticket: escalatedTicket,
        resolutionDeadline: candidate.resolutionDeadline,
        escalatedAt: now,
      });
    }

    return escalated;
  }

  private validatePolicy(policy: SlaPolicy): void {
    if (
      !Number.isFinite(policy.responseTimeHours) ||
      !Number.isFinite(policy.resolutionTimeHours) ||
      policy.responseTimeHours <= 0 ||
      policy.resolutionTimeHours <= 0
    ) {
      throw ApiError.badRequest('SLA response and resolution hours must be positive');
    }
  }
}

/**
 * Explicit integration stub until Person 1 supplies ticket SLA deadline,
 * breach, and escalation persistence fields.
 */
class PendingSlaRepository implements SlaRepository {
  async findBreachCandidates(): Promise<SlaBreachCandidate[]> {
    throw this.pendingError();
  }

  async flagBreach(): Promise<Ticket | null> {
    throw this.pendingError();
  }

  async escalateBreach(): Promise<Ticket | null> {
    throw this.pendingError();
  }

  private pendingError(): ApiError {
    return ApiError.internal(
      'DEPENDENCY — waiting for Person 1: Ticket SLA and escalation persistence is not available'
    );
  }
}

export const slaService = new SlaService(new PendingSlaRepository());
