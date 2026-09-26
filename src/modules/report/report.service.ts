import { PaymentStatus, Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import {
  ContractReadPort,
  contractReadPort,
} from '../integrations/contract/contract.port';
import {
  ClientReadPort,
  clientReadPort,
} from '../integrations/client/client.port';
import {
  OperationalMetrics,
  ReportActor,
  ReportPeriod,
  RevenueReport,
  RevenueRow,
  UnavailableOperationalMetrics,
  UnavailableReport,
} from './report.types';

const REPORT_ROLES = new Set(['ADMIN', 'MANAGER', 'SALES']);

export class ReportService {
  constructor(
    private readonly database: typeof prisma = prisma,
    private readonly operationalMetrics: OperationalMetrics = new UnavailableOperationalMetrics(),
    private readonly contracts: ContractReadPort = contractReadPort,
    private readonly clients: ClientReadPort = clientReadPort
  ) {}

  async revenueByClient(
    period: ReportPeriod,
    actor: ReportActor
  ): Promise<RevenueReport> {
    this.assertRole(actor);
    const payments = await this.successfulPayments(period);
    return this.toRevenueReport(period, payments.map((payment) => ({
      id: payment.invoice.clientId,
      label: payment.clientName,
      amount: payment.amount,
    })));
  }

  async revenueByContract(
    period: ReportPeriod,
    actor: ReportActor
  ): Promise<RevenueReport> {
    this.assertRole(actor);
    const payments = await this.successfulPayments(period);
    return this.toRevenueReport(period, payments.map((payment) => ({
      id: payment.invoice.contractId || payment.invoice.id,
      label: payment.contractNumber || payment.invoice.invoiceNumber,
      amount: payment.amount,
    })));
  }

  async revenueByPeriod(
    period: ReportPeriod,
    actor: ReportActor
  ): Promise<RevenueReport> {
    this.assertRole(actor);
    const payments = await this.successfulPayments(period);
    return this.toRevenueReport(period, payments.map((payment) => ({
      id: payment.paidAt?.toISOString().slice(0, 7) || 'unknown',
      label: payment.paidAt?.toISOString().slice(0, 7) || 'Unknown period',
      amount: payment.amount,
    })));
  }

  async revenueByBranch(
    period: ReportPeriod,
    actor: ReportActor
  ): Promise<UnavailableReport> {
    this.assertRole(actor);
    return this.operationalMetrics.revenueByBranch(period);
  }

  async technicianPerformance(
    period: ReportPeriod,
    actor: ReportActor
  ): Promise<UnavailableReport> {
    this.assertRole(actor);
    return this.operationalMetrics.technicianPerformance(period);
  }

  async operational(
    period: ReportPeriod,
    actor: ReportActor
  ): Promise<UnavailableReport> {
    this.assertRole(actor);
    return {
      available: false,
      reason: 'Scheduling, visit, ticket and SLA data is not available yet',
      rows: [],
    };
  }

  private async successfulPayments(period: ReportPeriod) {
    const payments = await this.database.payment.findMany({
      where: {
        status: PaymentStatus.SUCCESS,
        paidAt: {
          ...(period.from ? { gte: period.from } : {}),
          ...(period.to ? { lte: period.to } : {}),
        },
      },
      include: {
        invoice: {
          select: {
            id: true,
            clientId: true,
            contractId: true,
            invoiceNumber: true,
          },
        },
      },
    });

    // Batched through the ports to avoid one lookup per payment.
    const [clients, contracts] = await Promise.all([
      this.clients.getByIds(payments.map((payment) => payment.invoice.clientId)),
      this.contracts.getByIds(
        payments
          .map((payment) => payment.invoice.contractId)
          .filter((id): id is string => Boolean(id))
      ),
    ]);

    return payments.map((payment) => ({
      ...payment,
      clientName:
        clients.get(payment.invoice.clientId)?.companyName ?? 'Unknown client',
      contractNumber: payment.invoice.contractId
        ? contracts.get(payment.invoice.contractId)?.contractNumber
        : undefined,
    }));
  }

  private toRevenueReport(
    period: ReportPeriod,
    entries: Array<{ id: string; label: string; amount: Prisma.Decimal }>
  ): RevenueReport {
    const grouped = new Map<string, RevenueRow>();
    for (const entry of entries) {
      const existing = grouped.get(entry.id);
      if (existing) {
        existing.amount += entry.amount.toNumber();
        existing.paymentCount += 1;
      } else {
        grouped.set(entry.id, {
          id: entry.id,
          label: entry.label,
          amount: entry.amount.toNumber(),
          paymentCount: 1,
        });
      }
    }

    return {
      available: true,
      period: {
        from: (period.from ?? new Date(0)).toISOString(),
        to: (period.to ?? new Date()).toISOString(),
      },
      rows: Array.from(grouped.values()).sort((a, b) => b.amount - a.amount),
    };
  }

  private assertRole(actor: ReportActor): void {
    if (!REPORT_ROLES.has(actor.role)) {
      throw ApiError.forbidden('Report access is not permitted for this role');
    }
  }
}

export const reportService = new ReportService();
