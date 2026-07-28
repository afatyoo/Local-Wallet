import { strToU8, zipSync } from 'fflate';
import { type Budget, type Expense, type Income } from './db';

interface ExcelReportData {
  incomes: Income[];
  expenses: Expense[];
  budgets: Budget[];
  selectedMonth: string;
  username: string;
}

type FormulaCell = { formula: string; result: number };
type CellValue = string | number | FormulaCell;

interface SheetDefinition {
  name: string;
  rows: CellValue[][];
  widths: number[];
  currencyColumns?: number[];
  percentColumns?: number[];
}

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const columnName = (index: number) => {
  let name = '';
  let current = index;

  while (current > 0) {
    current -= 1;
    name = String.fromCharCode(65 + (current % 26)) + name;
    current = Math.floor(current / 26);
  }

  return name;
};

const cellXml = (
  value: CellValue,
  rowIndex: number,
  columnIndex: number,
  sheet: SheetDefinition,
) => {
  const reference = `${columnName(columnIndex)}${rowIndex}`;
  const isHeader = rowIndex === 1;
  const isCurrency = sheet.currencyColumns?.includes(columnIndex);
  const isPercent = sheet.percentColumns?.includes(columnIndex);
  const style = isHeader ? 1 : isCurrency ? 2 : isPercent ? 4 : 0;

  if (typeof value === 'number') {
    return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  }

  if (typeof value === 'object') {
    return `<c r="${reference}" s="${style}"><f>${escapeXml(value.formula)}</f><v>${value.result}</v></c>`;
  }

  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
};

const worksheetXml = (sheet: SheetDefinition) => {
  const columns = sheet.widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  const rows = sheet.rows
    .map((row, rowOffset) => {
      const rowIndex = rowOffset + 1;
      const cells = row
        .map((value, columnOffset) => cellXml(value, rowIndex, columnOffset + 1, sheet))
        .join('');
      return `<row r="${rowIndex}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${columns}</cols>
  <sheetData>${rows}</sheetData>
</worksheet>`;
};

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="&quot;Rp&quot; #,##0;[Red]-&quot;Rp&quot; #,##0"/>
    <numFmt numFmtId="165" formatCode="0.0%"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF166534"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const createWorkbook = (sheets: SheetDefinition[]) => {
  const sheetEntries = sheets
    .map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('');
  const sheetRelationships = sheets
    .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
    .join('');
  const sheetOverrides = sheets
    .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('');

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetEntries}</sheets>
  <calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRelationships}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    'xl/styles.xml': strToU8(stylesXml),
  };

  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(sheet));
  });

  return zipSync(files, { level: 6 });
};

const downloadWorkbook = (workbook: Uint8Array, fileName: string) => {
  const blob = new Blob([workbook as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export async function generateExcelReport(data: ExcelReportData) {
  const { incomes, expenses, budgets, selectedMonth, username } = data;
  const filteredIncomes = selectedMonth === 'all'
    ? incomes
    : incomes.filter(income => income.bulan === selectedMonth);
  const filteredExpenses = selectedMonth === 'all'
    ? expenses
    : expenses.filter(expense => expense.bulan === selectedMonth);
  const filteredBudgets = selectedMonth === 'all'
    ? budgets
    : budgets.filter(budget => budget.bulan === selectedMonth);

  const totalIncome = filteredIncomes.reduce((sum, income) => sum + income.jumlah, 0);
  const totalExpense = filteredExpenses.reduce((sum, expense) => sum + expense.jumlah, 0);
  const budgetRows: CellValue[][] = filteredBudgets.map(budget => {
    const actual = filteredExpenses
      .filter(expense => expense.kategori === budget.kategori)
      .reduce((sum, expense) => sum + expense.jumlah, 0);
    return [
      budget.kategori,
      budget.anggaran,
      actual,
      budget.anggaran - actual,
      actual <= budget.anggaran ? 'On Track' : 'Over Budget',
    ];
  });
  const categoryTotals = filteredExpenses.reduce<Record<string, number>>((totals, expense) => {
    totals[expense.kategori] = (totals[expense.kategori] ?? 0) + expense.jumlah;
    return totals;
  }, {});

  const sheets: SheetDefinition[] = [
    {
      name: 'Summary',
      widths: [24, 24],
      currencyColumns: [2],
      rows: [
        ['FINANCIAL REPORT', ''],
        ['Period', selectedMonth === 'all' ? 'All Periods' : selectedMonth],
        ['Prepared by', username],
        ['Generated on', new Date().toISOString().split('T')[0]],
        ['', ''],
        ['SUMMARY', ''],
        ['Total Income', { formula: "SUM('Income'!E:E)", result: totalIncome }],
        ['Total Expenses', { formula: "SUM('Expenses'!E:E)", result: totalExpense }],
        ['Net Balance', { formula: 'B7-B8', result: totalIncome - totalExpense }],
      ],
    },
    {
      name: 'Income',
      widths: [14, 24, 20, 18, 18],
      currencyColumns: [5],
      rows: [
        ['Date', 'Source', 'Category', 'Method', 'Amount'],
        ...filteredIncomes.map(income => [
          income.tanggal,
          income.sumber,
          income.kategori,
          income.metode,
          income.jumlah,
        ]),
        ['', '', '', 'TOTAL', { formula: 'SUM(E2:E1048576)', result: totalIncome }],
      ],
    },
    {
      name: 'Expenses',
      widths: [14, 28, 20, 18, 18],
      currencyColumns: [5],
      rows: [
        ['Date', 'Name', 'Category', 'Method', 'Amount'],
        ...filteredExpenses.map(expense => [
          expense.tanggal,
          expense.nama,
          expense.kategori,
          expense.metode,
          expense.jumlah,
        ]),
        ['', '', '', 'TOTAL', { formula: 'SUM(E2:E1048576)', result: totalExpense }],
      ],
    },
    {
      name: 'Budget',
      widths: [24, 18, 18, 18, 16],
      currencyColumns: [2, 3, 4],
      rows: [['Category', 'Budget', 'Actual', 'Variance', 'Status'], ...budgetRows],
    },
    {
      name: 'Category Breakdown',
      widths: [24, 18, 16],
      currencyColumns: [2],
      percentColumns: [3],
      rows: [
        ['Category', 'Amount', '% of Total'],
        ...Object.entries(categoryTotals)
          .sort(([, left], [, right]) => right - left)
          .map(([category, amount]) => [
            category,
            amount,
            totalExpense > 0 ? amount / totalExpense : 0,
          ]),
        ['TOTAL', totalExpense, totalExpense > 0 ? 1 : 0],
      ],
    },
  ];

  const period = selectedMonth === 'all' ? 'all-periods' : selectedMonth;
  const date = new Date().toISOString().split('T')[0];
  downloadWorkbook(createWorkbook(sheets), `financial-report-${period}-${date}.xlsx`);
}
