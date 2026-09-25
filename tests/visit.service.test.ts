jest.mock('../src/modules/audit/audit.service', () => ({
  auditService: {
    logSimple: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../src/modules/upload/upload.service', () => ({
  uploadService: {
    saveFile: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  },
}));

import { Readable } from 'stream';
import { UploadResult } from '../src/types';
import {
  FieldOperationsActor,
  Visit,
  VisitAuditGateway,
  VisitFileGateway,
  VisitPhoto,
  VisitRepository,
  VisitService,
} from '../src/modules/visit/visit.service';
import { ListVisitsQuery } from '../src/modules/visit/visit.validator';

const technicianId = '550e8400-e29b-41d4-a716-446655440010';
const otherTechnicianId = '550e8400-e29b-41d4-a716-446655440011';
const managerId = '550e8400-e29b-41d4-a716-446655440012';
const visitId = '550e8400-e29b-41d4-a716-446655440020';

const technician: FieldOperationsActor = {
  id: technicianId,
  role: 'TECHNICIAN',
};
const otherTechnician: FieldOperationsActor = {
  id: otherTechnicianId,
  role: 'TECHNICIAN',
};
const manager: FieldOperationsActor = {
  id: managerId,
  role: 'MANAGER',
};

const createVisit = (overrides: Partial<Visit> = {}): Visit => ({
  id: visitId,
  contractId: '550e8400-e29b-41d4-a716-446655440001',
  assetId: null,
  technicianId,
  status: 'SCHEDULED',
  scheduledStart: new Date('2026-01-01T09:00:00.000Z'),
  scheduledEnd: new Date('2026-01-01T10:00:00.000Z'),
  startedAt: null,
  completedAt: null,
  signatureUploadedFileId: null,
  signatureAttachedAt: null,
  completionNotes: null,
  photos: [],
  createdAt: new Date('2025-12-01T00:00:00.000Z'),
  updatedAt: new Date('2025-12-01T00:00:00.000Z'),
  ...overrides,
});

const createImage = (
  mimetype = 'image/png'
): Parameters<VisitFileGateway['saveFile']>[0] => ({
  fieldname: 'file',
  originalname: 'evidence.png',
  encoding: '7bit',
  mimetype,
  size: 100,
  stream: new Readable(),
  destination: './uploads',
  filename: 'evidence.png',
  path: './uploads/evidence.png',
  buffer: Buffer.from('evidence'),
});

const uploadResult: UploadResult = {
  id: '550e8400-e29b-41d4-a716-446655440030',
  originalName: 'evidence.png',
  filename: 'evidence.png',
  mimeType: 'image/png',
  size: 100,
  url: '/uploads/evidence.png',
};

const listQuery: ListVisitsQuery = {
  page: 1,
  limit: 10,
};

describe('VisitService', () => {
  let repository: VisitRepository;
  let files: VisitFileGateway;
  let audit: VisitAuditGateway;
  let service: VisitService;
  const now = new Date('2026-01-01T09:15:00.000Z');

  beforeEach(() => {
    repository = {
      list: jest.fn().mockResolvedValue({
        visits: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      }),
      findById: jest.fn().mockResolvedValue(createVisit()),
      startVisit: jest.fn().mockImplementation(async () =>
        createVisit({
          status: 'IN_PROGRESS',
          startedAt: now,
        })
      ),
      completeVisit: jest.fn().mockImplementation(async () =>
        createVisit({
          status: 'COMPLETED',
          startedAt: new Date('2026-01-01T09:00:00.000Z'),
          completedAt: now,
          signatureUploadedFileId: uploadResult.id,
          completionNotes: 'Service completed',
        })
      ),
      attachPhoto: jest.fn().mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440031',
        visitId,
        uploadedFileId: uploadResult.id,
        createdAt: now,
      } satisfies VisitPhoto),
      attachSignature: jest.fn().mockImplementation(async () =>
        createVisit({
          status: 'IN_PROGRESS',
          signatureUploadedFileId: uploadResult.id,
          signatureAttachedAt: now,
        })
      ),
      rescheduleVisit: jest.fn().mockImplementation(async (input) =>
        createVisit({
          scheduledStart: input.scheduledStart,
          scheduledEnd: input.scheduledEnd,
          updatedAt: now,
        })
      ),
    };
    files = {
      saveFile: jest.fn().mockResolvedValue(uploadResult),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    audit = {
      logSimple: jest.fn().mockResolvedValue(undefined),
    };
    service = new VisitService(repository, files, audit, () => now);
  });

  it('allows a technician to access their own visit', async () => {
    const visit = await service.getById(visitId, technician);

    expect(visit.id).toBe(visitId);
    expect(repository.findById).toHaveBeenCalledWith(visitId);
  });

  it('prevents a technician from accessing another technician visit', async () => {
    await expect(service.getById(visitId, otherTechnician)).rejects.toMatchObject({
      statusCode: 403,
      message: 'Technicians can only access their own visits',
    });
  });

  it('forces technician list queries to be scoped to the authenticated technician', async () => {
    await service.list({ ...listQuery, technicianId: otherTechnicianId }, technician);

    expect(repository.list).toHaveBeenCalledWith({
      ...listQuery,
      technicianId,
    });
  });

  it('transitions SCHEDULED to IN_PROGRESS', async () => {
    const result = await service.startVisit(visitId, technician);

    expect(result.status).toBe('IN_PROGRESS');
    expect(repository.startVisit).toHaveBeenCalledWith({
      id: visitId,
      expectedStatus: 'SCHEDULED',
      startedAt: now,
    });
    expect(audit.logSimple).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'VISIT_STARTED', entityId: visitId })
    );
  });

  it('rejects an invalid visit state transition with HTTP 409', async () => {
    jest.mocked(repository.findById).mockResolvedValue(
      createVisit({ status: 'IN_PROGRESS' })
    );

    await expect(service.startVisit(visitId, technician)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Invalid visit state transition: IN_PROGRESS -> IN_PROGRESS',
    });
    expect(repository.startVisit).not.toHaveBeenCalled();
  });

  it('transitions IN_PROGRESS to COMPLETED when a signature exists', async () => {
    jest.mocked(repository.findById).mockResolvedValue(
      createVisit({
        status: 'IN_PROGRESS',
        signatureUploadedFileId: uploadResult.id,
        startedAt: new Date('2026-01-01T09:00:00.000Z'),
      })
    );

    const result = await service.completeVisit(
      visitId,
      { completionNotes: 'Service completed' },
      technician
    );

    expect(result.status).toBe('COMPLETED');
    expect(repository.completeVisit).toHaveBeenCalledWith({
      id: visitId,
      expectedStatus: 'IN_PROGRESS',
      signatureUploadedFileId: uploadResult.id,
      completionNotes: 'Service completed',
      completedAt: now,
    });
  });

  it('rejects completion without a required signature', async () => {
    jest.mocked(repository.findById).mockResolvedValue(
      createVisit({ status: 'IN_PROGRESS' })
    );

    await expect(
      service.completeVisit(visitId, {}, technician)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Signature is required before completing a visit',
    });
    expect(repository.completeVisit).not.toHaveBeenCalled();
  });

  it('attaches a photo through the shared upload gateway', async () => {
    const result = await service.attachPhoto(visitId, createImage(), technician);

    expect(files.saveFile).toHaveBeenCalledWith(expect.any(Object), technicianId);
    expect(repository.attachPhoto).toHaveBeenCalledWith({
      visitId,
      uploadedFileId: uploadResult.id,
    });
    expect(result.uploadedFileId).toBe(uploadResult.id);
  });

  it('attaches a signature and makes completion eligible', async () => {
    const result = await service.attachSignature(
      visitId,
      createImage('image/jpeg'),
      technician
    );

    expect(result.signatureUploadedFileId).toBe(uploadResult.id);
    expect(repository.attachSignature).toHaveBeenCalledWith({
      visitId,
      uploadedFileId: uploadResult.id,
      attachedAt: now,
    });
  });

  it('rejects non-image attachments before calling the upload service', async () => {
    await expect(
      service.attachPhoto(visitId, createImage('application/pdf'), technician)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(files.saveFile).not.toHaveBeenCalled();
  });

  it('allows the assigned technician to reschedule a SCHEDULED visit', async () => {
    const result = await service.rescheduleVisit(
      visitId,
      {
        scheduledStart: new Date('2026-01-02T09:00:00.000Z'),
        scheduledEnd: new Date('2026-01-02T10:00:00.000Z'),
        reason: 'Customer requested a later slot',
      },
      technician
    );

    expect(result.scheduledStart.toISOString()).toBe('2026-01-02T09:00:00.000Z');
    expect(audit.logSimple).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'VISIT_RESCHEDULED' })
    );
  });

  it('rejects rescheduling after a visit has started', async () => {
    jest.mocked(repository.findById).mockResolvedValue(
      createVisit({ status: 'IN_PROGRESS' })
    );

    await expect(
      service.rescheduleVisit(
        visitId,
        {
          scheduledStart: new Date('2026-01-02T09:00:00.000Z'),
          scheduledEnd: new Date('2026-01-02T10:00:00.000Z'),
          reason: 'Too late',
        },
        technician
      )
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows a manager to reschedule but not impersonate the technician', async () => {
    const rescheduled = await service.rescheduleVisit(
      visitId,
      {
        scheduledStart: new Date('2026-01-03T09:00:00.000Z'),
        scheduledEnd: new Date('2026-01-03T10:00:00.000Z'),
        reason: 'Technician unavailable',
      },
      manager
    );
    expect(rescheduled.id).toBe(visitId);

    await expect(service.startVisit(visitId, manager)).rejects.toMatchObject({
      statusCode: 403,
      message: 'Only the assigned technician can update this visit',
    });
  });
});
