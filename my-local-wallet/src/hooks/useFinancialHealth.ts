import { useMemo } from 'react';
import { useFinanceStore } from '@/stores/financeStore';
import { useTranslation } from '@/lib/i18n';
import { getCurrentMonth, getMonthFromDate } from '@/lib/utils';

interface HealthScoreBreakdown {
  savingRatio: number; // 0-40 points
  budgetDiscipline: number; // 0-30 points
  spendingStability: number; // 0-20 points
  consistencyScore: number; // 0-10 points
}

interface FinancialHealthResult {
  totalScore: number;
  breakdown: HealthScoreBreakdown;
  status: 'healthy' | 'moderate' | 'needs_attention';
  statusColor: string;
  statusEmoji: string;
  recommendations: string[];
  savingRatioPercent: number;
  overBudgetCategories: string[];
  spendingChange: number;
  activeDaysPercent: number;
}

/**
 * Hook untuk menghitung Financial Health Score
 * 
 * Perhitungan skor:
 * 1. Saving Ratio (40 poin) - (Total tabungan / total pemasukan) × 100
 * 2. Budget Discipline (30 poin) - Jumlah kategori yang tidak over budget
 * 3. Spending Stability (20 poin) - Perbandingan pengeluaran bulan ini vs bulan lalu
 * 4. Consistency Score (10 poin) - Konsistensi input transaksi (jumlah hari tercatat)
 */
