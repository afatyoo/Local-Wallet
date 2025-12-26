import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString));
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthName(monthStr: string): string {
  if (!monthStr || monthStr === 'all') {
    return 'Semua Periode';
  }
  const [year, month] = monthStr.split('-');
  if (!year || !month || isNaN(parseInt(year)) || isNaN(parseInt(month))) {
    return monthStr;
  }
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
}

export function getMonthFromDate(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [
    { value: 'all', label: 'Semua Periode' }
  ];
  const now = new Date();
  
  for (let i = 0; i <= 11; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
    options.push({ value, label });
  }
  
  return options;
}

/**
 * Generate dynamic month options based on actual transaction dates
 * Scans all dates and creates options from oldest to newest
 */
export function generateDynamicMonthOptions(dates: string[]): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [
    { value: 'all', label: 'Semua Periode' }
  ];
  
  if (dates.length === 0) {
    // Fallback to current month if no data
    const now = new Date();
    const value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(now);
    options.push({ value, label });
    return options;
  }
  
  // Get unique months from all dates
  const monthSet = new Set<string>();
  const now = new Date();
  
  // Always include current month
  monthSet.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  
  dates.forEach(dateStr => {
    if (dateStr) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthSet.add(monthKey);
      }
    }
  });
  
  // Convert to array and sort descending (newest first)
  const sortedMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  
  sortedMonths.forEach(monthKey => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
    options.push({ value: monthKey, label });
  });
  
  return options;
}
