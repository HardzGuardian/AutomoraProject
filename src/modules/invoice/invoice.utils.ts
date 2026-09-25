import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { InvoiceItemInput, InvoiceTotals } from './invoice.types';

function money(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2);
}

export function calculateInvoiceTotals(
  items: InvoiceItemInput[],
  defaultTaxRate: number | string = 0
): InvoiceTotals & {
  lines: Array<{
    description: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    taxRate: Prisma.Decimal;
    lineSubtotal: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }>;
} {
  const lines = items.map((item) => {
    const quantity = new Prisma.Decimal(item.quantity);
    const unitPrice = money(new Prisma.Decimal(item.unitPrice));
    const taxRate = new Prisma.Decimal(item.taxRate ?? defaultTaxRate);
    const lineSubtotal = money(quantity.times(unitPrice));
    const taxAmount = money(lineSubtotal.times(taxRate).div(100));
    const lineTotal = money(lineSubtotal.plus(taxAmount));

    return {
      description: item.description,
      quantity,
      unitPrice,
      taxRate,
      lineSubtotal,
      taxAmount,
      lineTotal,
    };
  });

  const subtotal = money(
    lines.reduce((sum, line) => sum.plus(line.lineSubtotal), new Prisma.Decimal(0))
  );
  const taxAmount = money(
    lines.reduce((sum, line) => sum.plus(line.taxAmount), new Prisma.Decimal(0))
  );
  const totalAmount = money(subtotal.plus(taxAmount));

  return { subtotal, taxAmount, totalAmount, lines };
}

export function generateInvoiceNumber(now = new Date()): string {
  const year = now.getUTCFullYear();
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  return `INV-${year}-${suffix}`;
}

export function decimalNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}
