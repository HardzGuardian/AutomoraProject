/**
 * Renewal Service Unit Tests
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const mockPrisma: any = {
  renewal: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  renewalFollowUp: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

const mockAuditService: any = {
  log: jest.fn(),
  logSimple: jest.fn(),
};

jest.mock('../src/config/db', () => mockPrisma);
jest.mock('../src/modules/audit/audit.service', () => ({
  auditService: mockAuditService,
}));

describe('RenewalService', () => {
  let service: any;

  beforeAll(async () => {
    const module = await import('../src/modules/renewal/renewal.service');
    service = new module.RenewalService();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('status transitions', () => {
    it('should allow PENDING → IN_DISCUSSION', async () => {
      mockPrisma.renewal.findUnique.mockResolvedValue({
        id: '1',
        contractId: 'c1',
        status: 'PENDING',
      });
      mockPrisma.renewal.update.mockResolvedValue({});
      mockAuditService.logSimple.mockResolvedValue(undefined);

      await service.updateStatus('1', { status: 'IN_DISCUSSION' }, 'user-1');

      expect(mockPrisma.renewal.update).toHaveBeenCalled();
    });

    it('should allow PENDING → RENEWED', async () => {
      mockPrisma.renewal.findUnique.mockResolvedValue({
        id: '1',
        contractId: 'c1',
        status: 'PENDING',
      });
      mockPrisma.renewal.update.mockResolvedValue({});
      mockAuditService.logSimple.mockResolvedValue(undefined);

      await service.updateStatus('1', { status: 'RENEWED' }, 'user-1');

      expect(mockPrisma.renewal.update).toHaveBeenCalled();
    });

    it('should NOT allow RENEWED → anything', async () => {
      mockPrisma.renewal.findUnique.mockResolvedValue({
        id: '1',
        contractId: 'c1',
        status: 'RENEWED',
      });

      await expect(
        service.updateStatus('1', { status: 'PENDING' }, 'user-1')
      ).rejects.toThrow('Cannot transition renewal from RENEWED to PENDING');
    });

    it('should NOT allow NOT_RENEWED → RENEWED', async () => {
      mockPrisma.renewal.findUnique.mockResolvedValue({
        id: '1',
        contractId: 'c1',
        status: 'NOT_RENEWED',
      });

      await expect(
        service.updateStatus('1', { status: 'RENEWED' }, 'user-1')
      ).rejects.toThrow('Cannot transition renewal from NOT_RENEWED to RENEWED');
    });
  });

  describe('markNotRenewed', () => {
    it('should mark a PENDING renewal as NOT_RENEWED', async () => {
      mockPrisma.renewal.findUnique.mockResolvedValue({
        id: '1',
        contractId: 'c1',
        status: 'PENDING',
      });
      mockPrisma.renewal.update.mockResolvedValue({});
      mockAuditService.logSimple.mockResolvedValue(undefined);

      await service.markNotRenewed(
        '1',
        { outcomeNotes: 'Client chose different vendor' },
        'user-1'
      );

      expect(mockPrisma.renewal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'NOT_RENEWED' }),
        })
      );
    });

    it('should NOT allow marking RENEWED as NOT_RENEWED', async () => {
      mockPrisma.renewal.findUnique.mockResolvedValue({
        id: '1',
        contractId: 'c1',
        status: 'RENEWED',
      });

      await expect(
        service.markNotRenewed('1', { outcomeNotes: 'Changed mind' }, 'user-1')
      ).rejects.toThrow('Cannot mark a renewed contract as not renewed');
    });
  });

  describe('processRenewal', () => {
    it('should process a PENDING renewal as RENEWED', async () => {
      mockPrisma.renewal.findUnique.mockResolvedValue({
        id: '1',
        contractId: 'c1',
        status: 'PENDING',
      });
      mockPrisma.renewal.update.mockResolvedValue({});
      mockAuditService.logSimple.mockResolvedValue(undefined);

      await service.processRenewal(
        '1',
        { renewedValue: 120000, outcomeNotes: 'Signed' },
        'user-1'
      );

      expect(mockPrisma.renewal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'RENEWED',
            renewedValue: 120000,
          }),
        })
      );
    });

    it('should NOT process an already RENEWED renewal', async () => {
      mockPrisma.renewal.findUnique.mockResolvedValue({
        id: '1',
        contractId: 'c1',
        status: 'RENEWED',
      });

      await expect(
        service.processRenewal('1', {}, 'user-1')
      ).rejects.toThrow('Renewal is already marked as renewed');
    });
  });
});
