import { useMemo } from 'react';
import { useFinanceStore } from '@/stores/financeStore';
import { useTranslation } from '@/lib/i18n';

interface CategoryData {
  name: string;
  value: number;
  percentage: number;
  count: number;
}

interface ExpenseInsights {
  categoryData: CategoryData[];
  totalExpense: number;
  topCategory: CategoryData | null;
  topThreeCategories: CategoryData[];
  insights: string[];
  getTransactionsByCategory: (category: string) => { id: string; tanggal: string; nama: string; jumlah: number; kategori: string; catatan: string }[];
}

/**
 * Hook untuk menganalisis pengeluaran dan menghasilkan insights
 * 
 * Cara kerja:
 * 1. Mengambil data expenses dari store berdasarkan bulan yang dipilih
 * 2. Mengelompokkan pengeluaran per kategori
 * 3. Menghitung persentase dan total
 * 4. Menghasilkan insights otomatis dalam bahasa yang dipilih
 */
export function useExpenseInsights(selectedMonth: string): ExpenseInsights {
  const { expenses } = useFinanceStore();
  const { t, language } = useTranslation();

  // Filter expenses berdasarkan bulan yang dipilih
  const monthlyExpenses = useMemo(() => {
    if (selectedMonth === 'all') {
      return expenses;
    }
    return expenses.filter((e) => e.bulan === selectedMonth);
  }, [expenses, selectedMonth]);

  // Hitung total pengeluaran
  const totalExpense = useMemo(() => {
    return monthlyExpenses.reduce((sum, e) => sum + e.jumlah, 0);
  }, [monthlyExpenses]);

  // Kelompokkan per kategori dan hitung statistik
  const categoryData = useMemo((): CategoryData[] => {
    const grouped: { [key: string]: { total: number; count: number } } = {};

    monthlyExpenses.forEach((expense) => {
      if (!grouped[expense.kategori]) {
        grouped[expense.kategori] = { total: 0, count: 0 };
      }
      grouped[expense.kategori].total += expense.jumlah;
      grouped[expense.kategori].count += 1;
    });

    return Object.entries(grouped)
      .map(([name, data]) => ({
        name,
        value: data.total,
        percentage: totalExpense > 0 ? (data.total / totalExpense) * 100 : 0,
        count: data.count,
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthlyExpenses, totalExpense]);

  // Kategori teratas
  const topCategory = useMemo(() => {
    return categoryData.length > 0 ? categoryData[0] : null;
  }, [categoryData]);

  // Top 3 kategori
  const topThreeCategories = useMemo(() => {
    return categoryData.slice(0, 3);
  }, [categoryData]);

  // Generate insights otomatis
  const insights = useMemo((): string[] => {
    const result: string[] = [];

    if (topCategory) {
      // Insight 1: Kategori terbesar
      const percentText = topCategory.percentage.toFixed(0);
      result.push(
        t('insights_largest_category').replace('{percent}', percentText).replace('{category}', topCategory.name)
      );

      // Insight 2: Kategori paling boros
      if (topCategory.percentage >= 30) {
        result.push(
          t('insights_highest_spending').replace('{category}', topCategory.name)
        );
      }
    }

    // Insight 3: Top 3 categories
    if (topThreeCategories.length >= 3) {
      const top3Names = topThreeCategories.map(c => c.name).join(', ');
      result.push(
        t('insights_top_three').replace('{categories}', top3Names)
      );
    }

    // Insight 4: Jumlah kategori
    if (categoryData.length > 0) {
      result.push(
        t('insights_category_count').replace('{count}', String(categoryData.length))
      );
    }

    return result;
  }, [topCategory, topThreeCategories, categoryData, t]);

  // Fungsi untuk mendapatkan transaksi berdasarkan kategori
  const getTransactionsByCategory = (category: string) => {
    return monthlyExpenses.filter((e) => e.kategori === category);
  };

  return {
    categoryData,
    totalExpense,
    topCategory,
    topThreeCategories,
    insights,
    getTransactionsByCategory,
  };
}
