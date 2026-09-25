export type NotificationChannelName = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP';

export type NotificationStatusName = 'SENT' | 'FAILED' | 'SKIPPED';

export interface NotificationInput {
  eventKey: string;
  channel: NotificationChannelName;
  recipient: string;
  subject?: string;
  message: string;
  metadata?: Record<string, unknown>;
  relatedId?: string;
}

export interface NotificationSendResult {
  status: NotificationStatusName;
  provider?: string;
  error?: string;
  duplicate?: boolean;
}

export interface NotificationLogInput {
  eventKey: string;
  channel: NotificationChannelName;
  recipient: string;
  status: NotificationStatusName;
  provider?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  relatedId?: string;
  sentAt?: Date;
}

export interface RenewalReminderInput {
  contractId: string;
  contractNumber: string;
  clientName: string;
  clientEmail: string;
  endDate: Date;
  reminderType: string;
  daysUntilExpiry: number;
}

export interface PaymentReminderInput {
  invoiceId: string;
  invoiceNumber: string;
  clientName?: string;
  email?: string;
  phone?: string;
  amount: string | number;
  dueDate: Date | string;
  eventKey?: string;
  channels?: NotificationChannelName[];
}

export interface PaymentReminderResult {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  results: NotificationSendResult[];
}