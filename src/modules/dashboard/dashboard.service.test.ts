import { Prisma } from '@prisma/client';
import { DashboardService } from './dashboard.service';

function contractPort(activeCount: number, expiringCount: number) {
  return {
    getById: jest.fn(),
    getByIds: jest.fn(),
    countByStatus: jest.fn(async (status: string) =>
      status === 'ACTIVE' ? activeCount : expiringCount
    ),
  };
}

function clientPort(activeCount: number) {
  return {
    getById: jest.fn(),
    getByIds: jest.fn(),
    countActive: jest.fn().mockResolvedValue(activeCount),
  };
}

const database = {
  invoice: {
    aggregate: jest.fn().mockResolvedValue({
      _count: { _all: 4 },
      _sum: {
        balanceAmount: new Prisma.Decimal(500),
        paidAmount: new Prisma.Decimal(1500),
      },
    }),
    count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2),
  },
  payment: {
    aggregate: jest.fn().mockResolvedValue({
      _count: { _all: 3 },
      _sum: { amount: new Prisma.Decimal(1500) },
    }),
  },
};

describe('DashboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database.invoice.aggregate.mockResolvedValue({
      _count: { _all: 4 },
      _sum: {
        balanceAmount: new Prisma.Decimal(500),
        paidAmount: new Prisma.Decimal(1500),
      },
    });
    database.invoice.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    database.payment.aggregate.mockResolvedValue({
      _count: { _all: 3 },
      _sum: { amount: new Prisma.Decimal(1500) },
    });
  });

  it('returns a read-only financial and contract summary', async () => {
    const service = new DashboardService(
      database as never,
      contractPort(5, 1) as never,
      clientPort(7) as never
    );
    const result = await service.getSummary({ id: 'admin-1', role: 'ADMIN' });

    expect(result.finance.outstandingAmount).toBe(500);
    expect(result.finance.paymentAmount).toBe(1500);
    expect(result.contracts).toEqual({ activeCount: 5, expiringSoonCount: 1 });
    expect(result.clients.activeCount).toBe(7);
    expect(result.operational.available).toBe(false);
  });

  it('reads Person 2 contract and client counts through the integration ports', async () => {
    const contracts = contractPort(5, 1);
    const clients = clientPort(7);
    const service = new DashboardService(database as never, contracts as never, clients as never);

    await service.getSummary({ id: 'admin-1', role: 'ADMIN' });

    expect(contracts.countByStatus).toHaveBeenCalledWith('ACTIVE');
    expect(contracts.countByStatus).toHaveBeenCalledWith('EXPIRING_SOON');
    expect(clients.countActive).toHaveBeenCalledTimes(1);
  });

  it('rejects a customer role', async () => {
    const service = new DashboardService(database as never);
    await expect(
      service.getSummary({ id: 'customer-1', role: 'CUSTOMER' })
    ).rejects.toThrow('Dashboard access is not permitted');
  });
});
