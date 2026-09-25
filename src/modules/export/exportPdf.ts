function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export interface PdfExportOptions {
  title: string;
  lines: string[];
}

export function exportPdf(options: PdfExportOptions): Buffer {
  const visibleLines = options.lines.slice(0, 45);
  const content = [
    'BT',
    '/F1 18 Tf',
    '50 790 Td',
    `(${escapePdfText(options.title)}) Tj`,
    '/F1 10 Tf',
    ...visibleLines.flatMap((line, index) => [
      index === 0 ? '0 -28 Td' : '0 -16 Td',
      `(${escapePdfText(line)}) Tj`,
    ]),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let document = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document, 'utf8'));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(document, 'utf8');
  document += `xref\n0 ${objects.length + 1}\n`;
  document += '0000000000 65535 f \n';
  for (const offset of offsets) {
    document += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(document, 'utf8');
}

export function exportInvoicePdf(invoice: {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  status: string;
  currency: string;
  subtotal: { toString(): string };
  taxAmount: { toString(): string };
  totalAmount: { toString(): string };
  balanceAmount: { toString(): string };
  client?: { companyName: string } | null;
  items: Array<{
    description: string;
    quantity: { toString(): string };
    unitPrice: { toString(): string };
    lineTotal: { toString(): string };
  }>;
}): Buffer {
  const lines = [
    `Client: ${invoice.client?.companyName ?? 'N/A'}`,
    `Issue date: ${invoice.issueDate.toISOString().slice(0, 10)}`,
    `Due date: ${invoice.dueDate.toISOString().slice(0, 10)}`,
    `Status: ${invoice.status}`,
    '',
    'Items',
    ...invoice.items.map(
      (item) =>
        `${item.description} | ${item.quantity.toString()} x ${item.unitPrice.toString()} = ${item.lineTotal.toString()}`
    ),
    '',
    `Subtotal: ${invoice.currency} ${invoice.subtotal.toString()}`,
    `Tax: ${invoice.currency} ${invoice.taxAmount.toString()}`,
    `Total: ${invoice.currency} ${invoice.totalAmount.toString()}`,
    `Balance: ${invoice.currency} ${invoice.balanceAmount.toString()}`,
  ];

  return exportPdf({ title: `Invoice ${invoice.invoiceNumber}`, lines });
}