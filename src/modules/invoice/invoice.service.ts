import { InvoiceSourceType, Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../config/constants';
import { ApiError } from '../../utils/ApiError';
import { DateHelpers } from '../../utils/dateHelpers';
import { auditService } from '../audit/audit.service';
import { notificationService } from '../notification/notification.service';
import { ClientReadPort, clientReadPort } from '../integrations/client/client.port';
import { ContractReadPort, contractReadPort } from '../integrations/contract/contract.port';
import { accountingProvider, AccountingProvider } from '../integrations/accounting/accounting.provider';
import {
  CreateInvoiceInput,
  InvoiceActor,
  ListInvoicesQuery,
  OverdueInvoiceCandidate,
  UpdateInvoiceInput,
} from './invoice.types';
import {
  calculateInvoiceTotals,
  generateInvoiceNumber,
} from './invoice.utils';

const FINANCIAL_ROLES = new Set(['ADMIN', 'MANAGER', 'SALES']);

export class InvoiceService {
  constructor(
    private readonly database: typeof prisma = prisma,
    private readonly contracts: ContractReadPort = contractReadPort,
    private readonly clients: ClientReadPort = clientReadPort,
    private readonly accounting: AccountingProvider = accountingProvider,
    private readonly notifications = notificationService
  ) {}

  async create(data: CreateInvoiceInput, actor: InvoiceActor) {
    this.assertFinancialRole(actor);

    if (!data.clientId && !data.contractId) {
      throw ApiError.badRequest('A clientId or contractId is required');
    }
    if (data.sourceType !== 'CONTRACT' && !data.sourceId) {
      throw ApiError.badRequest('sourceId is required for visit and milestone invoices');
    }

    let clientId = data.clientId;
    let contractSnapshot = null;
    if (data.contractId) {
      contractSnapshot = await this.contracts.getById(data.contractId);
      if (!contractSnapshot) throw ApiError.notFound('Contract not found');
      if (clientId && clientId !== contractSnapshot.clientId) {
        throw ApiError.badRequest('Invoice client does not match contract client');
      }
      clientId = contractSnapshot.clientId;

      if (['DRAFT', 'CANCELLED', 'EXPIRED'].includes(contractSnapshot.status)) {
        throw ApiError.badRequest(
          `Cannot create an invoice for a ${contractSnapshot.status} contract`
        );
      }
    }

    if (!clientId) throw ApiError.badRequest('A clientId is required');
    const client = await this.clients.getById(clientId);
    if (!client) throw ApiError.notFound('Client not found');

    const totals = calculateInvoiceTotals(data.items, data.taxRate ?? 0);
    const invoice = await this.database.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(),
        clientId,
        contractId: data.contractId,
        sourceType: data.sourceType as InvoiceSourceType,
        sourceId: data.sourceId ?? (data.sourceType === 'CONTRACT' ? data.contractId : undefined),
        issueDate: data.issueDate ?? new Date(),
        dueDate: data.dueDate,
        currency: (data.currency ?? 'INR').toUpperCase(),
        status: 'ISSUED',
        subtotal: totals.subtotal,
        taxRate: new Prisma.Decimal(data.taxRate ?? 0).toDecimalPlaces(2),
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        paidAmount: new Prisma.Decimal(0),
        balanceAmount: totals.totalAmount,
        notes: data.notes,
        createdById: actor.id,
        items: {
          create: totals.lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            lineSubtotal: line.lineSubtotal,
            taxAmount: line.taxAmount,
            lineTotal: line.lineTotal,
          })),
        },
      },
      include: this.invoiceInclude(),
    });

    await this.audit(actor, AUDIT_ACTIONS.INVOICE_CREATED, invoice.id, {
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount.toString(),
      clientId: invoice.clientId,
    });
    await this.syncAccounting(invoice);
    await this.sendIssuedNotification(invoice);

    return this.decorate(invoice);
  }

  async list(query: ListInvoicesQuery, actor: InvoiceActor) {
    this.assertFinancialRole(actor);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.InvoiceWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.clientId) where.clientId = query.clientId;
    if (query.contractId) where.contractId = query.contractId;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.from || query.to) {
      where.issueDate = {};
      if (query.from) where.issueDate.gte = query.from;
      if (query.to) where.issueDate.lte = query.to;
    }

    const [invoices, total] = await Promise.all([
      this.database.invoice.findMany({
        where,
        include: this.invoiceInclude(),
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { issueDate: 'desc' },
      }),
      this.database.invoice.count({ where }),
    ]);

    return {
      invoices: await this.decorateMany(invoices),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string, actor?: InvoiceActor) {
    if (actor) this.assertFinancialRole(actor);
    const invoice = await this.database.invoice.findUnique({
      where: { id },
      include: this.invoiceInclude(),
    });
    if (!invoice) throw ApiError.notFound('Invoice not found');
    return this.decorate(invoice);
  }

  async update(id: string, data: UpdateInvoiceInput, actor: InvoiceActor) {
    this.assertFinancialRole(actor);
    const existing = await this.getById(id, actor);
    if (['PAID', 'CANCELLED', 'OVERDUE'].includes(existing.status)) {
      throw ApiError.badRequest('A settled or cancelled invoice cannot be edited');
    }
    if (data.status === 'DRAFT' && existing.status !== 'DRAFT') {
      throw ApiError.badRequest('An issued invoice cannot be returned to draft');
    }
    if (data.status === 'ISSUED' && existing.status !== 'DRAFT') {
      throw ApiError.badRequest('Only draft invoices can be issued');
    }

    const invoice = await this.database.invoice.update({
      where: { id },
      data: {
        dueDate: data.dueDate,
        notes: data.notes,
        status: data.status,
      },
      include: this.invoiceInclude(),
    });

    await this.audit(actor, AUDIT_ACTIONS.INVOICE_UPDATED, id, {
      previousStatus: existing.status,
      status: invoice.status,
    });
    if (invoice.status === 'ISSUED' && existing.status !== 'ISSUED') {
      await this.sendIssuedNotification(invoice);
    }
    return this.decorate(invoice);
  }

  async markOverdue(id: string, actor?: InvoiceActor) {
    if (actor) this.assertFinancialRole(actor);
    const invoice = await this.getById(id);
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      return invoice;
    }
    if (invoice.status === 'DRAFT') {
      throw ApiError.badRequest('A draft invoice cannot be marked overdue');
    }
    if (invoice.dueDate >= new Date()) return invoice;

    const updated = await this.database.invoice.update({
      where: { id },
      data: { status: 'OVERDUE' },
      include: this.invoiceInclude(),
    });
    await this.audit(actor, AUDIT_ACTIONS.INVOICE_MARKED_OVERDUE, id, {
      previousStatus: invoice.status,
      status: updated.status,
    });
    return this.decorate(updated);
  }

  async getByIdForPdf(id: string, actor: InvoiceActor) {
    return this.getById(id, actor);
  }

  /**
   * Issued/partially-paid invoices that are past due and still carrying a
   * balance. Owned here so the overdue invoice job never reaches into Person 4
   * tables directly. Client contact details come from the Person 2 client
   * integration port.
   */
  async listOverdueCandidates(): Promise<OverdueInvoiceCandidate[]> {
    const invoices = await this.database.invoice.findMany({
      where: {
        status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        dueDate: { lt: DateHelpers.startOfDay(new Date()) },
        balanceAmount: { gt: 0 },
      },
      orderBy: { dueDate: 'asc' },
    });

    const clients = await this.clients.getByIds(
      invoices.map((invoice) => invoice.clientId)
    );

    return invoices.map((invoice) => {
      const client = clients.get(invoice.clientId);
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        dueDate: invoice.dueDate,
        balanceAmount: invoice.balanceAmount,
        clientName: client?.companyName,
        email: client?.email ?? undefined,
        phone: client?.phone ?? undefined,
      };
    });
  }

  private invoiceInclude() {
    return {
      items: { orderBy: { createdAt: 'asc' as const } },
      payments: { orderBy: { createdAt: 'desc' as const } },
    };
  }

  /**
   * Re-attach the Person 2 owned client/contract projections that the invoice
   * API has always exposed, resolved through the integration ports instead of
   * a Prisma join. The JSON response shape is unchanged.
   */
  private async decorate<T extends { clientId: string; contractId: string | null }>(
    invoice: T
  ) {
    const [client, contract] = await Promise.all([
      this.clients.getById(invoice.clientId),
      invoice.contractId
        ? this.contracts.getById(invoice.contractId)
        : Promise.resolve(null),
    ]);

    return {
      ...invoice,
      client: client
        ? {
            id: client.id,
            companyName: client.companyName,
            email: client.email,
            phone: client.phone,
          }
        : null,
      contract: contract
        ? { id: contract.id, contractNumber: contract.contractNumber }
        : null,
    };
  }

  /**
   * Batch variant used by list() so a page of invoices costs two port lookups
   * rather than one per row.
   */
  private async decorateMany<
    T extends { clientId: string; contractId: string | null }
  >(invoices: T[]) {
    if (invoices.length === 0) return [];

    const [clients, contracts] = await Promise.all([
      this.clients.getByIds(invoices.map((invoice) => invoice.clientId)),
      this.contracts.getByIds(
        invoices
          .map((invoice) => invoice.contractId)
          .filter((id): id is string => Boolean(id))
      ),
    ]);

    return invoices.map((invoice) => {
      const client = clients.get(invoice.clientId);
      const contract = invoice.contractId
        ? contracts.get(invoice.contractId)
        : undefined;

      return {
        ...invoice,
        client: client
          ? {
              id: client.id,
              companyName: client.companyName,
              email: client.email,
              phone: client.phone,
            }
          : null,
        contract: contract
          ? { id: contract.id, contractNumber: contract.contractNumber }
          : null,
      };
    });
  }

  private assertFinancialRole(actor: InvoiceActor): void {
    if (!FINANCIAL_ROLES.has(actor.role)) {
      throw ApiError.forbidden('Financial access is not permitted for this role');
    }
  }

  private async sendIssuedNotification(invoice: {
    id: string;
    invoiceNumber: string;
    clientId: string;
    dueDate: Date;
    totalAmount: Prisma.Decimal;
  }): Promise<void> {
    const client = await this.clients.getById(invoice.clientId);
    if (!client?.email) return;
    await this.notifications.send({
      eventKey: `invoice-issued:${invoice.id}`,
      channel: 'EMAIL',
      recipient: client.email,
      subject: `Invoice ${invoice.invoiceNumber}`,
      message: `Invoice ${invoice.invoiceNumber} is due on ${invoice.dueDate.toISOString().slice(0, 10)}.`,
      relatedId: invoice.id,
      metadata: {
        clientId: invoice.clientId,
        totalAmount: invoice.totalAmount.toString(),
      },
    });
  }

  private async syncAccounting(invoice: {
    id: string;
    invoiceNumber: string;
    clientId: string;
    totalAmount: Prisma.Decimal;
    currency: string;
    issueDate: Date;
  }): Promise<void> {
    try {
      await this.accounting.syncInvoice({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        total: invoice.totalAmount.toString(),
        currency: invoice.currency,
        issuedAt: invoice.issueDate,
      });
    } catch (error) {
      await this.audit(undefined, AUDIT_ACTIONS.INTEGRATION_SYNCED, invoice.id, {
        provider: this.accounting.name,
        status: 'FAILED',
      });
    }
  }

  private async audit(
    actor: InvoiceActor | undefined,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await auditService.log({
      userId: actor?.id,
      action,
      entity: AUDIT_ENTITIES.INVOICE,
      entityId,
      metadata,
    });
  }
}

export const invoiceService = new InvoiceService();

