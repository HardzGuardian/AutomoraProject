jest.mock('../audit/audit.service', () => ({
  auditService: {
    log: jest.fn().mockResolvedValue(undefined),
    logSimple: jest.fn().mockResolvedValue(undefined),
  },
}));
import { Prisma, PaymentStatus } from '@prisma/client';
import { PaymentService } from './payment.service';

const actor = { id: 'admin-1', role: 'ADMIN' as const };

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function clientPort(email: string | null = null) {
  return {
    getById: jest.fn().mockResolvedValue(
      email ? { id: 'client-1', companyName: 'Client', email, phone: null, deletedAt: null } : null
    ),
    getByIds: jest.fn().mockResolvedValue(new Map()),
    countActive: jest.fn().mockResolvedValue(0),
  };
}

function createHarness(options: { clientEmail?: string | null } = {}) {
  const invoice = {
    id: 'invoice-1',
    clientId: 'client-1',
    status: 'ISSUED',
    currency: 'INR',
    balanceAmount: decimal(1000),
    totalAmount: decimal(1000),
    paidAmount: decimal(0),
  };
  const payment: Record<string, unknown> = {
    id: 'payment-1',
    paymentNumber: 'PAY-1',
    invoiceId: invoice.id,
    clientId: invoice.clientId,
    amount: decimal(250),
    currency: 'INR',
    status: PaymentStatus.SUCCESS,
    paidAt: new Date(),
    appliedAt: null,
    gatewayName: null,
    gatewayPaymentId: null,
    failureReason: null,
    invoice: { id: 'invoice-1', invoiceNumber: 'INV-1', clientId: 'client-1' },
  };

  const tx = {
    payment: {
      create: jest.fn().mockImplementation(() => Promise.resolve(payment)),
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(payment)),
      update: jest.fn().mockImplementation(({ data }) => {
        Object.assign(payment, data);
        return Promise.resolve(payment);
      }),
    },
    invoice: {
      findUnique: jest.fn().mockResolvedValue(invoice),
      update: jest.fn().mockImplementation(({ data }) => {
        Object.assign(invoice, data);
        return Promise.resolve(invoice);
      }),
    },
  };

  const database = {
    invoice: { findUnique: jest.fn().mockResolvedValue(invoice) },
    payment: {
      findUnique: jest.fn().mockResolvedValue(payment),
      findFirst: jest.fn().mockResolvedValue(payment),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };

  const notifications = { send: jest.fn().mockResolvedValue({ status: 'SKIPPED' }) };
  const accounting = {
    name: 'test-accounting',
    syncInvoice: jest.fn(),
    syncPayment: jest.fn().mockResolvedValue({ status: 'SKIPPED', provider: 'test-accounting' }),
  };
  const gateway = {
    name: 'test-gateway',
    createPayment: jest.fn(),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
    parseWebhookEvent: jest.fn(),
  };
  const clients = clientPort(options.clientEmail ?? null);

  return {
    service: new PaymentService(
      database as never,
      notifications as never,
      accounting as never,
      gateway as never,
      clients as never
    ),
    database,
    invoice,
    payment,
    tx,
    notifications,
    gateway,
    clients,
  };
}

