function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface ExcelExportOptions {
  sheetName: string;
  columns: string[];
  rows: Array<Array<string | number | null | undefined>>;
}

// Writes SpreadsheetML 2003 XML, which Excel opens natively, to avoid adding an XLSX library.
export function exportExcel(options: ExcelExportOptions): Buffer {
  const header = options.columns
    .map((column) => `<Cell><Data ss:Type="String">${escapeXml(column)}</Data></Cell>`)
    .join('');
  const body = options.rows
    .map(
      (row) =>
        `<Row>${row
          .map(
            (value) =>
              `<Cell><Data ss:Type="${typeof value === 'number' ? 'Number' : 'String'}">${escapeXml(value)}</Data></Cell>`
          )
          .join('')}</Row>`
    )
    .join('');

  const xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(options.sheetName)}">
  <Table>
   <Row>${header}</Row>
   ${body}
  </Table>
 </Worksheet>
</Workbook>`;

  return Buffer.from(xml, 'utf8');
}