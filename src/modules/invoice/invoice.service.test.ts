import { InvoiceService } from './invoice.service';
import { auditService } from '../audit/audit.service';

jest.mock('../audit/audit.service', () => ({
  auditService: {
    log: jest.fn().mockResolvedValue(undefined),
    logSimple: jest.fn().mockResolvedValue(undefined),
  },
}));

const CLIENT_PROJECTION = {
  id: 'client-1',
  companyName: 'Client One',
  email: 'client@example.com',
  phone: '+919999999999',
};

const CLIENT = { ...CLIENT_PROJECTION, deletedAt: null };

const CONTRACT = {
  id: 'contract-1',
  contractNumber: 'AMC-1',
  clientId: 'client-1',
  status: 'ACTIVE' as const,
  value: 1000,
  paymentTerms: null,
  billingFrequency: null,
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-12-31'),
  client: { id: 'client-1', companyName: 'Client One', email: 'client@example.com', phone: null },
};

function clientPort(overrides: Record<string, unknown> = {}) {
  return {
    getById: jest.fn().mockResolvedValue(CLIENT),
    getByIds: jest.fn(async (ids: string[]) => {
      const map = new Map<string, unknown>();
      for (const id of ids) if (id === CLIENT.id) map.set(id, CLIENT);
      return map;
    }),
    countActive: jest.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function contractPort(overrides: Record<string, unknown> = {}) {
  return {
    getById: jest.fn().mockResolvedValue(CONTRACT),
    getByIds: jest.fn(async (ids: string[]) => {
      const map = new Map<string, unknown>();
      for (const id of ids) if (id === CONTRACT.id) map.set(id, CONTRACT);
      return map;
    }),
    countByStatus: jest.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function invoiceRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'invoice-1',
    status: 'ISSUED',
    dueDate: new Date('2020-01-01'),
    clientId: 'client-1',
    contractId: 'contract-1',
    invoiceNumber: 'INV-1',
    totalAmount: { toString: () => '100' },
    balanceAmount: { toString: () => '100' },
    issueDate: new Date('2020-01-01'),
    currency: 'INR',
    notes: null,
    items: [],
    payments: [],
    ...overrides,
  };
}

describe('InvoiceService', () => {
  const contractReader = contractPort();
  const clientReader = clientPort();
  const notifications = { send: jest.fn().mockResolvedValue({ status: 'SKIPPED' }) };
  const accounting = {
    name: 'test-accounting',
    syncInvoice: jest.fn().mockResolvedValue({ status: 'SKIPPED', provider: 'test-accounting' }),
    syncPayment: jest.fn(),
  };
  const database = {
    invoice: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };

  function build() {
    return new InvoiceService(
      database as never,
      contractReader as never,
      clientReader as never,
      accounting as never,
      notifications as never
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    contractReader.getById.mockResolvedValue(CONTRACT);
    clientReader.getById.mockResolvedValue(CLIENT);
  });

  it('marks a past-due invoice as overdue', async () => {
    const invoice = invoiceRecord();
    database.invoice.findUnique.mockResolvedValue(invoice);
    database.invoice.update.mockResolvedValue(invoiceRecord({ status: 'OVERDUE' }));

    const result = await build().markOverdue('invoice-1');

    expect(result.status).toBe('OVERDUE');
    expect(database.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'invoice-1' },
        data: { status: 'OVERDUE' },
      })
    );
    expect(auditService.log).toHaveBeenCalled();
  });

  it('rejects customer access to financial data', async () => {
    await expect(
      build().getById('invoice-1', { id: 'customer-1', role: 'CUSTOMER' })
    ).rejects.toThrow('Financial access is not permitted');
  });

  it('re-attaches the client and contract projections through the ports', async () => {
    database.invoice.findUnique.mockResolvedValue(invoiceRecord());

    const invoice = await build().getById('invoice-1');

    expect(clientReader.getById).toHaveBeenCalledWith('client-1');
    expect(contractReader.getById).toHaveBeenCalledWith('contract-1');
    expect(invoice.client).toEqual(CLIENT_PROJECTION);
    expect(invoice.contract).toEqual({ id: 'contract-1', contractNumber: 'AMC-1' });
  });

  it('returns null projections when the ports resolve nothing', async () => {
    database.invoice.findUnique.mockResolvedValue(invoiceRecord());
    clientReader.getById.mockResolvedValue(null);
    contractReader.getById.mockResolvedValue(null);

    const invoice = await build().getById('invoice-1');

    expect(invoice.client).toBeNull();
    expect(invoice.contract).toBeNull();
  });

  it('does not join Person 2 tables in the Prisma query', async () => {
    database.invoice.findUnique.mockResolvedValue(invoiceRecord());

    await build().getById('invoice-1');

    const query = database.invoice.findUnique.mock.calls[0][0];
    expect(query.include).toEqual({
      items: { orderBy: { createdAt: 'asc' } },
      payments: { orderBy: { createdAt: 'desc' } },
    });
    expect(query.include).not.toHaveProperty('client');
    expect(query.include).not.toHaveProperty('contract');
  });

  it('decorates a page of invoices with two batched port lookups', async () => {
    database.invoice.findMany.mockResolvedValue([
      invoiceRecord(),
      invoiceRecord({ id: 'invoice-2', invoiceNumber: 'INV-2' }),
    ]);
    database.invoice.count.mockResolvedValue(2);

    const result = await build().list({ page: 1, limit: 10 }, { id: 'admin-1', role: 'ADMIN' });

    expect(result.invoices).toHaveLength(2);
    expect(clientReader.getByIds).toHaveBeenCalledTimes(1);
    expect(contractReader.getByIds).toHaveBeenCalledTimes(1);
    expect(result.invoices[0].client).toEqual(CLIENT_PROJECTION);
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 2, pages: 1 });
  });

  it('lists overdue candidates resolved through the client port', async () => {
    database.invoice.findMany.mockResolvedValue([
      invoiceRecord({ status: 'PARTIALLY_PAID', balanceAmount: { toString: () => '40' } }),
    ]);

    const candidates = await build().listOverdueCandidates();

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual(
      expect.objectContaining({
        id: 'invoice-1',
        invoiceNumber: 'INV-1',
        clientName: 'Client One',
        email: 'client@example.com',
        phone: '+919999999999',
      })
    );
    expect(clientReader.getByIds).toHaveBeenCalledWith(['client-1']);
  });

  it('queries only past-due invoices carrying a balance', async () => {
    database.invoice.findMany.mockResolvedValue([]);

    await build().listOverdueCandidates();

    const where = database.invoice.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ['ISSUED', 'PARTIALLY_PAID'] });
    expect(where.balanceAmount).toEqual({ gt: 0 });
    expect(where.dueDate.lt).toBeInstanceOf(Date);
  });

  it('notifies the client using the port-resolved email when issuing', async () => {
    const draft = invoiceRecord({ status: 'DRAFT' });
    database.invoice.findUnique.mockResolvedValue(draft);
    database.invoice.update.mockResolvedValue(invoiceRecord({ status: 'ISSUED' }));

    await build().update('invoice-1', { status: 'ISSUED' }, { id: 'admin-1', role: 'ADMIN' });

    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'invoice-issued:invoice-1',
        recipient: 'client@example.com',
      })
    );
  });

  it('refuses to return an issued invoice to draft', async () => {
    database.invoice.findUnique.mockResolvedValue(invoiceRecord({ status: 'ISSUED' }));

    await expect(
      build().update('invoice-1', { status: 'DRAFT' }, { id: 'admin-1', role: 'ADMIN' })
    ).rejects.toThrow('An issued invoice cannot be returned to draft');
  });

  it('refuses to edit a settled invoice', async () => {
    database.invoice.findUnique.mockResolvedValue(invoiceRecord({ status: 'PAID' }));

    await expect(
      build().update('invoice-1', { notes: 'x' }, { id: 'admin-1', role: 'ADMIN' })
    ).rejects.toThrow('A settled or cancelled invoice cannot be edited');
  });
});
