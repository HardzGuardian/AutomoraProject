import { randomUUID } from 'crypto';
import { PaymentStatus, Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../config/constants';
import { ApiError } from '../../utils/ApiError';
import { auditService } from '../audit/audit.service';
import { notificationService } from '../notification/notification.service';
import {
  accountingProvider,
  AccountingProvider,
} from '../integrations/accounting/accounting.provider';
import {
  GatewayPaymentInput,
  GatewayPaymentResult,
  paymentGatewayProvider,
  PaymentGatewayProvider,
} from '../integrations/payment-gateway/paymentGateway.provider';
import {
  ClientReadPort,
  clientReadPort,
} from '../integrations/client/client.port';
import {
  ListPaymentsQuery,
  PaymentActor,
  RecordPaymentInput,
} from './payment.types';
import { calculatePaymentApplication } from './payment.utils';


const FINANCIAL_ROLES = new Set(['ADMIN', 'MANAGER', 'SALES']);

export class PaymentService {
  constructor(
    private readonly database: typeof prisma = prisma,
    private readonly notifications = notificationService,
    private readonly accounting: AccountingProvider = accountingProvider,
    private readonly gateway: PaymentGatewayProvider = paymentGatewayProvider,
    private readonly clients: ClientReadPort = clientReadPort
  ) {}

  async record(data: RecordPaymentInput, actor: PaymentActor) {
    this.assertFinancialRole(actor);
    const invoice = await this.database.invoice.findUnique({
      where: { id: data.invoiceId },
      select: {
        id: true,
        clientId: true,
        status: true,
        currency: true,
        balanceAmount: true,
        totalAmount: true,
      },
    });
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status === 'DRAFT' || invoice.status === 'CANCELLED') {
      throw ApiError.badRequest('Payments cannot be applied to this invoice');
    }
    if (data.currency && data.currency.toUpperCase() !== invoice.currency.toUpperCase()) {
      throw ApiError.badRequest('Payment currency must match invoice currency');
    }

    const amount = new Prisma.Decimal(data.amount).toDecimalPlaces(2);
    if (amount.gt(0) === false) throw ApiError.badRequest('Payment amount must be positive');
    if (amount.gt(invoice.balanceAmount)) {
      throw ApiError.badRequest('Payment cannot exceed the invoice balance');
    }

    const status = data.status ?? PaymentStatus.SUCCESS;
    if (status !== PaymentStatus.PENDING && status !== PaymentStatus.SUCCESS) {
      throw ApiError.badRequest('Only pending or successful payments can be recorded');
    }

    const paidAt = status === PaymentStatus.SUCCESS ? data.paidAt ?? new Date() : data.paidAt;
    const paymentNumber = this.generatePaymentNumber();
    const payment = await this.database.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          paymentNumber,
          invoiceId: invoice.id,
          clientId: invoice.clientId,
          amount,
          currency: (data.currency ?? invoice.currency).toUpperCase(),
          method: data.method,
          status,
          gatewayName: data.gatewayName ?? this.gateway.name,
          gatewayPaymentId: data.gatewayPaymentId,
          gatewayReference: data.gatewayReference,
          paidAt,
          metadata: data.metadata as Prisma.InputJsonValue | undefined,
          receivedById: actor.id,
        },
        include: this.paymentInclude(),
      });

      if (status === PaymentStatus.SUCCESS) {
        await this.applyAmountToInvoice(tx, created.id, amount);
      }

      return tx.payment.findUnique({
        where: { id: created.id },
        include: this.paymentInclude(),
      });
    });

    if (!payment) throw ApiError.internal('Payment could not be created');

    await this.audit(actor, AUDIT_ACTIONS.PAYMENT_RECORDED, payment.id, {
      paymentNumber: payment.paymentNumber,
      invoiceId: payment.invoiceId,
      amount: payment.amount.toString(),
      status: payment.status,
    });

    if (payment.status === PaymentStatus.SUCCESS) {
      await this.syncAccounting(payment);
      await this.sendPaymentReceived(payment);
    }

    return this.decorateClient(payment);
  }

  async getById(id: string, actor?: PaymentActor) {
    if (actor) this.assertFinancialRole(actor);
    const payment = await this.database.payment.findUnique({
      where: { id },
      include: {
        invoice: { select: { id: true, invoiceNumber: true, clientId: true } },
        receivedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!payment) throw ApiError.notFound('Payment not found');
    return this.decorateClient(payment);
  }

  async list(query: ListPaymentsQuery, actor: PaymentActor) {
    this.assertFinancialRole(actor);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.PaymentWhereInput = {};
    if (query.invoiceId) where.invoiceId = query.invoiceId;
    if (query.clientId) where.clientId = query.clientId;
    if (query.status) where.status = query.status;
    if (query.method) where.method = query.method;
    if (query.from || query.to) {
      where.paidAt = {};
      if (query.from) where.paidAt.gte = query.from;
      if (query.to) where.paidAt.lte = query.to;
    }

    const [payments, total] = await Promise.all([
      this.database.payment.findMany({
        where,
        include: { invoice: { select: { invoiceNumber: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.database.payment.count({ where }),
    ]);

    return {
      payments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async createGatewayPayment(
    input: GatewayPaymentInput,
    actor: PaymentActor
  ): Promise<GatewayPaymentResult> {
    this.assertFinancialRole(actor);
    return this.gateway.createPayment(input);
  }

  async processWebhook(rawBody: Buffer, signature: string) {
    if (!this.gateway.verifyWebhookSignature(rawBody, signature)) {
      throw ApiError.unauthorized('Invalid payment gateway signature');
    }

    const event = this.gateway.parseWebhookEvent(rawBody);
    const gatewayPaymentId =
      typeof event.data.gatewayPaymentId === 'string'
        ? event.data.gatewayPaymentId
        : typeof event.data.paymentId === 'string'
          ? event.data.paymentId
          : undefined;
    if (!gatewayPaymentId) {
      throw ApiError.badRequest('Webhook event is missing a payment reference');
    }

    const status = this.statusFromWebhookType(event.type);
    if (!status) return { ignored: true, eventId: event.id };

    const existing = await this.database.payment.findFirst({
      where: {
        gatewayPaymentId,
        gatewayName: event.data.gatewayName
          ? String(event.data.gatewayName)
          : this.gateway.name,
      },
    });
    if (!existing) throw ApiError.notFound('Payment referenced by webhook was not found');

    if (event.data.amount !== undefined) {
      const eventAmount = new Prisma.Decimal(String(event.data.amount));
      if (!eventAmount.equals(existing.amount)) {
        throw ApiError.badRequest('Webhook amount does not match the recorded payment');
      }
    }

    if (existing.appliedAt && status !== PaymentStatus.SUCCESS) {
      return { ignored: true, eventId: event.id, paymentId: existing.id };
    }
    if (existing.status === status && existing.appliedAt) {
      return { ignored: true, eventId: event.id, paymentId: existing.id };
    }

    const payment = await this.database.$transaction(async (tx) => {
      if (status === PaymentStatus.SUCCESS && !existing.appliedAt) {
        await this.applyAmountToInvoice(tx, existing.id, existing.amount);
      }
      return tx.payment.update({
        where: { id: existing.id },
        data: {
          status,
          paidAt: status === PaymentStatus.SUCCESS ? existing.paidAt ?? new Date() : existing.paidAt,
          failureReason: status === PaymentStatus.FAILED ? 'Gateway reported failure' : existing.failureReason,
        },
        include: this.paymentInclude(),
      });
    });

    await this.audit(undefined, AUDIT_ACTIONS.PAYMENT_STATUS_CHANGED, payment.id, {
      gatewayPaymentId,
      eventId: event.id,
      status,
    });
    if (status === PaymentStatus.SUCCESS) {
      await this.syncAccounting(payment);
      await this.sendPaymentReceived(payment);
    }
    return this.decorateClient(payment);
  }

  // The client is attached separately by decorateClient() via the client port.
  private paymentInclude() {
    return {
      invoice: { select: { id: true, invoiceNumber: true, clientId: true } },
    };
  }

  private async decorateClient<
    T extends { invoice?: { id: string; clientId: string } | null }
  >(payment: T) {
    if (!payment.invoice) return payment;

    const client = await this.clients.getById(payment.invoice.clientId);
    return {
      ...payment,
      invoice: {
        ...payment.invoice,
        client: client
          ? {
              id: client.id,
              companyName: client.companyName,
              email: client.email,
              phone: client.phone,
            }
          : null,
      },
    };
  }

  private async applyAmountToInvoice(
    tx: Prisma.TransactionClient,
    paymentId: string,
    amount: Prisma.Decimal
  ): Promise<void> {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw ApiError.notFound('Payment not found');
    if (payment.appliedAt) return;

    const invoice = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status === 'DRAFT' || invoice.status === 'CANCELLED') {
      throw ApiError.badRequest('Payment cannot be applied to this invoice');
    }
    if (amount.gt(invoice.balanceAmount)) {
      throw ApiError.badRequest('Payment cannot exceed the invoice balance');
    }

    const application = calculatePaymentApplication(
      invoice.paidAmount,
      invoice.totalAmount,
      amount
    );
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: application.paidAmount,
        balanceAmount: application.balanceAmount,
        status: application.status,
      },
    });
    await tx.payment.update({
      where: { id: paymentId },
      data: { appliedAt: new Date() },
    });
  }

  private statusFromWebhookType(type: string): PaymentStatus | null {
    const normalized = type.toLowerCase();
    if (normalized.includes('succeeded') || normalized.includes('paid')) {
      return PaymentStatus.SUCCESS;
    }
    if (normalized.includes('failed')) return PaymentStatus.FAILED;
    if (normalized.includes('cancelled') || normalized.includes('canceled')) {
      return PaymentStatus.CANCELLED;
    }
    return null;
  }

  private generatePaymentNumber(): string {
    return `PAY-${new Date().getUTCFullYear()}-${randomUUID()
      .replace(/-/g, '')
      .slice(0, 10)
      .toUpperCase()}`;
  }

  private assertFinancialRole(actor: PaymentActor): void {
    if (!FINANCIAL_ROLES.has(actor.role)) {
      throw ApiError.forbidden('Financial access is not permitted for this role');
    }
  }

  private async syncAccounting(payment: {
    id: string;
    invoiceId: string;
    clientId: string;
    amount: Prisma.Decimal;
    currency: string;
    paidAt: Date | null;
  }): Promise<void> {
    try {
      await this.accounting.syncPayment({
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        clientId: payment.clientId,
        amount: payment.amount.toString(),
        currency: payment.currency,
        paidAt: payment.paidAt,
      });
    } catch {
      await this.audit(undefined, AUDIT_ACTIONS.INTEGRATION_SYNCED, payment.id, {
        provider: this.accounting.name,
        status: 'FAILED',
      });
    }
  }

  private async sendPaymentReceived(payment: {
    id: string;
    amount: Prisma.Decimal;
    invoice: { invoiceNumber: string; clientId: string };
  }): Promise<void> {
    const client = await this.clients.getById(payment.invoice.clientId);
    if (!client?.email) return;
    await this.notifications.send({
      eventKey: `payment-received:${payment.id}`,
      channel: 'EMAIL',
      recipient: client.email,
      subject: `Payment received: ${payment.invoice.invoiceNumber}`,
      message: `We received your payment of ${payment.amount.toString()}.`,
      relatedId: payment.id,
    });
  }

  private async audit(
    actor: PaymentActor | undefined,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await auditService.log({
      userId: actor?.id,
      action,
      entity: AUDIT_ENTITIES.PAYMENT,
      entityId,
      metadata,
    });
  }
}

export const paymentService = new PaymentService();






