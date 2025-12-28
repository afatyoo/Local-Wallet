import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Income, Expense, Budget, Saving } from './db';
import { formatCurrency, formatDate, getMonthName } from './utils';

interface ReportData {
  incomes: Income[];
  expenses: Expense[];
  budgets: Budget[];
  savings: Saving[];
  selectedMonth: string;
  username: string;
}

export function generateFinanceReport(data: ReportData) {
  const { incomes, expenses, budgets, savings, selectedMonth, username } = data;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
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
  
  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN KEUANGAN', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const periodText = getMonthName(selectedMonth);
  doc.text(`Periode: ${periodText}`, pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 7;
  doc.setFontSize(10);
  doc.text(`Dibuat oleh: ${username}`, pageWidth / 2, yPos, { align: 'center' });
  doc.text(`Tanggal cetak: ${formatDate(new Date().toISOString())}`, pageWidth / 2, yPos + 5, { align: 'center' });
  
  yPos += 20;
  
  // Summary Box
  doc.setFillColor(240, 240, 240);
  doc.rect(14, yPos, pageWidth - 28, 35, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RINGKASAN KEUANGAN', 20, yPos + 8);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const col1X = 20;
  const col2X = pageWidth / 2 + 10;
  
  doc.text(`Total Pemasukan:`, col1X, yPos + 18);
  doc.text(formatCurrency(totalIncome), col1X + 50, yPos + 18);
  
  doc.text(`Total Pengeluaran:`, col1X, yPos + 26);
  doc.text(formatCurrency(totalExpense), col1X + 50, yPos + 26);
  
  doc.text(`Saldo Bersih:`, col2X, yPos + 18);
  doc.setTextColor(netBalance >= 0 ? 0 : 255, netBalance >= 0 ? 128 : 0, 0);
  doc.text(formatCurrency(netBalance), col2X + 40, yPos + 18);
  doc.setTextColor(0, 0, 0);
  
  doc.text(`Total Tabungan:`, col2X, yPos + 26);
  doc.text(formatCurrency(totalSavings), col2X + 40, yPos + 26);
  
  yPos += 45;
  
  // Income Table
  if (filteredIncomes.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('PEMASUKAN', 14, yPos);
    yPos += 5;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Tanggal', 'Sumber', 'Kategori', 'Metode', 'Jumlah']],
      body: filteredIncomes.map(i => [
        formatDate(i.tanggal),
        i.sumber,
        i.kategori,
        i.metode,
        formatCurrency(i.jumlah)
      ]),
      foot: [['', '', '', 'TOTAL', formatCurrency(totalIncome)]],
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94], textColor: 255 },
      footStyles: { fillColor: [220, 252, 231], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        4: { halign: 'right' }
      }
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Check if need new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  // Expense Table
  if (filteredExpenses.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('PENGELUARAN', 14, yPos);
    yPos += 5;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Tanggal', 'Nama', 'Kategori', 'Metode', 'Jumlah']],
      body: filteredExpenses.map(e => [
        formatDate(e.tanggal),
        e.nama,
        e.kategori,
        e.metode,
        formatCurrency(e.jumlah)
      ]),
      foot: [['', '', '', 'TOTAL', formatCurrency(totalExpense)]],
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68], textColor: 255 },
      footStyles: { fillColor: [254, 226, 226], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        4: { halign: 'right' }
      }
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Check if need new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  // Budget Table
  if (filteredBudgets.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ANGGARAN', 14, yPos);
    yPos += 5;
    
    const budgetData = filteredBudgets.map(b => {
      const realisasi = filteredExpenses
        .filter(e => e.kategori === b.kategori)
        .reduce((sum, e) => sum + e.jumlah, 0);
      const selisih = b.anggaran - realisasi;
      const status = realisasi <= b.anggaran ? 'Aman' : 'Over Budget';
      
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
      head: [['Kategori', 'Anggaran', 'Realisasi', 'Selisih', 'Status']],
      body: budgetData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'center' }
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 4) {
          if (data.cell.raw === 'Over Budget') {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [34, 197, 94];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Check if need new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  // Expense by Category Summary
  if (filteredExpenses.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('PENGELUARAN PER KATEGORI', 14, yPos);
    yPos += 5;
    
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
      head: [['Kategori', 'Total', 'Persentase']],
      body: categoryData,
      foot: [['TOTAL', formatCurrency(totalExpense), '100%']],
      theme: 'striped',
      headStyles: { fillColor: [251, 146, 60], textColor: 255 },
      footStyles: { fillColor: [255, 237, 213], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' }
      }
    });
  }
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Halaman ${i} dari ${pageCount} - Digenerate oleh FinanceApp`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  // Save
  const fileName = selectedMonth === 'all' 
    ? `laporan-keuangan-semua-periode-${new Date().toISOString().split('T')[0]}.pdf`
    : `laporan-keuangan-${selectedMonth}.pdf`;
  
  doc.save(fileName);
}
