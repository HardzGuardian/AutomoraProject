export interface DashboardActor {
  id: string;
  role: 'ADMIN' | 'MANAGER' | 'SALES' | 'TECHNICIAN' | 'CUSTOMER';
}

export interface DashboardSummary {
  generatedAt: string;
  finance: {
    invoiceCount: number;
    outstandingAmount: number;
    paidAmount: number;
    paymentAmount: number;
    overdueCount: number;
    paidInvoiceCount: number;
  };
  contracts: {
    activeCount: number;
    expiringSoonCount: number;
  };
  clients: {
    activeCount: number;
  };
  operational: {
    available: false;
    reason: string;
  };
}
