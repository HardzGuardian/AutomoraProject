export interface ReportPeriod {
  from?: Date;
  to?: Date;
}

export interface ReportActor {
  id: string;
  role: 'ADMIN' | 'MANAGER' | 'SALES' | 'TECHNICIAN' | 'CUSTOMER';
}

export interface RevenueRow {
  id: string;
  label: string;
  amount: number;
  paymentCount: number;
}

export interface RevenueReport {
  available: true;
  period: { from: string; to: string };
  rows: RevenueRow[];
}

export interface UnavailableReport {
  available: false;
  reason: string;
  rows: [];
}

export interface OperationalMetrics {
  revenueByBranch(query: ReportPeriod): Promise<UnavailableReport>;
  technicianPerformance(query: ReportPeriod): Promise<UnavailableReport>;
}

export class UnavailableOperationalMetrics implements OperationalMetrics {
  async revenueByBranch(): Promise<UnavailableReport> {
    return {
      available: false,
      reason: 'Branch data is not available yet',
      rows: [],
    };
  }

  async technicianPerformance(): Promise<UnavailableReport> {
    return {
      available: false,
      reason: 'Technician and SLA data is not available yet',
      rows: [],
    };
  }
}
