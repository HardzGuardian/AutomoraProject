import { exportExcel } from './exportExcel';

function parseRows(xml: string): string[] {
  return xml.match(/<Row>[\s\S]*?<\/Row>/g) ?? [];
}

describe('exportExcel', () => {
  it('produces a SpreadsheetML workbook with a header row', () => {
    const buffer = exportExcel({
      sheetName: 'Revenue',
      columns: ['ID', 'Label', 'Amount'],
      rows: [['client-1', 'Client One', 150]],
    });
    const xml = buffer.toString('utf8');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(xml.startsWith('<?xml version="1.0"?>')).toBe(true);
    expect(xml).toContain('<Workbook');
    expect(xml).toContain('ss:Name="Revenue"');
    expect(parseRows(xml)).toHaveLength(2);
  });

  it('types numeric cells as Number and the rest as String', () => {
    const xml = exportExcel({
      sheetName: 'Sheet1',
      columns: ['Label', 'Amount'],
      rows: [['Client One', 150]],
    }).toString('utf8');

    expect(xml).toContain('<Data ss:Type="String">Client One</Data>');
    expect(xml).toContain('<Data ss:Type="Number">150</Data>');
  });

  it('escapes XML special characters in values and headers', () => {
    const xml = exportExcel({
      sheetName: 'S&1',
      columns: ['A & B', '<tag>'],
      rows: [['Smith & Sons', 'say "hi"']],
    }).toString('utf8');

    expect(xml).toContain('A &amp; B');
    expect(xml).toContain('&lt;tag&gt;');
    expect(xml).toContain('Smith &amp; Sons');
    expect(xml).toContain('&quot;hi&quot;');
  });

  it('renders empty and null cells as empty strings', () => {
    const xml = exportExcel({
      sheetName: 'Sheet1',
      columns: ['A', 'B', 'C'],
      rows: [[null, undefined, '']],
    }).toString('utf8');

    expect(xml).toContain('<Data ss:Type="String"></Data>');
  });

  it('renders a zero as a numeric cell rather than an empty cell', () => {
    const xml = exportExcel({
      sheetName: 'Sheet1',
      columns: ['Amount'],
      rows: [[0]],
    }).toString('utf8');

    expect(xml).toContain('<Data ss:Type="Number">0</Data>');
  });

  it('emits only the header row for an empty data set', () => {
    const xml = exportExcel({
      sheetName: 'Sheet1',
      columns: ['A', 'B'],
      rows: [],
    }).toString('utf8');

    expect(parseRows(xml)).toHaveLength(1);
  });
});
