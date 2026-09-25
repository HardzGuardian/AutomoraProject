import { Prisma } from '@prisma/client';
import { ReportService } from './report.service';

const actor = { id: 'manager-1', role: 'MANAGER' as const };

const clients = {
  'client-1': { id: 'client-1', companyName: 'Client One' },
  'client-2': { id: 'client-2', companyName: 'Client Two' },
};

const contracts = {
  'contract-1': { id: 'contract-1', contractNumber: 'AMC-1' },
};

function clientPort() {
  return {
    getById: jest.fn(),
    getByIds: jest.fn(async (ids: string[]) => {
      const map = new Map<string, unknown>();
      for (const id of ids) {
        if (clients[id as keyof typeof clients]) {
          map.set(id, clients[id as keyof typeof clients]);
        }
      }
      return map;
    }),
    countActive: jest.fn(),
  };
}

function contractPort() {
  return {
    getById: jest.fn(),
    getByIds: jest.fn(async (ids: string[]) => {
      const map = new Map<string, unknown>();
      for (const id of ids) {
        if (contracts[id as keyof typeof contracts]) {
          map.set(id, contracts[id as keyof typeof contracts]);
        }
      }
      return map;
    }),
    countByStatus: jest.fn(),
  };
}

function payment(amount: number, clientId: string, contractId: string | null) {
  return {
    amount: new Prisma.Decimal(amount),
    paidAt: new Date('2026-01-15'),
    invoice: {
      id: 'invoice-1',
      clientId,
      contractId,
      invoiceNumber: 'INV-1',
    },
  };
}

function service(payments: unknown[]) {
  const database = {
    payment: { findMany: jest.fn().mockResolvedValue(payments) },
  };
  return new ReportService(database as never, undefined as never, contractPort() as never, clientPort() as never);
}

describe('ReportService', () => {
  it('aggregates successful payments by client', async () => {
    const report = await service([
      payment(100, 'client-1', 'contract-1'),
      payment(50, 'client-1', 'contract-1'),
    ]).revenueByClient({ from: new Date('2026-01-01'), to: new Date('2026-01-31') }, actor);

    expect(report.available).toBe(true);
    expect(report.rows).toEqual([
      { id: 'client-1', label: 'Client One', amount: 150, paymentCount: 2 },
    ]);
  });

  it('separates clients in a revenue-by-client report', async () => {
    const report = await service([
      payment(100, 'client-1', 'contract-1'),
      payment(70, 'client-2', null),
    ]).revenueByClient({}, actor);

    expect(report.rows).toEqual([
      { id: 'client-1', label: 'Client One', amount: 100, paymentCount: 1 },
      { id: 'client-2', label: 'Client Two', amount: 70, paymentCount: 1 },
    ]);
  });

  it('resolves the contract number through the contract port', async () => {
    const report = await service([payment(100, 'client-1', 'contract-1')]).revenueByContract(
      {},
      actor
    );

    expect(report.rows).toEqual([
      { id: 'contract-1', label: 'AMC-1', amount: 100, paymentCount: 1 },
    ]);
  });

  it('falls back to the invoice number when a payment has no contract', async () => {
    const report = await service([payment(100, 'client-1', null)]).revenueByContract(
      {},
      actor
    );

    expect(report.rows).toEqual([
      { id: 'invoice-1', label: 'INV-1', amount: 100, paymentCount: 1 },
    ]);
  });

  it('groups by paid month for a revenue-by-period report', async () => {
    const report = await service([payment(100, 'client-1', 'contract-1')]).revenueByPeriod(
      {},
      actor
    );

    expect(report.rows).toEqual([
      { id: '2026-01', label: '2026-01', amount: 100, paymentCount: 1 },
    ]);
  });

  it('does not query Person 2 tables directly', async () => {
    const database = { payment: { findMany: jest.fn().mockResolvedValue([payment(10, 'client-1', 'contract-1')]) } };
    const contracts2 = contractPort();
    const clients2 = clientPort();
    const svc = new ReportService(database as never, undefined as never, contracts2 as never, clients2 as never);

    await svc.revenueByClient({}, actor);

    expect(clients2.getByIds).toHaveBeenCalledWith(['client-1']);
    expect(contracts2.getByIds).toHaveBeenCalledWith(['contract-1']);
  });

  it('returns an honest unavailable result for absent Person 3 data', async () => {
    const report = await service([]).technicianPerformance({}, actor);

    expect(report.available).toBe(false);
    expect(report.reason).toContain('Person 3');
  });

  it('rejects a technician role', async () => {
    await expect(
      service([]).revenueByClient({}, { id: 'tech-1', role: 'TECHNICIAN' })
    ).rejects.toThrow('Report access is not permitted');
  });
});
