import { ApiError } from '../../utils/ApiError';
import { AuditLogParams } from '../../types';
import { auditService } from '../audit/audit.service';

/**
 * The subset of Person 2's Contract model required by scheduling.
 * A Prisma Contract is structurally compatible with this interface.
 */
export interface SchedulableContract {
  id: string;
  includedVisits: number | null;
  startDate: Date;
  endDate: Date;
}

export interface SchedulingRequirements {
  estimatedDurationMinutes: number;
  requiredSkills: string[];
  serviceZone: string | null;
}

export interface SchedulingTechnician {
  id: string;
  isActive: boolean;
  skills: string[];
  zones: string[];
  scheduledVisitCount: number;
}

export interface SchedulingWindow {
  startAt: Date;
  endAt: Date;
}

export interface NewScheduledVisit {
  contractId: string;
  technicianId: string;
  sequence: number;
  status: 'SCHEDULED';
  scheduledStart: Date;
  scheduledEnd: Date;
  idempotencyKey: string;
}

export interface ScheduledVisit extends NewScheduledVisit {
  id: string;
}

/**
 * Person 3 persistence boundary.
 *
 * A future Prisma adapter must implement createVisits atomically and enforce
 * the unique idempotencyKey so contract activation can be retried safely.
 */
export interface SchedulingRepository {
  getRequirements(contractId: string): Promise<SchedulingRequirements>;
  findEligibleTechnicians(
    contractId: string,
    requirements: SchedulingRequirements
  ): Promise<SchedulingTechnician[]>;
  isTechnicianAvailable(
    technicianId: string,
    window: SchedulingWindow,
    excludeContractId: string
  ): Promise<boolean>;
  createVisits(visits: NewScheduledVisit[]): Promise<ScheduledVisit[]>;
}

export interface SchedulingAuditGateway {
  logSimple(params: AuditLogParams): Promise<void>;
}

export class SchedulingService {
  constructor(
    private readonly repository: SchedulingRepository,
    private readonly audit: SchedulingAuditGateway = auditService
  ) {}

  /**
   * Generate the exact number of visits included by a contract.
   *
   * Dates are evenly distributed from the contract start through its end.
   * Technician selection uses skill, zone, current workload, and availability
   * when those values are supplied by the future Person 1 data adapter.
   */
  async generateVisits(contract: SchedulableContract): Promise<ScheduledVisit[]> {
    this.validateContract(contract);

    const visitCount = contract.includedVisits;
    if (visitCount === null || visitCount === 0) {
      return [];
    }

    const requirements = await this.repository.getRequirements(contract.id);
    this.validateRequirements(requirements);

    const durationMs = requirements.estimatedDurationMinutes * 60 * 1000;
    const contractDurationMs = contract.endDate.getTime() - contract.startDate.getTime();
    const intervalMs = contractDurationMs / visitCount;

    if (durationMs > intervalMs) {
      throw ApiError.badRequest(
        'Estimated service duration exceeds the interval between scheduled visits'
      );
    }

    const technicians = await this.repository.findEligibleTechnicians(
      contract.id,
      requirements
    );
    const eligibleTechnicians = technicians.filter((technician) =>
      this.technicianMatchesRequirements(technician, requirements)
    );

    if (eligibleTechnicians.length === 0) {
      throw ApiError.conflict('No active technician matches the service requirements');
    }

    const assignedCounts = new Map<string, number>(
      eligibleTechnicians.map((technician) => [
        technician.id,
        technician.scheduledVisitCount,
      ])
    );
    const drafts: NewScheduledVisit[] = [];

    for (let index = 0; index < visitCount; index++) {
      const scheduledStart = new Date(
        contract.startDate.getTime() + Math.round((index * contractDurationMs) / visitCount)
      );
      const scheduledEnd = new Date(scheduledStart.getTime() + durationMs);
      const technicianId = await this.selectAvailableTechnician(
        eligibleTechnicians,
        assignedCounts,
        {
          startAt: scheduledStart,
          endAt: scheduledEnd,
        },
        contract.id
      );

      assignedCounts.set(
        technicianId,
        (assignedCounts.get(technicianId) ?? 0) + 1
      );
      drafts.push({
        contractId: contract.id,
        technicianId,
        sequence: index + 1,
        status: 'SCHEDULED',
        scheduledStart,
        scheduledEnd,
        idempotencyKey: `${contract.id}:${index + 1}`,
      });
    }

    const visits = await this.repository.createVisits(drafts);
    if (visits.length !== drafts.length) {
      throw ApiError.internal('Scheduled visit persistence returned an unexpected count');
    }

    await this.audit.logSimple({
      action: 'VISITS_GENERATED',
      entity: 'Contract',
      entityId: contract.id,
      metadata: {
        visitCount,
        technicianIds: [...new Set(visits.map((visit) => visit.technicianId))],
        generatedAt: new Date().toISOString(),
      },
    });

    return visits;
  }