describe('PaymentService', () => {
  it('applies a partial payment and updates the invoice balance', async () => {
    const harness = createHarness();

    await harness.service.record(
      { invoiceId: 'invoice-1', amount: 250, method: 'BANK_TRANSFER' },
      actor
    );

    expect(harness.invoice.paidAmount.toNumber()).toBe(250);
    expect(harness.invoice.balanceAmount.toNumber()).toBe(750);
    expect(harness.invoice.status).toBe('PARTIALLY_PAID');
  });

  it('marks an invoice PAID when the final payment is applied', async () => {
    const harness = createHarness();
    harness.invoice.paidAmount = decimal(750);
    harness.invoice.balanceAmount = decimal(250);

    await harness.service.record(
      { invoiceId: 'invoice-1', amount: 250, method: 'UPI' },
      actor
    );

    expect(harness.invoice.balanceAmount.toNumber()).toBe(0);
    expect(harness.invoice.status).toBe('PAID');
  });

  it('keeps a sub-paisa residue as PARTIALLY_PAID rather than PAID', async () => {
    const harness = createHarness();
    harness.invoice.paidAmount = decimal(999);
    harness.invoice.balanceAmount = decimal(1);
    harness.invoice.totalAmount = decimal(1000);

    await harness.service.record(
      { invoiceId: 'invoice-1', amount: 0.5, method: 'UPI' },
      actor
    );

    expect(harness.invoice.status).toBe('PARTIALLY_PAID');
  });

  it('rejects a payment larger than the invoice balance', async () => {
    const harness = createHarness();

    await expect(
      harness.service.record(
        { invoiceId: 'invoice-1', amount: 5000, method: 'CASH' },
        actor
      )
    ).rejects.toThrow('Payment cannot exceed the invoice balance');
  });

  it('rejects a non-positive payment amount', async () => {
    const harness = createHarness();

    await expect(
      harness.service.record(
        { invoiceId: 'invoice-1', amount: 0, method: 'CASH' },
        actor
      )
    ).rejects.toThrow('Payment amount must be positive');
  });

  it('rejects a payment in a different currency', async () => {
    const harness = createHarness();

    await expect(
      harness.service.record(
        { invoiceId: 'invoice-1', amount: 100, method: 'CASH', currency: 'USD' },
        actor
      )
    ).rejects.toThrow('Payment currency must match invoice currency');
  });

  it('refuses to apply a payment to a DRAFT invoice', async () => {
    const harness = createHarness();
    harness.invoice.status = 'DRAFT';

    await expect(
      harness.service.record(
        { invoiceId: 'invoice-1', amount: 100, method: 'CASH' },
        actor
      )
    ).rejects.toThrow('Payments cannot be applied to this invoice');
  });

  it('leaves the invoice untouched for a PENDING payment', async () => {
    const harness = createHarness();

    await harness.service.record(
      { invoiceId: 'invoice-1', amount: 250, method: 'UPI', status: 'PENDING' },
      actor
    );

    expect(harness.tx.invoice.update).not.toHaveBeenCalled();
    expect(harness.invoice.paidAmount.toNumber()).toBe(0);
  });

  it('does not apply the same payment twice', async () => {
    const harness = createHarness();
    await harness.service.record(
      { invoiceId: 'invoice-1', amount: 250, method: 'CASH' },
      actor
    );
    // Mark the payment as already applied, as the first run would have.
    harness.payment.appliedAt = new Date();
    const updatesBefore = harness.tx.invoice.update.mock.calls.length;

    await harness.service.record(
      { invoiceId: 'invoice-1', amount: 250, method: 'CASH' },
      actor
    );

    expect(harness.tx.invoice.update.mock.calls.length).toBe(updatesBefore);
  });

  it('notifies the payer using the client port rather than a Prisma join', async () => {
    const harness = createHarness({ clientEmail: 'client@example.com' });

    const result = await harness.service.record(
      { invoiceId: 'invoice-1', amount: 250, method: 'CASH' },
      actor
    );

    expect(harness.clients.getById).toHaveBeenCalledWith('client-1');
    expect(harness.notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'client@example.com' })
    );
    // The Person 2 owned client is still exposed on the response, under invoice.
    expect((result as unknown as { invoice: { client: unknown } }).invoice.client).toEqual({
      id: 'client-1',
      companyName: 'Client',
      email: 'client@example.com',
      phone: null,
    });
  });

  it('rejects a customer role', async () => {
    const harness = createHarness();
    await expect(
      harness.service.record(
        { invoiceId: 'invoice-1', amount: 10, method: 'CASH' },
        { id: 'customer-1', role: 'CUSTOMER' }
      )
    ).rejects.toThrow('Financial access is not permitted');
  });
});

describe('PaymentService.processWebhook', () => {
  function webhookHarness() {
    const harness = createHarness();
    harness.gateway.parseWebhookEvent.mockReturnValue({
      id: 'evt-1',
      type: 'payment.succeeded',
      data: { gatewayPaymentId: 'gw-1', amount: '250' },
    });
    return harness;
  }

  it('rejects an invalid gateway signature', async () => {
    const harness = webhookHarness();
    harness.gateway.verifyWebhookSignature.mockReturnValue(false);

    await expect(
      harness.service.processWebhook(Buffer.from('{}'), 'bad-signature')
    ).rejects.toThrow('Invalid payment gateway signature');
  });

  it('ignores an unrecognised webhook event type', async () => {
    const harness = webhookHarness();
    harness.gateway.parseWebhookEvent.mockReturnValue({
      id: 'evt-1',
      type: 'customer.updated',
      data: { gatewayPaymentId: 'gw-1' },
    });

    const result = await harness.service.processWebhook(Buffer.from('{}'), 'sig');

    expect(result).toEqual({ ignored: true, eventId: 'evt-1' });
  });

  it('rejects a webhook whose amount does not match the recorded payment', async () => {
    const harness = webhookHarness();
    harness.gateway.parseWebhookEvent.mockReturnValue({
      id: 'evt-1',
      type: 'payment.succeeded',
      data: { gatewayPaymentId: 'gw-1', amount: '999' },
    });

    await expect(
      harness.service.processWebhook(Buffer.from('{}'), 'sig')
    ).rejects.toThrow('Webhook amount does not match the recorded payment');
  });

  it('is a no-op when a webhook replays an already applied payment', async () => {
    const harness = webhookHarness();
    harness.payment.appliedAt = new Date();
    harness.payment.status = PaymentStatus.SUCCESS;

    const result = await harness.service.processWebhook(Buffer.from('{}'), 'sig');

    expect(result).toEqual({
      ignored: true,
      eventId: 'evt-1',
      paymentId: 'payment-1',
    });
  });
});
