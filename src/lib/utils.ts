import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLanguageStore } from '@/lib/i18n';
import { useCurrencyStore, type CurrencyCode } from '@/stores/currencyStore';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LANGUAGE_TO_LOCALE: Record<string, string> = {
  id: 'id-ID',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-PT',
  ru: 'ru-RU',
  ar: 'ar-SA',
  hi: 'hi-IN',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
};

const ZERO_DECIMAL_CURRENCIES = new Set<string>(['IDR', 'JPY', 'KRW']);

export function getCurrencyFractionDigits(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
}

function getActiveLocale(): string {
  const lang = useLanguageStore.getState().language;
  return LANGUAGE_TO_LOCALE[lang] || 'id-ID';
}

function getDisplayCurrency(): CurrencyCode {
  return useCurrencyStore.getState().displayCurrency;
}

function getRates() {
  return useCurrencyStore.getState().rates || { IDR: 1 };
}

/**
 * Convert from base currency (IDR) to target currency.
 * Rates are stored as: 1 IDR = X <currency>
 */
export function convertFromBase(amountIDR: number, target?: CurrencyCode): { value: number; currency: CurrencyCode } {
  const base: CurrencyCode = 'IDR';
  const currency = target || getDisplayCurrency();
  if (currency === base) return { value: amountIDR, currency: base };

  const rates = getRates();
  const rate = rates[currency];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    // If rates unavailable, keep safe: show base amount in base currency
    return { value: amountIDR, currency: base };
  }
  return { value: amountIDR * rate, currency };
}

/**
 * Convert from display currency back to base (IDR).
 */
export function convertToBase(amountInDisplay: number, display?: CurrencyCode): number {
  const base: CurrencyCode = 'IDR';
  const currency = display || getDisplayCurrency();
  if (currency === base) return amountInDisplay;

  const rates = getRates();
  const rate = rates[currency];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    // If rates unavailable, assume input already in base
    return amountInDisplay;
  }
  return amountInDisplay / rate;
}

/**
 * Format amount that is STORED in base currency (IDR).
 * The output currency follows the user setting (Settings → Currency).
 */
export function formatCurrency(amountIDR: number, opts?: { currency?: CurrencyCode }): string {
  const locale = getActiveLocale();
  const { value, currency } = convertFromBase(amountIDR, opts?.currency);
  const digits = getCurrencyFractionDigits(currency);

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat(getActiveLocale(), {
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
    return useLanguageStore.getState().t('common_all_period');
  }
  const [year, month] = monthStr.split('-');
  if (!year || !month || isNaN(parseInt(year)) || isNaN(parseInt(month))) {
    return monthStr;
  }
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return new Intl.DateTimeFormat(getActiveLocale(), { month: 'long', year: 'numeric' }).format(date);
}

export function getMonthFromDate(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [{ value: 'all', label: useLanguageStore.getState().t('common_all_period') }];
  const now = new Date();

  for (let i = 0; i <= 11; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat(getActiveLocale(), { month: 'long', year: 'numeric' }).format(date);
    options.push({ value, label });
  }

  return options;
}

/**
 * Generate dynamic month options based on actual transaction dates
 * Scans all dates and creates options from oldest to newest
 */
export function generateDynamicMonthOptions(dates: string[]): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [{ value: 'all', label: useLanguageStore.getState().t('common_all_period') }];

  if (dates.length === 0) {
    // Fallback to current month if no data
    const now = new Date();
    const value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat(getActiveLocale(), { month: 'long', year: 'numeric' }).format(now);
    options.push({ value, label });
    return options;
  }

  // Get unique months from all dates
  const monthSet = new Set<string>();
  const now = new Date();

  // Always include current month
  monthSet.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  dates.forEach((dateStr) => {
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

  sortedMonths.forEach((monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const label = new Intl.DateTimeFormat(getActiveLocale(), { month: 'long', year: 'numeric' }).format(date);
    options.push({ value: monthKey, label });
  });

  return options;
}

/**
 * Parse human input like:
 * - "1.234.567" (ID style)
 * - "1,234,567" (US style)
 * - "1,234.56" / "1.234,56"
 */
export function parseNumberInput(input: string): number {
  const s = (input || '').trim().replace(/[^0-9,.-]/g, '');
  if (!s) return NaN;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  let decimalSep: '.' | ',' | '' = '';
  if (lastDot !== -1 && lastComma !== -1) {
    decimalSep = lastDot > lastComma ? '.' : ',';
  } else if (lastComma !== -1) {
    const digitsAfter = s.length - lastComma - 1;
    decimalSep = digitsAfter > 0 && digitsAfter <= 2 ? ',' : '';
  } else if (lastDot !== -1) {
    const digitsAfter = s.length - lastDot - 1;
    decimalSep = digitsAfter > 0 && digitsAfter <= 2 ? '.' : '';
  }

  let normalized = s;
  if (decimalSep) {
    const parts = s.split(decimalSep);
    const intPart = (parts[0] || '').replace(/[.,]/g, '');
    const fracPart = (parts[1] || '').replace(/[.,]/g, '');
    normalized = `${intPart}.${fracPart}`;
  } else {
    normalized = s.replace(/[.,]/g, '');
  }

  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Convert typed amount (in current display currency) into base currency (IDR)
 * so backend + calculations tetap konsisten.
 */
export function parseCurrencyInputToBase(input: string, opts?: { currency?: CurrencyCode }): number {
  const currency = opts?.currency || getDisplayCurrency();
  const parsed = parseNumberInput(input);
  if (!Number.isFinite(parsed)) return NaN;
  return convertToBase(parsed, currency);
}

/**
 * For editing forms: convert stored base amount (IDR) into a clean number string
 * in the current display currency.
 */
export function formatInputNumberFromBase(amountIDR: number, opts?: { currency?: CurrencyCode }): string {
  const currency = opts?.currency || getDisplayCurrency();
  const { value, currency: safeCurrency } = convertFromBase(amountIDR, currency);
  const digits = getCurrencyFractionDigits(safeCurrency);
  if (digits === 0) return String(Math.round(value));

  // Keep up to 2 decimals but trim trailing zeros
  return value
    .toFixed(digits)
    .replace(/\.0+$/, '')
    .replace(/(\.[0-9]*?)0+$/, '$1');
}
