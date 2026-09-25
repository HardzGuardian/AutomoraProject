jest.mock('../src/modules/audit/audit.service', () => ({
  auditService: {
    logSimple: jest.fn().mockResolvedValue(undefined),
  },
}));

import {
  SchedulableContract,
  SchedulingAuditGateway,
  SchedulingRepository,
  SchedulingService,
  SchedulingTechnician,
  NewScheduledVisit,
  ScheduledVisit,
} from '../src/modules/scheduling/scheduling.service';

const contract: SchedulableContract = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  includedVisits: 4,
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: new Date('2026-01-05T00:00:00.000Z'),
};

const technician = (
  id: string,
  overrides: Partial<SchedulingTechnician> = {}
): SchedulingTechnician => ({
  id,
  isActive: true,
  skills: ['HVAC'],
  zones: ['NORTH'],
  scheduledVisitCount: 0,
  ...overrides,
});

describe('SchedulingService', () => {
  let repository: SchedulingRepository;
  let audit: SchedulingAuditGateway;
  let service: SchedulingService;

  beforeEach(() => {
    repository = {
      getRequirements: jest.fn().mockResolvedValue({
        estimatedDurationMinutes: 60,
        requiredSkills: ['HVAC'],
        serviceZone: 'NORTH',
      }),
      findEligibleTechnicians: jest.fn().mockResolvedValue([
        technician('technician-b', { scheduledVisitCount: 2 }),
        technician('technician-a'),
      ]),
      isTechnicianAvailable: jest.fn().mockResolvedValue(true),
      createVisits: jest.fn().mockImplementation(
        async (visits: NewScheduledVisit[]): Promise<ScheduledVisit[]> =>
          visits.map((visit, index) => ({ ...visit, id: `visit-${index + 1}` }))
      ),
    };
    audit = {
      logSimple: jest.fn().mockResolvedValue(undefined),
    };
    service = new SchedulingService(repository, audit);
  });

  it('generates the exact included visit count at even intervals', async () => {
    const result = await service.generateVisits(contract);

    expect(result).toHaveLength(4);
    expect(result.map((visit) => visit.scheduledStart.toISOString())).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z',
      '2026-01-04T00:00:00.000Z',
    ]);
    expect(result.map((visit) => visit.sequence)).toEqual([1, 2, 3, 4]);
    expect(result.every((visit) => visit.status === 'SCHEDULED')).toBe(true);
    expect(result.map((visit) => visit.idempotencyKey)).toEqual([
      `${contract.id}:1`,
      `${contract.id}:2`,
      `${contract.id}:3`,
      `${contract.id}:4`,
    ]);
    expect(audit.logSimple).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'VISITS_GENERATED',
        entity: 'Contract',
        entityId: contract.id,
        metadata: expect.objectContaining({ visitCount: 4 }),
      })
    );
  });

  it('balances assignments using existing workload', async () => {
    const result = await service.generateVisits(contract);

    expect(result.map((visit) => visit.technicianId)).toEqual([
      'technician-a',
      'technician-a',
      'technician-a',
      'technician-b',
    ]);
  });

  it('falls back to an available technician when the least-loaded technician is busy', async () => {
    jest
      .mocked(repository.isTechnicianAvailable)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const result = await service.generateVisits({ ...contract, includedVisits: 1 });

    expect(result[0].technicianId).toBe('technician-b');
    expect(repository.isTechnicianAvailable).toHaveBeenNthCalledWith(
      1,
      'technician-a',
      expect.objectContaining({
        startAt: new Date('2026-01-01T00:00:00.000Z'),
        endAt: new Date('2026-01-01T01:00:00.000Z'),
      }),
      contract.id
    );
  });

  it('rejects candidates that do not match required skills or zone', async () => {
    jest.mocked(repository.findEligibleTechnicians).mockResolvedValue([
      technician('wrong-skill', { skills: ['ELECTRICAL'] }),
      technician('wrong-zone', { zones: ['SOUTH'] }),
    ]);

    await expect(service.generateVisits(contract)).rejects.toMatchObject({
      statusCode: 409,
      message: 'No active technician matches the service requirements',
    });
    expect(repository.createVisits).not.toHaveBeenCalled();
  });

  it('returns no visits without touching persistence when count is null or zero', async () => {
    await expect(
      service.generateVisits({ ...contract, includedVisits: null })
    ).resolves.toEqual([]);
    await expect(
      service.generateVisits({ ...contract, includedVisits: 0 })
    ).resolves.toEqual([]);

    expect(repository.getRequirements).not.toHaveBeenCalled();
    expect(repository.createVisits).not.toHaveBeenCalled();
  });

  it('rejects an invalid visit count', async () => {
    await expect(
      service.generateVisits({ ...contract, includedVisits: -1 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a service duration larger than the scheduling interval', async () => {
    jest.mocked(repository.getRequirements).mockResolvedValue({
      estimatedDurationMinutes: 2_000,
      requiredSkills: [],
      serviceZone: null,
    });

    await expect(service.generateVisits(contract)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Estimated service duration exceeds the interval between scheduled visits',
    });
  });
});
