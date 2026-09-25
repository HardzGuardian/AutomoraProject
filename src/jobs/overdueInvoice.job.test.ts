jest.mock('../modules/invoice/invoice.service', () => ({
  invoiceService: {
    markOverdue: jest.fn(),
    listOverdueCandidates: jest.fn(),
  },
}));

jest.mock('../modules/notification/notification.service', () => ({
  notificationService: { sendPaymentReminder: jest.fn() },
}));

jest.mock('../modules/audit/audit.service', () => ({
  auditService: { logSimple: jest.fn().mockResolvedValue(undefined) },
}));

import { invoiceService } from '../modules/invoice/invoice.service';
import { notificationService } from '../modules/notification/notification.service';
import { OverdueInvoiceJob } from './overdueInvoice.job';

describe('OverdueInvoiceJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks due invoices and sends a reminder once per run', async () => {
    (invoiceService.listOverdueCandidates as jest.Mock).mockResolvedValue([
      {
        id: 'invoice-1',
        invoiceNumber: 'INV-1',
        dueDate: new Date('2020-01-01'),
        balanceAmount: { toString: () => '100' },
        clientName: 'Client',
        email: 'client@example.com',
        phone: null,
      },
    ]);
    (invoiceService.markOverdue as jest.Mock).mockResolvedValue(undefined);
    (notificationService.sendPaymentReminder as jest.Mock).mockResolvedValue({
      attempted: 1,
      sent: 1,
      skipped: 0,
      failed: 0,
      results: [],
    });

    const result = await new OverdueInvoiceJob().run();

    expect(result).toEqual({ marked: 1, reminders: 1, skipped: 0, errors: 0 });
    expect(invoiceService.markOverdue).toHaveBeenCalledWith('invoice-1');
    expect(notificationService.sendPaymentReminder).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: 'invoice-1' })
    );
  });

  it('resolves candidates through the invoice service, not Prisma', async () => {
    (invoiceService.listOverdueCandidates as jest.Mock).mockResolvedValue([]);
    (invoiceService.markOverdue as jest.Mock).mockResolvedValue(undefined);

    const result = await new OverdueInvoiceJob().run();

    expect(invoiceService.listOverdueCandidates).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ marked: 0, reminders: 0, skipped: 0, errors: 0 });
  });

  it('counts a per-invoice failure without aborting the run', async () => {
    (invoiceService.listOverdueCandidates as jest.Mock).mockResolvedValue([
      {
        id: 'invoice-1',
        invoiceNumber: 'INV-1',
        dueDate: new Date('2020-01-01'),
        balanceAmount: { toString: () => '100' },
        clientName: 'Client',
        email: 'client@example.com',
        phone: null,
      },
    ]);
    (invoiceService.markOverdue as jest.Mock).mockRejectedValue(
      new Error('markOverdue failed')
    );

    const result = await new OverdueInvoiceJob().run();

    expect(result.marked).toBe(0);
    expect(result.errors).toBe(1);
  });
});
