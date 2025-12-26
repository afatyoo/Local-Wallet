import { useMemo } from 'react';
import { useFinanceStore } from '@/stores/financeStore';
import { differenceInMonths, parseISO, format } from 'date-fns';

export interface SavingsTarget {
  id: string;
  userId: string;
  namaTarget: string;
  targetAmount: number;
  currentAmount: number;
  startDate: string;
  targetDate: string;
  status: 'Aktif' | 'Tercapai';
  linkedAccount: string; // nama akun tabungan yang terkait
}

interface Milestone {
  percentage: number;
  label: string;
  reached: boolean;
  reachedDate?: string;
}

interface TargetWithProgress extends SavingsTarget {
  progress: number;
  remaining: number;
  milestones: Milestone[];
  monthsRemaining: number;
  monthlyRequired: number;
  isOnTrack: boolean;
}

interface TargetInsight {
  targetId: string;
  targetName: string;
  message: string;
  type: 'success' | 'warning' | 'info';
}

/**
 * Hook untuk mengelola target tabungan dengan milestone
 * 
 * Cara kerja:
 * 1. Ambil data target dari localStorage
 * 2. Hitung currentAmount dari data savings yang terkait
 * 3. Hitung progress dan milestone
 * 4. Generate insights otomatis
 */
export function useSavingsTargets() {
  const { savings } = useFinanceStore();

  // Hitung saldo per akun tabungan
  const accountBalances = useMemo(() => {
    const balances: { [account: string]: number } = {};
    
    savings
      .filter((s) => s.jenis === 'Tabungan')
      .forEach((s) => {
        if (!balances[s.namaAkun]) {
          balances[s.namaAkun] = 0;
        }
        balances[s.namaAkun] += s.setoran - s.penarikan;
      });

    return balances;
  }, [savings]);

  // Ambil daftar nama akun untuk dropdown
  const accountNames = useMemo(() => {
    return Object.keys(accountBalances);
  }, [accountBalances]);

  // Fungsi untuk menghitung progress target
  const calculateProgress = (target: SavingsTarget): TargetWithProgress => {
    const currentAmount = accountBalances[target.linkedAccount] || 0;
    const progress = target.targetAmount > 0 
      ? Math.min((currentAmount / target.targetAmount) * 100, 100) 
      : 0;
    const remaining = Math.max(target.targetAmount - currentAmount, 0);

    // Hitung milestone
    const milestones: Milestone[] = [
      { percentage: 25, label: '25%', reached: progress >= 25 },
      { percentage: 50, label: '50%', reached: progress >= 50 },
      { percentage: 75, label: '75%', reached: progress >= 75 },
      { percentage: 100, label: '100%', reached: progress >= 100 },
    ];

    // Hitung bulan tersisa
    const today = new Date();
    const targetDate = parseISO(target.targetDate);
    const monthsRemaining = Math.max(differenceInMonths(targetDate, today), 0);

    // Hitung kebutuhan bulanan
    const monthlyRequired = monthsRemaining > 0 ? remaining / monthsRemaining : remaining;

    // Cek apakah on track (punya waktu cukup)
    const isOnTrack = monthsRemaining > 0 || progress >= 100;

    return {
      ...target,
      currentAmount,
      progress,
      remaining,
      milestones,
      monthsRemaining,
      monthlyRequired,
      isOnTrack,
      status: progress >= 100 ? 'Tercapai' : 'Aktif',
    };
  };

  // Generate insights untuk setiap target
  const generateInsights = (targetsWithProgress: TargetWithProgress[]): TargetInsight[] => {
    const insights: TargetInsight[] = [];

    targetsWithProgress.forEach((target) => {
      // Progress insight
      if (target.progress >= 100) {
        insights.push({
          targetId: target.id,
          targetName: target.namaTarget,
          message: `Target "${target.namaTarget}" sudah tercapai! 🎉`,
          type: 'success',
        });
      } else if (target.progress >= 75) {
        insights.push({
          targetId: target.id,
          targetName: target.namaTarget,
          message: `Target "${target.namaTarget}" sudah ${target.progress.toFixed(0)}% tercapai!`,
          type: 'success',
        });
      } else if (!target.isOnTrack) {
        insights.push({
          targetId: target.id,
          targetName: target.namaTarget,
          message: `Target "${target.namaTarget}" sudah melewati tenggat waktu`,
          type: 'warning',
        });
      } else if (target.monthlyRequired > 0) {
        insights.push({
          targetId: target.id,
          targetName: target.namaTarget,
          message: `Butuh Rp ${target.monthlyRequired.toLocaleString('id-ID')}/bulan untuk mencapai "${target.namaTarget}" tepat waktu`,
          type: 'info',
        });
      }
    });

    return insights;
  };

  return {
    accountBalances,
    accountNames,
    calculateProgress,
    generateInsights,
  };
}

// Key untuk localStorage
export const TARGETS_STORAGE_KEY = 'finance_savings_targets';

// Fungsi helper untuk CRUD target di localStorage
export function getTargetsFromStorage(userId: string): SavingsTarget[] {
  try {
    const stored = localStorage.getItem(TARGETS_STORAGE_KEY);
    if (!stored) return [];
    const allTargets: SavingsTarget[] = JSON.parse(stored);
    return allTargets.filter((t) => t.userId === userId);
  } catch {
    return [];
  }
}

export function saveTargetsToStorage(targets: SavingsTarget[]): void {
  try {
    // Get all targets from storage
    const stored = localStorage.getItem(TARGETS_STORAGE_KEY);
    let allTargets: SavingsTarget[] = stored ? JSON.parse(stored) : [];
    
    // Remove targets for this user
    if (targets.length > 0) {
      const userId = targets[0].userId;
      allTargets = allTargets.filter((t) => t.userId !== userId);
    }
    
    // Add updated targets
    allTargets = [...allTargets, ...targets];
    
    localStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(allTargets));
  } catch (error) {
    console.error('Error saving targets:', error);
  }
}

export function addTarget(target: SavingsTarget): void {
  const targets = getTargetsFromStorage(target.userId);
  targets.push(target);
  saveTargetsToStorage(targets);
}

export function updateTarget(targetId: string, updates: Partial<SavingsTarget>): void {
  const stored = localStorage.getItem(TARGETS_STORAGE_KEY);
  if (!stored) return;
  
  const allTargets: SavingsTarget[] = JSON.parse(stored);
  const updatedTargets = allTargets.map((t) => 
    t.id === targetId ? { ...t, ...updates } : t
  );
  
  localStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(updatedTargets));
}

export function deleteTarget(targetId: string): void {
  const stored = localStorage.getItem(TARGETS_STORAGE_KEY);
  if (!stored) return;
  
  const allTargets: SavingsTarget[] = JSON.parse(stored);
  const filteredTargets = allTargets.filter((t) => t.id !== targetId);
  
  localStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(filteredTargets));
}
