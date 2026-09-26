import { env } from '../../../config/env';

export interface AccountingInvoiceInput {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  total: string;
  currency: string;
  issuedAt: Date;
}

export interface AccountingPaymentInput {
  paymentId: string;
  invoiceId: string;
  clientId: string;
  amount: string;
  currency: string;
  paidAt: Date | null;
}

export interface AccountingSyncResult {
  status: 'SYNCED' | 'SKIPPED' | 'FAILED';
  provider: string;
  externalReference?: string | null;
  message?: string;
}

export interface AccountingProvider {
  readonly name: string;
  syncInvoice(input: AccountingInvoiceInput): Promise<AccountingSyncResult>;
  syncPayment(input: AccountingPaymentInput): Promise<AccountingSyncResult>;
}

// Used when no accounting provider is configured; never reports a sync as successful.
export class UnconfiguredAccountingProvider implements AccountingProvider {
  readonly name = env.ACCOUNTING_PROVIDER_NAME;

  async syncInvoice(_input: AccountingInvoiceInput): Promise<AccountingSyncResult> {
    return {
      status: 'SKIPPED',
      provider: this.name,
      externalReference: null,
      message: 'External accounting provider is not configured',
    };
  }

  async syncPayment(_input: AccountingPaymentInput): Promise<AccountingSyncResult> {
    return {
      status: 'SKIPPED',
      provider: this.name,
      externalReference: null,
      message: 'External accounting provider is not configured',
    };
  }
}

export const accountingProvider: AccountingProvider =
  new UnconfiguredAccountingProvider();