  private validateContract(contract: SchedulableContract): void {
    if (
      Number.isNaN(contract.startDate.getTime()) ||
      Number.isNaN(contract.endDate.getTime())
    ) {
      throw ApiError.badRequest('Contract start and end dates must be valid dates');
    }

    if (contract.endDate <= contract.startDate) {
      throw ApiError.badRequest('Contract end date must be after its start date');
    }

    if (
      contract.includedVisits !== null &&
      (!Number.isInteger(contract.includedVisits) || contract.includedVisits < 0)
    ) {
      throw ApiError.badRequest('Included visits must be a non-negative integer');
    }
  }

  private validateRequirements(requirements: SchedulingRequirements): void {
    if (
      !Number.isInteger(requirements.estimatedDurationMinutes) ||
      requirements.estimatedDurationMinutes <= 0
    ) {
      throw ApiError.badRequest('Estimated service duration must be a positive integer');
    }
  }

  private technicianMatchesRequirements(
    technician: SchedulingTechnician,
    requirements: SchedulingRequirements
  ): boolean {
    if (!technician.isActive) {
      return false;
    }

    const technicianSkills = new Set(
      technician.skills.map((skill) => skill.trim().toLowerCase()).filter(Boolean)
    );
    const hasRequiredSkills = requirements.requiredSkills.every((skill) =>
      technicianSkills.has(skill.trim().toLowerCase())
    );

    if (!hasRequiredSkills) {
      return false;
    }

    if (!requirements.serviceZone?.trim()) {
      return true;
    }

    const technicianZones = new Set(
      technician.zones.map((zone) => zone.trim().toLowerCase()).filter(Boolean)
    );
    return technicianZones.has(requirements.serviceZone.trim().toLowerCase());
  }

  private async selectAvailableTechnician(
    technicians: SchedulingTechnician[],
    assignedCounts: Map<string, number>,
    window: SchedulingWindow,
    excludeContractId: string
  ): Promise<string> {
    const orderedTechnicians = [...technicians].sort((left, right) => {
      const workloadDifference =
        (assignedCounts.get(left.id) ?? 0) - (assignedCounts.get(right.id) ?? 0);
      return workloadDifference || left.id.localeCompare(right.id);
    });

    for (const technician of orderedTechnicians) {
      const available = await this.repository.isTechnicianAvailable(
        technician.id,
        window,
        excludeContractId
      );
      if (available) {
        return technician.id;
      }
    }

    throw ApiError.conflict(
      `No technician is available for the scheduled window ${window.startAt.toISOString()}`
    );
  }
}

/**
 * Explicit integration stub until Person 1 supplies Visit persistence and
 * technician skill, zone, and availability models.
 */
class PendingSchedulingRepository implements SchedulingRepository {
  async getRequirements(): Promise<SchedulingRequirements> {
    throw this.pendingError();
  }

  async findEligibleTechnicians(): Promise<SchedulingTechnician[]> {
    throw this.pendingError();
  }

  async isTechnicianAvailable(): Promise<boolean> {
    throw this.pendingError();
  }

  async createVisits(): Promise<ScheduledVisit[]> {
    throw this.pendingError();
  }

  private pendingError(): ApiError {
    return ApiError.internal(
      'DEPENDENCY — waiting for Person 1: Visit and technician scheduling persistence is not available'
    );
  }
}

export const schedulingService = new SchedulingService(
  new PendingSchedulingRepository()
);
