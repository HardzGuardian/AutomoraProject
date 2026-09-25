import { InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { ContractReadPort, contractReadPort } from '../integrations/contract/contract.port';
import { ClientReadPort, clientReadPort } from '../integrations/client/client.port';
import { DashboardActor, DashboardSummary } from './dashboard.types';

const DASHBOARD_ROLES = new Set(['ADMIN', 'MANAGER', 'SALES']);

export class DashboardService {
  constructor(
    private readonly database: typeof prisma = prisma,
    private readonly contracts: ContractReadPort = contractReadPort,
    private readonly clients: ClientReadPort = clientReadPort
  ) {}

// Dashboard cross-domain counts are read-only aggregates. They do not
  // duplicate Person 2/P3 business rules. Person 2 owned contract and client
  // counts are read through integration ports, never queried directly.
  async getSummary(actor: DashboardActor): Promise<DashboardSummary> {
    if (!DASHBOARD_ROLES.has(actor.role)) {
      throw ApiError.forbidden('Dashboard access is not permitted for this role');
    }

    const [invoiceAggregate, paidAggregate, overdueCount, paidInvoiceCount, activeContracts, expiringContracts, activeClients] =
      await Promise.all([
        this.database.invoice.aggregate({
          where: { status: { notIn: ['DRAFT', 'CANCELLED'] } },
          _count: { _all: true },
          _sum: { balanceAmount: true, paidAmount: true },
        }),
        this.database.payment.aggregate({
          where: { status: PaymentStatus.SUCCESS },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        this.database.invoice.count({ where: { status: InvoiceStatus.OVERDUE } }),
        this.database.invoice.count({ where: { status: InvoiceStatus.PAID } }),
        this.contracts.countByStatus('ACTIVE'),
        this.contracts.countByStatus('EXPIRING_SOON'),
        this.clients.countActive(),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      finance: {
        invoiceCount: invoiceAggregate._count._all,
        outstandingAmount: this.toNumber(invoiceAggregate._sum.balanceAmount),
        paidAmount: this.toNumber(invoiceAggregate._sum.paidAmount),
        paymentAmount: this.toNumber(paidAggregate._sum.amount),
        overdueCount,
        paidInvoiceCount,
      },
      contracts: {
        activeCount: activeContracts,
        expiringSoonCount: expiringContracts,
      },
      clients: { activeCount: activeClients },
      operational: {
        available: false,
        reason: 'Person 3 scheduling, visit, ticket, and SLA integration is not available',
      },
    };
  }

  private toNumber(value: Prisma.Decimal | null): number {
    return value ? value.toNumber() : 0;
  }
}

export const dashboardService = new DashboardService();

