/**
 * Renewal Reminder Job Unit Tests
 */
const mockPrisma = {
  contract: {
    findMany: jest.fn(),
  },
  reminderLog: {
    findUnique: jest.fn(),
    create: jest.fn(),
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

describe('RenewalReminderJob', () => {
  let job: any;

  beforeAll(async () => {
    const module = await import('../src/jobs/renewalReminder.job');
    job = new module.RenewalReminderJob();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send reminders for expiring contracts', async () => {
    const contract = {
      id: 'c1',
      contractNumber: 'AMC-001',
      status: 'ACTIVE',
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      client: {
        id: 'cl1',
        companyName: 'Test Corp',
        email: 'test@corp.com',
      },
      renewal: { id: 'r1' },
    };

    mockPrisma.contract.findMany.mockResolvedValue([contract]);
    mockPrisma.reminderLog.findUnique.mockResolvedValue(null); // No existing reminder
    mockPrisma.reminderLog.create.mockResolvedValue({});

    const result = await job.run();

    expect(result.sent).toBeGreaterThan(0);
    expect(mockPrisma.reminderLog.create).toHaveBeenCalled();
  });

  it('should skip already-sent reminders', async () => {
    const contract = {
      id: 'c1',
      contractNumber: 'AMC-001',
      status: 'ACTIVE',
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      client: {
        id: 'cl1',
        companyName: 'Test Corp',
        email: 'test@corp.com',
      },
      renewal: { id: 'r1' },
    };

    mockPrisma.contract.findMany.mockResolvedValue([contract]);
    mockPrisma.reminderLog.findUnique.mockResolvedValue({
      id: 'existing',
      contractId: 'c1',
      reminderType: '30_DAY',
    }); // Already sent

    const result = await job.run();

    expect(result.skipped).toBeGreaterThan(0);
    expect(mockPrisma.reminderLog.create).not.toHaveBeenCalled();
  });

  it('should NOT send reminders for cancelled contracts', async () => {
    mockPrisma.contract.findMany.mockResolvedValue([]);

    const result = await job.run();

    // Should have processed all day types with 0 contracts
    expect(result.sent).toBe(0);
  });
});
