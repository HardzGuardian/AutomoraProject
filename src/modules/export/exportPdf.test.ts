import { exportPdf, exportInvoicePdf } from './exportPdf';

function dec(value: string) {
  return { toString: () => value };
}

describe('exportPdf', () => {
  it('produces a structurally valid PDF document', () => {
    const buffer = exportPdf({ title: 'Test Report', lines: ['Row A: 10', 'Row B: 20'] });
    const text = buffer.toString('utf8');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('/Type /Page');
    expect(text).toContain('trailer');
    expect(text).toContain('startxref');
  });

  it('writes an xref entry for every object', () => {
    const buffer = exportPdf({ title: 'T', lines: ['a', 'b', 'c'] });
    const text = buffer.toString('utf8');
    const xref = text.slice(text.indexOf('xref\n'));
    const entries = xref.match(/^\d{10} \d{5} n $/gm) ?? [];
    // 5 objects: catalog, pages, page, contents, font
    expect(entries).toHaveLength(5);
  });

  it('escapes parentheses and backslashes in the title', () => {
    const buffer = exportPdf({ title: 'Invoice (A/B) \\ draft', lines: [] });
    const text = buffer.toString('utf8');
    expect(text).toContain('Invoice \\(A/B\\) \\\\ draft');
  });

  it('caps the number of rendered lines', () => {
    const buffer = exportPdf({
      title: 'Long',
      lines: Array.from({ length: 200 }, (_, i) => `Line ${i}`),
    });
    const text = buffer.toString('utf8');
    expect(text).toContain('Line 44');
    expect(text).not.toContain('Line 45');
  });

  it('renders an invoice with client, items, and totals', () => {
    const buffer = exportInvoicePdf({
      invoiceNumber: 'INV-1',
      issueDate: new Date('2026-01-01T00:00:00Z'),
      dueDate: new Date('2026-02-01T00:00:00Z'),
      status: 'ISSUED',
      currency: 'INR',
      subtotal: dec('1000.00'),
      taxAmount: dec('180.00'),
      totalAmount: dec('1180.00'),
      balanceAmount: dec('1180.00'),
      client: { companyName: 'Client One' },
      items: [
        {
          description: 'AMC Service',
          quantity: dec('2'),
          unitPrice: dec('500.00'),
          lineTotal: dec('1000.00'),
        },
      ],
    });
    const text = buffer.toString('utf8');

    expect(text).toContain('Invoice INV-1');
    expect(text).toContain('Client One');
    expect(text).toContain('AMC Service');
    expect(text).toContain('INR 1180.00');
  });

  it('falls back gracefully when the invoice has no client', () => {
    const buffer = exportInvoicePdf({
      invoiceNumber: 'INV-2',
      issueDate: new Date('2026-01-01T00:00:00Z'),
      dueDate: new Date('2026-02-01T00:00:00Z'),
      status: 'DRAFT',
      currency: 'INR',
      subtotal: dec('0.00'),
      taxAmount: dec('0.00'),
      totalAmount: dec('0.00'),
      balanceAmount: dec('0.00'),
      client: null,
      items: [],
    });

    expect(buffer.toString('utf8')).toContain('Client: N/A');
  });
});
