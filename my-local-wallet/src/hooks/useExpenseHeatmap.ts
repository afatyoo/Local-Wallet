import { useMemo } from 'react';
import { useFinanceStore } from '@/stores/financeStore';
import { useTranslation } from '@/lib/i18n';
import { format, getDaysInMonth, parseISO, startOfMonth, getDay } from 'date-fns';

interface DayData {
  date: string;
  day: number;
  total: number;
  transactions: { id: string; nama: string; kategori: string; jumlah: number }[];
  intensity: 'none' | 'low' | 'medium' | 'high' | 'very-high';
}

interface HeatmapInsights {
  mostExpensiveDay: { date: string; total: number } | null;
  zeroExpenseDays: number;
  averageDaily: number;
  totalExpense: number;
  activeDays: number;
}

interface ExpenseHeatmapResult {
  daysData: DayData[];
  insights: HeatmapInsights;
  monthName: string;
  firstDayOffset: number;
  daysInMonth: number;
}

/**
 * Hook untuk menghasilkan data heatmap pengeluaran
 * 
 * Cara kerja:
 * 1. Filter expenses berdasarkan bulan yang dipilih
 * 2. Group by tanggal dan hitung total per hari
 * 3. Tentukan intensitas warna berdasarkan quartile
 * 4. Generate insights otomatis
 */
export function useExpenseHeatmap(selectedMonth: string): ExpenseHeatmapResult {
  const { expenses } = useFinanceStore();
  const { t, language } = useTranslation();

  // Parse bulan yang dipilih (format: YYYY-MM)
  // Tambahkan validasi untuk menghindari Invalid Date
  const parts = selectedMonth?.split('-') || [];
  const year = parseInt(parts[0]) || new Date().getFullYear();
  const month = (parseInt(parts[1]) || new Date().getMonth() + 1) - 1; // 0-indexed

  // Validasi year dan month
  const validYear = isNaN(year) ? new Date().getFullYear() : year;
  const validMonth = isNaN(month) || month < 0 || month > 11 ? new Date().getMonth() : month;

  // Hitung jumlah hari dalam bulan dan offset hari pertama
  const daysInMonth = getDaysInMonth(new Date(validYear, validMonth));
  const firstDayOfMonth = startOfMonth(new Date(validYear, validMonth));
  const firstDayOffset = getDay(firstDayOfMonth); // 0 = Sunday

  // Filter expenses untuk bulan ini
  const monthlyExpenses = useMemo(() => {
    return expenses.filter((e) => e.bulan === selectedMonth);
  }, [expenses, selectedMonth]);

  // Group by tanggal
  const expensesByDate = useMemo(() => {
    const grouped: { [date: string]: { total: number; transactions: DayData['transactions'] } } = {};

    monthlyExpenses.forEach((expense) => {
      const date = expense.tanggal;
      if (!grouped[date]) {
        grouped[date] = { total: 0, transactions: [] };
      }
      grouped[date].total += expense.jumlah;
      grouped[date].transactions.push({
        id: expense.id,
        nama: expense.nama,
        kategori: expense.kategori,
        jumlah: expense.jumlah,
      });
    });

    return grouped;
  }, [monthlyExpenses]);

  // Hitung quartiles untuk menentukan intensitas
  const quartiles = useMemo(() => {
    const totals = Object.values(expensesByDate)
      .map((d) => d.total)
      .filter((t) => t > 0)
      .sort((a, b) => a - b);

    if (totals.length === 0) {
      return { q1: 0, q2: 0, q3: 0, max: 0 };
    }

    const q1Index = Math.floor(totals.length * 0.25);
    const q2Index = Math.floor(totals.length * 0.5);
    const q3Index = Math.floor(totals.length * 0.75);

    return {
      q1: totals[q1Index] || 0,
      q2: totals[q2Index] || 0,
      q3: totals[q3Index] || 0,
      max: totals[totals.length - 1] || 0,
    };
  }, [expensesByDate]);

  // Generate data untuk setiap hari
  const daysData = useMemo((): DayData[] => {
    const data: DayData[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
      const dayData = expensesByDate[dateStr];
      const total = dayData?.total || 0;
      const transactions = dayData?.transactions || [];

      // Tentukan intensitas berdasarkan quartile
      let intensity: DayData['intensity'] = 'none';
      if (total > 0) {
        if (total <= quartiles.q1) {
          intensity = 'low';
        } else if (total <= quartiles.q2) {
          intensity = 'medium';
        } else if (total <= quartiles.q3) {
          intensity = 'high';
        } else {
          intensity = 'very-high';
        }
      }

      data.push({
        date: dateStr,
        day,
        total,
        transactions,
        intensity,
      });
    }

    return data;
  }, [daysInMonth, selectedMonth, expensesByDate, quartiles]);

  // Generate insights
  const insights = useMemo((): HeatmapInsights => {
    const activeDays = daysData.filter((d) => d.total > 0);
    const zeroExpenseDays = daysData.filter((d) => d.total === 0).length;
    const totalExpense = activeDays.reduce((sum, d) => sum + d.total, 0);
    const averageDaily = daysInMonth > 0 ? totalExpense / daysInMonth : 0;

    // Cari hari paling boros
    const mostExpensiveDay = activeDays.length > 0
      ? activeDays.reduce((max, d) => (d.total > max.total ? d : max))
      : null;

    return {
      mostExpensiveDay: mostExpensiveDay
        ? { date: mostExpensiveDay.date, total: mostExpensiveDay.total }
        : null,
      zeroExpenseDays,
      averageDaily,
      totalExpense,
      activeDays: activeDays.length,
    };
  }, [daysData, daysInMonth]);

  // Format nama bulan
  const monthName = useMemo(() => {
    try {
      const date = new Date(validYear, validMonth);
      if (isNaN(date.getTime())) {
        return `${validMonth + 1}/${validYear}`;
      }
      return format(date, 'MMMM yyyy');
    } catch {
      return `${validMonth + 1}/${validYear}`;
    }
  }, [validYear, validMonth]);

  return {
    daysData,
    insights,
    monthName,
    firstDayOffset,
    daysInMonth,
  };
}
