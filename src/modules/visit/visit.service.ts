import { ApiError } from '../../utils/ApiError';
import { AuditLogParams, UploadResult, UserRole } from '../../types';
import { auditService } from '../audit/audit.service';
import { uploadService } from '../upload/upload.service';
import {
  CompleteVisitInput,
  ListVisitsQuery,
  RescheduleVisitInput,
  VisitStatus,
} from './visit.validator';

export interface FieldOperationsActor {
  id: string;
  role: UserRole;
}

export interface VisitPhoto {
  id: string;
  visitId: string;
  uploadedFileId: string;
  createdAt: Date;
}

export interface Visit {
  id: string;
  contractId: string;
  assetId: string | null;
  technicianId: string;
  status: VisitStatus;
  scheduledStart: Date;
  scheduledEnd: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  signatureUploadedFileId: string | null;
  signatureAttachedAt: Date | null;
  completionNotes: string | null;
  photos: VisitPhoto[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VisitListResult {
  visits: Visit[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Person 3 persistence boundary. Transition methods must update conditionally
 * on expectedStatus so concurrent state changes cannot bypass service rules.
 */
export interface VisitRepository {
  list(query: ListVisitsQuery): Promise<VisitListResult>;
  findById(id: string): Promise<Visit | null>;
  startVisit(input: {
    id: string;
    expectedStatus: 'SCHEDULED';
    startedAt: Date;
  }): Promise<Visit | null>;
  completeVisit(input: {
    id: string;
    expectedStatus: 'IN_PROGRESS';
    signatureUploadedFileId: string;
    completionNotes: string | null;
    completedAt: Date;
  }): Promise<Visit | null>;
  attachPhoto(input: {
    visitId: string;
    uploadedFileId: string;
  }): Promise<VisitPhoto>;
  attachSignature(input: {
    visitId: string;
    uploadedFileId: string;
    attachedAt: Date;
  }): Promise<Visit>;
  rescheduleVisit(input: {
    id: string;
    expectedStatus: 'SCHEDULED';
    scheduledStart: Date;
    scheduledEnd: Date;
    reason: string;
  }): Promise<Visit | null>;
}

export interface VisitFileGateway {
  saveFile(file: Express.Multer.File, userId: string): Promise<UploadResult>;
  delete(fileId: string, userId: string, userRole: string): Promise<void>;
}

export interface VisitAuditGateway {
  logSimple(params: AuditLogParams): Promise<void>;
}

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export class VisitService {
  constructor(
    private readonly repository: VisitRepository,
    private readonly files: VisitFileGateway = uploadService,
    private readonly audit: VisitAuditGateway = auditService,
    private readonly now: () => Date = () => new Date()
  ) {}

  async list(query: ListVisitsQuery, actor: FieldOperationsActor): Promise<VisitListResult> {
    this.assertCanRead(actor);
    const scopedQuery =
      actor.role === 'TECHNICIAN'
        ? { ...query, technicianId: actor.id }
        : query;

    return this.repository.list(scopedQuery);
  }

  async getById(id: string, actor: FieldOperationsActor): Promise<Visit> {
    this.assertCanRead(actor);
    const visit = await this.requireVisit(id);
    this.assertCanAccessVisit(actor, visit);
    return visit;
  }

  async startVisit(id: string, actor: FieldOperationsActor): Promise<Visit> {
    const visit = await this.requireVisit(id);
    this.assertAssignedTechnician(actor, visit);
    this.assertTransition(visit.status, 'IN_PROGRESS');

    const updated = await this.repository.startVisit({
      id,
      expectedStatus: 'SCHEDULED',
      startedAt: this.now(),
    });
    if (!updated) {
      throw ApiError.conflict('Visit status changed before the visit could be started');
    }

    await this.audit.logSimple({
      userId: actor.id,
      action: 'VISIT_STARTED',
      entity: 'Visit',
      entityId: id,
      metadata: {
        contractId: visit.contractId,
        technicianId: visit.technicianId,
        previousStatus: visit.status,
        newStatus: updated.status,
      },
    });

    return updated;
  }

  async completeVisit(
    id: string,
    input: CompleteVisitInput,
    actor: FieldOperationsActor
  ): Promise<Visit> {
    const visit = await this.requireVisit(id);
    this.assertAssignedTechnician(actor, visit);
    this.assertTransition(visit.status, 'COMPLETED');

    if (!visit.signatureUploadedFileId) {
      throw ApiError.conflict('Signature is required before completing a visit');
    }
    if (
      input.completionNotes !== undefined &&
      input.completionNotes.length > 2000
    ) {
      throw ApiError.badRequest(
        'Completion notes must be less than 2000 characters'
      );
    }

    const updated = await this.repository.completeVisit({
      id,
      expectedStatus: 'IN_PROGRESS',
      signatureUploadedFileId: visit.signatureUploadedFileId,
      completionNotes: input.completionNotes ?? null,
      completedAt: this.now(),
    });
    if (!updated) {
      throw ApiError.conflict('Visit status changed before the visit could be completed');
    }

    await this.audit.logSimple({
      userId: actor.id,
      action: 'VISIT_COMPLETED',
      entity: 'Visit',
      entityId: id,
      metadata: {
        contractId: visit.contractId,
        technicianId: visit.technicianId,
        signatureUploadedFileId: visit.signatureUploadedFileId,
        previousStatus: visit.status,
        newStatus: updated.status,
      },
    });

    return updated;
  }

  async attachPhoto(
    id: string,
    file: Express.Multer.File,
    actor: FieldOperationsActor
  ): Promise<VisitPhoto> {
    const visit = await this.requireVisit(id);
    this.assertAssignedTechnician(actor, visit);
    this.assertAttachmentsAllowed(visit);
    this.assertImage(file);

    const uploaded = await this.files.saveFile(file, actor.id);
    try {
      const photo = await this.repository.attachPhoto({
        visitId: id,
        uploadedFileId: uploaded.id,
      });

      await this.audit.logSimple({
        userId: actor.id,
        action: 'VISIT_PHOTO_ATTACHED',
        entity: 'Visit',
        entityId: id,
        metadata: {
          uploadedFileId: uploaded.id,
          originalName: uploaded.originalName,
        },
      });
      return photo;
    } catch (error) {
      await this.files
        .delete(uploaded.id, actor.id, actor.role)
        .catch(() => undefined);
      throw error;
    }
  }

  async attachSignature(
    id: string,
    file: Express.Multer.File,
    actor: FieldOperationsActor
  ): Promise<Visit> {
    const visit = await this.requireVisit(id);
    this.assertAssignedTechnician(actor, visit);
    this.assertAttachmentsAllowed(visit);
    this.assertImage(file);

    if (visit.signatureUploadedFileId) {
      throw ApiError.conflict('A signature is already attached to this visit');
    }

    const uploaded = await this.files.saveFile(file, actor.id);
    try {
      const updated = await this.repository.attachSignature({
        visitId: id,
        uploadedFileId: uploaded.id,
        attachedAt: this.now(),
      });

      await this.audit.logSimple({
        userId: actor.id,
        action: 'VISIT_SIGNATURE_ATTACHED',
        entity: 'Visit',
        entityId: id,
        metadata: {
          uploadedFileId: uploaded.id,
          originalName: uploaded.originalName,
        },
      });
      return updated;
    } catch (error) {
      await this.files
        .delete(uploaded.id, actor.id, actor.role)
        .catch(() => undefined);
      throw error;
    }
  }

  async rescheduleVisit(
    id: string,
    input: RescheduleVisitInput,
    actor: FieldOperationsActor
  ): Promise<Visit> {
    const visit = await this.requireVisit(id);
    this.assertCanAccessVisit(actor, visit);
    if (visit.status !== 'SCHEDULED') {
      throw ApiError.conflict('Only a SCHEDULED visit can be rescheduled');
    }
    this.validateRescheduleInput(input);

    const updated = await this.repository.rescheduleVisit({
      id,
      expectedStatus: 'SCHEDULED',
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      reason: input.reason,
    });
    if (!updated) {
      throw ApiError.conflict('Visit status changed before it could be rescheduled');
    }

    await this.audit.logSimple({
      userId: actor.id,
      action: 'VISIT_RESCHEDULED',
      entity: 'Visit',
      entityId: id,
      metadata: {
        previousScheduledStart: visit.scheduledStart.toISOString(),
        newScheduledStart: input.scheduledStart.toISOString(),
        previousScheduledEnd: visit.scheduledEnd.toISOString(),
        newScheduledEnd: input.scheduledEnd.toISOString(),
        reason: input.reason,
      },
    });

    return updated;
  }

  private async requireVisit(id: string): Promise<Visit> {
    const visit = await this.repository.findById(id);
    if (!visit) {
      throw ApiError.notFound('Visit not found');
    }
    return visit;
  }

  private assertCanRead(actor: FieldOperationsActor): void {
    if (
      actor.role !== 'ADMIN' &&
      actor.role !== 'MANAGER' &&
      actor.role !== 'TECHNICIAN'
    ) {
      throw ApiError.forbidden('Access to field operations is not allowed');
    }
  }

  private assertCanAccessVisit(actor: FieldOperationsActor, visit: Visit): void {
    this.assertCanRead(actor);
    if (actor.role === 'TECHNICIAN' && actor.id !== visit.technicianId) {
      throw ApiError.forbidden('Technicians can only access their own visits');
    }
  }

  private assertAssignedTechnician(
    actor: FieldOperationsActor,
    visit: Visit
  ): void {
    this.assertCanAccessVisit(actor, visit);
    if (actor.role !== 'TECHNICIAN') {
      throw ApiError.forbidden('Only the assigned technician can update this visit');
    }
  }

  private assertTransition(current: VisitStatus, target: VisitStatus): void {
    const transitions: Record<VisitStatus, VisitStatus | null> = {
      SCHEDULED: 'IN_PROGRESS',
      IN_PROGRESS: 'COMPLETED',
      COMPLETED: null,
    };

    if (transitions[current] !== target) {
      throw ApiError.conflict(
        `Invalid visit state transition: ${current} -> ${target}`
      );
    }
  }

  private assertAttachmentsAllowed(visit: Visit): void {
    if (visit.status === 'COMPLETED') {
      throw ApiError.conflict(
        'Files cannot be attached after a visit has been completed'
      );
    }
  }

  private assertImage(file: Express.Multer.File): void {
    if (!file || !ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw ApiError.badRequest('Visit photos and signatures must be image files');
    }
  }

  private validateRescheduleInput(input: RescheduleVisitInput): void {
    if (
      Number.isNaN(input.scheduledStart.getTime()) ||
      Number.isNaN(input.scheduledEnd.getTime()) ||
      input.scheduledEnd <= input.scheduledStart
    ) {
      throw ApiError.badRequest('Scheduled end must be after scheduled start');
    }
    if (!input.reason.trim() || input.reason.length > 500) {
      throw ApiError.badRequest(
        'Reschedule reason must be between 1 and 500 characters'
      );
    }
  }
}

/**
 * Explicit integration stub until Person 1 supplies Visit, VisitPhoto, and
 * UploadedFile relation models.
 */
class PendingVisitRepository implements VisitRepository {
  async list(): Promise<VisitListResult> {
    throw this.pendingError();
  }

  async findById(): Promise<Visit | null> {
    throw this.pendingError();
  }

  async startVisit(): Promise<Visit | null> {
    throw this.pendingError();
  }

  async completeVisit(): Promise<Visit | null> {
    throw this.pendingError();
  }

  async attachPhoto(): Promise<VisitPhoto> {
    throw this.pendingError();
  }

  async attachSignature(): Promise<Visit> {
    throw this.pendingError();
  }

  async rescheduleVisit(): Promise<Visit | null> {
    throw this.pendingError();
  }

  private pendingError(): ApiError {
    return ApiError.internal(
      'DEPENDENCY — waiting for Person 1: Visit persistence is not available'
    );
  }
}

export const visitService = new VisitService(
  new PendingVisitRepository()
);
