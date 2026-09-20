/**
 * Contract Status Job Unit Tests
 */
const mockPrisma = {
  contract: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../src/config/db', () => mockPrisma);
jest.mock('../src/modules/audit/audit.service', () => ({
  auditService: { logSimple: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ContractStatusJob', () => {
  let job: any;
  let DateHelpers: any;

  beforeAll(async () => {
    const jobModule = await import('../src/jobs/contractStatus.job');
    const dateModule = await import('../src/utils/dateHelpers');
    job = new jobModule.ContractStatusJob();
    DateHelpers = dateModule.DateHelpers;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should transition ACTIVE contracts to EXPIRING_SOON', async () => {
    const contract = {
      id: 'c1',
      contractNumber: 'AMC-001',
      status: 'ACTIVE',
      endDate: DateHelpers.addDays(new Date(), 15),
    };

    mockPrisma.contract.findMany
      .mockResolvedValueOnce([contract]) // activeToExpiring
      .mockResolvedValueOnce([]) // expiringToExpired
      .mockResolvedValueOnce([]); // activeToExpired
    mockPrisma.contract.update.mockResolvedValue({});

    const result = await job.run();

    expect(result.updated).toBe(1);
    expect(mockPrisma.contract.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'EXPIRING_SOON' },
    });
  });

  it('should transition EXPIRING_SOON contracts to EXPIRED', async () => {
    const contract = {
      id: 'c2',
      contractNumber: 'AMC-002',
      status: 'EXPIRING_SOON',
      endDate: DateHelpers.addDays(new Date(), -1),
    };

    mockPrisma.contract.findMany
      .mockResolvedValueOnce([]) // activeToExpiring
      .mockResolvedValueOnce([contract]) // expiringToExpired
      .mockResolvedValueOnce([]); // activeToExpired
    mockPrisma.contract.update.mockResolvedValue({});

    const result = await job.run();

    expect(result.updated).toBe(1);
    expect(mockPrisma.contract.update).toHaveBeenCalledWith({
      where: { id: 'c2' },
      data: { status: 'EXPIRED' },
    });
  });

  it('should NOT modify CANCELLED contracts', async () => {
    mockPrisma.contract.findMany
      .mockResolvedValueOnce([]) // activeToExpiring
      .mockResolvedValueOnce([]) // expiringToExpired
      .mockResolvedValueOnce([]); // activeToExpired
    mockPrisma.contract.update.mockResolvedValue({});

    const result = await job.run();

    expect(result.updated).toBe(0);
    expect(mockPrisma.contract.update).not.toHaveBeenCalled();
  });

  it('should handle multiple contracts', async () => {
    const contracts = [
      { id: 'c1', contractNumber: 'AMC-001', status: 'ACTIVE', endDate: DateHelpers.addDays(new Date(), 10) },
      { id: 'c2', contractNumber: 'AMC-002', status: 'ACTIVE', endDate: DateHelpers.addDays(new Date(), 20) },
    ];

    mockPrisma.contract.findMany
      .mockResolvedValueOnce(contracts) // activeToExpiring
      .mockResolvedValueOnce([]) // expiringToExpired
      .mockResolvedValueOnce([]); // activeToExpired
    mockPrisma.contract.update.mockResolvedValue({});

    const result = await job.run();

    expect(result.updated).toBe(2);
  });

  it('should be idempotent', async () => {
    mockPrisma.contract.findMany
      .mockResolvedValueOnce([]) // activeToExpiring
      .mockResolvedValueOnce([]) // expiringToExpired
      .mockResolvedValueOnce([]); // activeToExpired

    const result1 = await job.run();
    const result2 = await job.run();

    expect(result1.updated).toBe(0);
    expect(result2.updated).toBe(0);
  });
});
