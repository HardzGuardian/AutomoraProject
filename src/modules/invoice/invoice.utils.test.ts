import { calculateInvoiceTotals, generateInvoiceNumber } from './invoice.utils';

describe('calculateInvoiceTotals', () => {
  it('calculates subtotal, tax, and total across line items', () => {
    const totals = calculateInvoiceTotals([
      { description: 'Service', quantity: 2, unitPrice: 1000 },
      { description: 'Travel', quantity: 1, unitPrice: 500, taxRate: 10 },
    ]);

    expect(totals.subtotal.toNumber()).toBe(2500);
    expect(totals.taxAmount.toNumber()).toBe(50);
    expect(totals.totalAmount.toNumber()).toBe(2550);
    expect(totals.lines).toHaveLength(2);
  });

  it('uses the invoice tax rate when a line has no override', () => {
    const totals = calculateInvoiceTotals(
      [{ description: 'Service', quantity: 1, unitPrice: 100 }],
      '18'
    );

    expect(totals.taxAmount.toNumber()).toBe(18);
    expect(totals.totalAmount.toNumber()).toBe(118);
  });

  it('rounds the unit price and line subtotal to two decimal places', () => {
    const totals = calculateInvoiceTotals([
      { description: 'Service', quantity: 3, unitPrice: 33.333 },
    ]);

    const [line] = totals.lines;
    expect(line.unitPrice.toNumber()).toBe(33.33);
    expect(line.lineSubtotal.toNumber()).toBe(99.99);
    expect(line.lineTotal.toNumber()).toBe(99.99);
  });

  it('computes tax from the already-rounded line subtotal', () => {
    const totals = calculateInvoiceTotals(
      [{ description: 'Service', quantity: 3, unitPrice: 33.333 }],
      18
    );

    // 99.99 * 18 / 100 = 17.9982 -> 18.00
    expect(totals.subtotal.toNumber()).toBe(99.99);
    expect(totals.taxAmount.toNumber()).toBe(18);
    expect(totals.totalAmount.toNumber()).toBe(117.99);
  });

  it('keeps subtotal + taxAmount exactly equal to totalAmount', () => {
    const totals = calculateInvoiceTotals(
      [
        { description: 'A', quantity: 3, unitPrice: 19.999 },
        { description: 'B', quantity: 7, unitPrice: 13.331 },
        { description: 'C', quantity: 1, unitPrice: 0.005, taxRate: 5 },
      ],
      7.5
    );

    expect(totals.totalAmount.toFixed(2)).toBe(
      totals.subtotal.plus(totals.taxAmount).toFixed(2)
    );
  });

  it('honours a per-line tax override alongside the invoice default', () => {
    const totals = calculateInvoiceTotals(
      [
        { description: 'Exempt', quantity: 1, unitPrice: 100, taxRate: 0 },
        { description: 'Standard', quantity: 1, unitPrice: 100, taxRate: 18 },
        { description: 'Defaulted', quantity: 1, unitPrice: 100 },
      ],
      10
    );

    expect(totals.subtotal.toNumber()).toBe(300);
    expect(totals.lines[0].taxAmount.toNumber()).toBe(0);
    expect(totals.lines[1].taxAmount.toNumber()).toBe(18);
    expect(totals.lines[2].taxAmount.toNumber()).toBe(10);
    expect(totals.taxAmount.toNumber()).toBe(28);
    expect(totals.totalAmount.toNumber()).toBe(328);
  });

  it('handles a 100 percent tax rate', () => {
    const totals = calculateInvoiceTotals(
      [{ description: 'Service', quantity: 1, unitPrice: 200, taxRate: 100 }]
    );

    expect(totals.taxAmount.toNumber()).toBe(200);
    expect(totals.totalAmount.toNumber()).toBe(400);
  });

  it('handles a zero tax rate', () => {
    const totals = calculateInvoiceTotals([
      { description: 'Service', quantity: 1, unitPrice: 200, taxRate: 0 },
    ]);

    expect(totals.taxAmount.toNumber()).toBe(0);
    expect(totals.totalAmount.toNumber()).toBe(200);
  });

  it('accepts string inputs for quantity, price, and tax rate', () => {
    const totals = calculateInvoiceTotals([
      { description: 'Service', quantity: '2', unitPrice: '250.50', taxRate: '18' },
    ]);

    expect(totals.subtotal.toNumber()).toBe(501);
    expect(totals.taxAmount.toNumber()).toBe(90.18);
    expect(totals.totalAmount.toNumber()).toBe(591.18);
  });

  it('returns zeroed totals for an empty item list', () => {
    const totals = calculateInvoiceTotals([]);

    expect(totals.subtotal.toNumber()).toBe(0);
    expect(totals.taxAmount.toNumber()).toBe(0);
    expect(totals.totalAmount.toNumber()).toBe(0);
    expect(totals.lines).toHaveLength(0);
  });
});

describe('generateInvoiceNumber', () => {
  it('uses the INV-<year>-<suffix> format', () => {
    const number = generateInvoiceNumber(new Date('2026-03-04T00:00:00Z'));
    expect(number).toMatch(/^INV-2026-[0-9A-F]{10}$/);
  });

  it('generates unique numbers', () => {
    const numbers = new Set(
      Array.from({ length: 500 }, () => generateInvoiceNumber())
    );
    expect(numbers.size).toBe(500);
  });
});