export function useFinancialHealth(): FinancialHealthResult {
  const { incomes, expenses, savings, budgets, selectedMonth } = useFinanceStore();
  const { t } = useTranslation();

  const currentMonth = selectedMonth === 'all' ? getCurrentMonth() : selectedMonth;

  // Hitung bulan sebelumnya
  const previousMonth = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  }, [currentMonth]);

  // Filter data berdasarkan bulan
  const monthlyIncomes = useMemo(() => 
    incomes.filter((i) => i.bulan === currentMonth),
    [incomes, currentMonth]
  );

  const monthlyExpenses = useMemo(() => 
    expenses.filter((e) => e.bulan === currentMonth),
    [expenses, currentMonth]
  );

  const previousMonthExpenses = useMemo(() => 
    expenses.filter((e) => e.bulan === previousMonth),
    [expenses, previousMonth]
  );

  const monthlySavings = useMemo(() => 
    savings.filter((s) => getMonthFromDate(s.tanggal) === currentMonth),
    [savings, currentMonth]
  );

  const monthlyBudgets = useMemo(() => 
    budgets.filter((b) => b.bulan === currentMonth),
    [budgets, currentMonth]
  );

  // === PERHITUNGAN SKOR ===

  // 1. SAVING RATIO (40 poin)
  // Rumus: (Total tabungan / total pemasukan) × 100, max 40 poin
  const { savingRatioScore, savingRatioPercent } = useMemo(() => {
    const totalIncome = monthlyIncomes.reduce((sum, i) => sum + i.jumlah, 0);
    const totalSavings = monthlySavings.reduce((sum, s) => sum + (s.setoran - s.penarikan), 0);
    
    if (totalIncome === 0) {
      return { savingRatioScore: 0, savingRatioPercent: 0 };
    }

    const ratio = (totalSavings / totalIncome) * 100;
    // Target: 20% tabungan = 40 poin penuh
    // Skor = (ratio / 20) × 40, max 40
    const score = Math.min(40, (ratio / 20) * 40);
    
    return { 
      savingRatioScore: Math.max(0, score), 
      savingRatioPercent: ratio 
    };
  }, [monthlyIncomes, monthlySavings]);

  // 2. BUDGET DISCIPLINE (30 poin)
  // Rumus: (Kategori tidak over budget / total kategori) × 30
  const { budgetDisciplineScore, overBudgetCategories } = useMemo(() => {
    if (monthlyBudgets.length === 0) {
      return { budgetDisciplineScore: 15, overBudgetCategories: [] }; // Default 50% jika tidak ada budget
    }

    const overBudget: string[] = [];
    
    monthlyBudgets.forEach((budget) => {
      const spent = monthlyExpenses
        .filter((e) => e.kategori === budget.kategori)
        .reduce((sum, e) => sum + e.jumlah, 0);
      
      if (spent > budget.anggaran) {
        overBudget.push(budget.kategori);
      }
    });

    const disciplinedCategories = monthlyBudgets.length - overBudget.length;
    const score = (disciplinedCategories / monthlyBudgets.length) * 30;

    return { 
      budgetDisciplineScore: score, 
      overBudgetCategories: overBudget 
    };
  }, [monthlyBudgets, monthlyExpenses]);

  // 3. SPENDING STABILITY (20 poin)
  // Rumus: Jika pengeluaran stabil atau turun = 20 poin, naik drastis = skor berkurang
  const { spendingStabilityScore, spendingChange } = useMemo(() => {
    const currentSpending = monthlyExpenses.reduce((sum, e) => sum + e.jumlah, 0);
    const previousSpending = previousMonthExpenses.reduce((sum, e) => sum + e.jumlah, 0);

    if (previousSpending === 0) {
      return { spendingStabilityScore: 10, spendingChange: 0 }; // Default 50% jika tidak ada data sebelumnya
    }

    const changePercent = ((currentSpending - previousSpending) / previousSpending) * 100;
    
    let score: number;
    if (changePercent <= 0) {
      // Pengeluaran turun atau sama = skor penuh
      score = 20;
    } else if (changePercent <= 10) {
      // Naik sedikit (0-10%) = skor tinggi
      score = 18;
    } else if (changePercent <= 25) {
      // Naik sedang (10-25%) = skor medium
      score = 12;
    } else if (changePercent <= 50) {
      // Naik cukup banyak (25-50%) = skor rendah
      score = 6;
    } else {
      // Naik drastis (>50%) = skor minimal
      score = 2;
    }

    return { 
      spendingStabilityScore: score, 
      spendingChange: changePercent 
    };
  }, [monthlyExpenses, previousMonthExpenses]);

  // 4. CONSISTENCY SCORE (10 poin)
  // Rumus: (Jumlah hari dengan transaksi / total hari dalam bulan) × 10
  const { consistencyScore, activeDaysPercent } = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Ambil hari unik yang memiliki transaksi
    const uniqueDays = new Set<string>();
    
    [...monthlyIncomes, ...monthlyExpenses].forEach((transaction) => {
      uniqueDays.add(transaction.tanggal);
    });

    const activeDays = uniqueDays.size;
    const percent = (activeDays / daysInMonth) * 100;
    
    // Target: minimal 10 hari transaksi = 10 poin penuh
    const score = Math.min(10, (activeDays / 10) * 10);

    return { 
      consistencyScore: score, 
      activeDaysPercent: percent 
    };
  }, [currentMonth, monthlyIncomes, monthlyExpenses]);

  // === TOTAL SKOR ===
  const totalScore = useMemo(() => {
    return Math.round(
      savingRatioScore + 
      budgetDisciplineScore + 
      spendingStabilityScore + 
      consistencyScore
    );
  }, [savingRatioScore, budgetDisciplineScore, spendingStabilityScore, consistencyScore]);

  // === STATUS ===
  const { status, statusColor, statusEmoji } = useMemo(() => {
    if (totalScore >= 80) {
      return { 
        status: 'healthy' as const, 
        statusColor: 'text-income',
        statusEmoji: '🟢'
      };
    } else if (totalScore >= 60) {
      return { 
        status: 'moderate' as const, 
        statusColor: 'text-yellow-500',
        statusEmoji: '🟡'
      };
    } else {
      return { 
        status: 'needs_attention' as const, 
        statusColor: 'text-expense',
        statusEmoji: '🔴'
      };
    }
  }, [totalScore]);

  // === REKOMENDASI ===
  const recommendations = useMemo((): string[] => {
    const recs: string[] = [];

    // Rekomendasi berdasarkan saving ratio
    if (savingRatioPercent < 10) {
      recs.push(t('health_rec_increase_savings'));
    }

    // Rekomendasi berdasarkan budget discipline
    if (overBudgetCategories.length > 0) {
      recs.push(
        t('health_rec_over_budget').replace('{categories}', overBudgetCategories.join(', '))
      );
    }

    // Rekomendasi berdasarkan spending stability
    if (spendingChange > 25) {
      recs.push(t('health_rec_reduce_spending'));
    }

    // Rekomendasi berdasarkan consistency
    if (consistencyScore < 5) {
      recs.push(t('health_rec_track_regularly'));
    }

    // Jika skor bagus
    if (totalScore >= 80 && recs.length === 0) {
      recs.push(t('health_rec_good_job'));
    }

    return recs;
  }, [savingRatioPercent, overBudgetCategories, spendingChange, consistencyScore, totalScore, t]);

  return {
    totalScore,
    breakdown: {
      savingRatio: Math.round(savingRatioScore),
      budgetDiscipline: Math.round(budgetDisciplineScore),
      spendingStability: Math.round(spendingStabilityScore),
      consistencyScore: Math.round(consistencyScore),
    },
    status,
    statusColor,
    statusEmoji,
    recommendations,
    savingRatioPercent,
    overBudgetCategories,
    spendingChange,
    activeDaysPercent,
  };
}
