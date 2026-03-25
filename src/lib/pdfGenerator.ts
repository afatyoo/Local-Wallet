import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Income, Expense, Budget, Saving } from './db';
import { formatCurrency, formatDate } from './utils';

interface ReportData {
  incomes: Income[];
  expenses: Expense[];
  budgets: Budget[];
  savings: Saving[];
  selectedMonth: string;
  username: string;
}

// Helper to convert RGB to hex
const rgb = (r: number, g: number, b: number) => `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

export function generateFinanceReport(data: ReportData) {
  const { incomes, expenses, budgets, savings, selectedMonth, username } = data;

  const doc = new jsPDF();
  const pageWidth = (doc as any).internal.pageSize.getWidth();
  const pageHeight = (doc as any).internal.pageSize.getHeight();

  // Filter data based on selected month
  const filteredIncomes = selectedMonth === 'all'
    ? incomes
    : incomes.filter(i => i.bulan === selectedMonth);

  const filteredExpenses = selectedMonth === 'all'
    ? expenses
    : expenses.filter(e => e.bulan === selectedMonth);

  const filteredBudgets = selectedMonth === 'all'
    ? budgets
    : budgets.filter(b => b.bulan === selectedMonth);

  // Calculate totals
  const totalIncome = filteredIncomes.reduce((sum, i) => sum + i.jumlah, 0);
  const totalExpense = filteredExpenses.reduce((sum, e) => sum + e.jumlah, 0);
  const netBalance = totalIncome - totalExpense;
  const totalSavings = savings.reduce((sum, s) => sum + s.setoran - s.penarikan, 0);

  let yPos = 20;

  // Header Bar
  doc.setFillColor(rgb(34, 197, 94)); // Green header
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#ffffff');
  doc.text('FINANCIAL REPORT', pageWidth / 2, 22, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const periodText = selectedMonth === 'all' ? 'All Periods' : formatMonthName(selectedMonth);
  doc.text(`Period: ${periodText}`, pageWidth / 2, 32, { align: 'center' });

  doc.setTextColor('#000000');
  yPos = 50;

  // Report metadata
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text(`Prepared by: ${username}`, 14, yPos);
  doc.text(`Generated on: ${formatDate(new Date().toISOString())}`, pageWidth - 14, yPos, { align: 'right' });
  yPos += 10;

  // Summary Box
  doc.setFillColor(rgb(248, 250, 252));
  doc.rect(14, yPos, pageWidth - 28, 40, 'F');
  doc.setDrawColor(rgb(226, 232, 240));
  doc.rect(14, yPos, pageWidth - 28, 40, 'S');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Financial Summary', 20, yPos + 8);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  const col1X = 20;
  const col2X = pageWidth / 2 + 10;

  // Income
  doc.setFont('helvetica', 'bold');
  doc.text('Total Income:', col1X, yPos + 20);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(rgb(34, 197, 94));
  doc.text(formatCurrency(totalIncome), col1X + 50, yPos + 20);
  doc.setTextColor('#000000');

  // Expenses
  doc.setFont('helvetica', 'bold');
  doc.text('Total Expenses:', col1X, yPos + 28);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(rgb(239, 68, 68));
  doc.text(formatCurrency(totalExpense), col1X + 50, yPos + 28);
  doc.setTextColor('#000000');

  // Net Balance
  doc.setFont('helvetica', 'bold');
  doc.text('Net Balance:', col2X, yPos + 20);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(netBalance >= 0 ? rgb(34, 197, 94) : rgb(239, 68, 68));
  doc.text(formatCurrency(netBalance), col2X + 40, yPos + 20);
  doc.setTextColor('#000000');

  // Total Savings
  doc.setFont('helvetica', 'bold');
  doc.text('Total Savings:', col2X, yPos + 28);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(rgb(59, 130, 246));
  doc.text(formatCurrency(totalSavings), col2X + 40, yPos + 28);
  doc.setTextColor('#000000');

  yPos += 50;

  // Income Table
  if (filteredIncomes.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(rgb(34, 197, 94));
    doc.text('INCOME', 14, yPos);
    doc.setDrawColor(rgb(34, 197, 94));
    doc.line(14, yPos + 2, pageWidth - 14, yPos + 2);
    doc.setTextColor('#000000');
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Source', 'Category', 'Method', 'Amount']],
      body: filteredIncomes.map(i => [
        formatDate(i.tanggal),
        i.sumber,
        i.kategori,
        i.metode,
        formatCurrency(i.jumlah)
      ]),
      foot: [['', '', '', 'TOTAL', formatCurrency(totalIncome)]],
      theme: 'grid',
      headStyles: { fillColor: rgb(34, 197, 94), textColor: '#ffffff', fontStyle: 'bold' },
      footStyles: { fillColor: rgb(220, 252, 231), textColor: '#000000', fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4, valign: 'middle' },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Check if need new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Expense Table
  if (filteredExpenses.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(rgb(239, 68, 68));
    doc.text('EXPENSES', 14, yPos);
    doc.setDrawColor(rgb(239, 68, 68));
    doc.line(14, yPos + 2, pageWidth - 14, yPos + 2);
    doc.setTextColor('#000000');
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Name', 'Category', 'Method', 'Amount']],
      body: filteredExpenses.map(e => [
        formatDate(e.tanggal),
        e.nama,
        e.kategori,
        e.metode,
        formatCurrency(e.jumlah)
      ]),
      foot: [['', '', '', 'TOTAL', formatCurrency(totalExpense)]],
      theme: 'grid',
      headStyles: { fillColor: rgb(239, 68, 68), textColor: '#ffffff', fontStyle: 'bold' },
      footStyles: { fillColor: rgb(254, 226, 226), textColor: '#000000', fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4, valign: 'middle' },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Check if need new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Budget Table
  if (filteredBudgets.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(rgb(59, 130, 246));
    doc.text('BUDGET', 14, yPos);
    doc.setDrawColor(rgb(59, 130, 246));
    doc.line(14, yPos + 2, pageWidth - 14, yPos + 2);
    doc.setTextColor('#000000');
    yPos += 8;

    const budgetData = filteredBudgets.map(b => {
      const realisasi = filteredExpenses
        .filter(e => e.kategori === b.kategori)
        .reduce((sum, e) => sum + e.jumlah, 0);
      const selisih = b.anggaran - realisasi;
      const status = realisasi <= b.anggaran ? 'On Track' : 'Over Budget';

      return [
        b.kategori,
        formatCurrency(b.anggaran),
        formatCurrency(realisasi),
        formatCurrency(selisih),
        status
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Category', 'Budget', 'Actual', 'Variance', 'Status']],
      body: budgetData,
      theme: 'grid',
      headStyles: { fillColor: rgb(59, 130, 246), textColor: '#ffffff', fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4, valign: 'middle' },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'center' }
      },
      didParseCell: function(data: any) {
        if (data.section === 'body' && data.column.index === 4) {
          if (data.cell.raw === 'Over Budget') {
            data.cell.styles.textColor = rgb(239, 68, 68);
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = rgb(34, 197, 94);
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Check if need new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Expense by Category Summary
  if (filteredExpenses.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(rgb(251, 146, 60));
    doc.text('EXPENSES BY CATEGORY', 14, yPos);
    doc.setDrawColor(rgb(251, 146, 60));
    doc.line(14, yPos + 2, pageWidth - 14, yPos + 2);
    doc.setTextColor('#000000');
    yPos += 8;

    const categoryTotals: { [key: string]: number } = {};
    filteredExpenses.forEach(e => {
      if (!categoryTotals[e.kategori]) categoryTotals[e.kategori] = 0;
      categoryTotals[e.kategori] += e.jumlah;
    });

    const categoryData = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([kategori, jumlah]) => [
        kategori,
        formatCurrency(jumlah),
        ((jumlah / totalExpense) * 100).toFixed(1) + '%'
      ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Category', 'Amount', '%']],
      body: categoryData,
      foot: [['TOTAL', formatCurrency(totalExpense), '100%']],
      theme: 'grid',
      headStyles: { fillColor: rgb(251, 146, 60), textColor: '#ffffff', fontStyle: 'bold' },
      footStyles: { fillColor: rgb(255, 237, 213), textColor: '#000000', fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4, valign: 'middle' },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'center' }
      }
    });
  }

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(rgb(128, 128, 128));
    doc.text(
      `Page ${i} of ${pageCount} - Generated by My Local Wallet`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    const today = new Date().toISOString().split('T')[0];
    doc.text(today, pageWidth - 14, pageHeight - 10, { align: 'right' });
  }

  // Save
  const periodStr = selectedMonth === 'all'
    ? 'all-periods'
    : selectedMonth;
  const fileName = `financial-report-${periodStr}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

// Helper to format month as "Month YYYY" (English)
function formatMonthName(monthStr: string): string {
  if (!monthStr || monthStr === 'all') return 'All Periods';
  const [year, month] = monthStr.split('-');
  if (!year || !month || isNaN(parseInt(year)) || isNaN(parseInt(month))) {
    return monthStr;
  }
  const date = new Date(parseInt(year), parseInt(month) - 1);
  const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
  return new Intl.DateTimeFormat('en-US', options).format(date);
}
