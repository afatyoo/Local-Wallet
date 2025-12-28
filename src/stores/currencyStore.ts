import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CurrencyCode =
  | 'IDR'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'AUD'
  | 'CAD'
  | 'CHF'
  | 'CNY'
  | 'SGD'
  | 'HKD'
  | 'KRW'
  | 'INR'
  | 'NZD'
  | 'SEK'
  | 'NOK'
  | 'DKK'
  | 'THB'
  | 'MYR'
  | 'PHP';

export const SUPPORTED_CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: 'IDR', label: 'IDR — Indonesian Rupiah' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
  { code: 'CNY', label: 'CNY — Chinese Yuan' },
  { code: 'HKD', label: 'HKD — Hong Kong Dollar' },
  { code: 'KRW', label: 'KRW — South Korean Won' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'NZD', label: 'NZD — New Zealand Dollar' },
  { code: 'SEK', label: 'SEK — Swedish Krona' },
  { code: 'NOK', label: 'NOK — Norwegian Krone' },
  { code: 'DKK', label: 'DKK — Danish Krone' },
  { code: 'THB', label: 'THB — Thai Baht' },
  { code: 'MYR', label: 'MYR — Malaysian Ringgit' },
  { code: 'PHP', label: 'PHP — Philippine Peso' },
];

type RatesMap = Record<string, number>;

interface CurrencyState {
  baseCurrency: CurrencyCode;
  displayCurrency: CurrencyCode;

  /** rates are expressed as: 1 IDR = X <currency> */
  rates: RatesMap;
  lastUpdated: string | null;

  isRefreshing: boolean;
  error: string | null;

  setDisplayCurrency: (currency: CurrencyCode) => void;
  refreshRates: (opts?: { force?: boolean }) => Promise<void>;
}

const RATES_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const RATES_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/idr.json';

function isFresh(lastUpdated: string | null): boolean {
  if (!lastUpdated) return false;
  const ts = Date.parse(lastUpdated);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < RATES_TTL_MS;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      baseCurrency: 'IDR',
      displayCurrency: 'IDR',
      rates: { IDR: 1 },
      lastUpdated: null,
      isRefreshing: false,
      error: null,

      setDisplayCurrency: (currency) => set({ displayCurrency: currency }),

      refreshRates: async (opts) => {
        const force = Boolean(opts?.force);

        // Skip if still fresh and not forced
        if (!force && isFresh(get().lastUpdated) && Object.keys(get().rates || {}).length > 1) {
          return;
        }

        set({ isRefreshing: true, error: null });

        try {
          const res = await fetch(RATES_URL);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const json = (await res.json()) as { date?: string; idr?: Record<string, number> };

          const rawRates = json?.idr || {};
          const mapped: RatesMap = { IDR: 1 };

          // Normalize: store UPPERCASE currency codes
          Object.entries(rawRates).forEach(([k, v]) => {
            const code = k.toUpperCase();
            if (typeof v === 'number' && Number.isFinite(v)) {
              mapped[code] = v;
            }
          });

          // Minimal sanity check
          if (!mapped.USD && !mapped.EUR) {
            throw new Error('Rates payload looks invalid');
          }

          set({
            rates: mapped,
            lastUpdated: new Date().toISOString(),
            isRefreshing: false,
            error: null,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Failed to fetch rates';
          set({ isRefreshing: false, error: message });
        }
      },
    }),
    {
      name: 'finance-currency',
      partialize: (state) => ({
        baseCurrency: state.baseCurrency,
        displayCurrency: state.displayCurrency,
        rates: state.rates,
        lastUpdated: state.lastUpdated,
      }),
    }
  )
);
