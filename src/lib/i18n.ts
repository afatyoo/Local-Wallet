import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import idFallback from '../locales/id.json';

/**
 * i18n (runtime)
 *
 * Base language: Indonesian (id)
 *
 * Translation resources are loaded at runtime from:
 *   /locales/{lang}.json
 *
 * This enables Docker Compose to generate/update translations AFTER build
 * (e.g., via LibreTranslate), without rebuilding the frontend image.
 */

export type Language =
  | 'id'
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'ru'
  | 'ar'
  | 'hi'
  | 'zh'
  | 'ja'
  | 'ko';

export const languages: { code: Language; name: string; nativeName: string; flag: string }[] = [
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
];

type Dictionary = Record<string, string>;

// In-memory cache. Always has at least Indonesian fallback.
const cache: Record<string, Dictionary> = {
  id: (idFallback as unknown as Dictionary) ?? {},
};

// Prevent request-storms when many components mount and call `useTranslation()`.
// - `pending` de-dupes in-flight requests per language
// - `attempted` prevents refetch loops when a locale is missing/empty
const pending: Partial<Record<Language, Promise<boolean>>> = {};
const attempted: Partial<Record<Language, boolean>> = {};

// Allow Indonesian runtime override once (Docker volume can override id.json).
let runtimeIdTried = false;

async function fetchJsonSafe(url: string): Promise<Dictionary | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    const data = (await res.json()) as Dictionary;
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

async function loadLocale(lang: Language, opts?: { force?: boolean }): Promise<boolean> {
  const force = !!opts?.force;

  // If we've already tried and it was missing/empty, don't keep hammering.
  if (!force && attempted[lang]) return false;

  // Already cached (non-empty)
  if (!force && cache[lang] && Object.keys(cache[lang]).length) return false;

  // De-dupe in-flight requests
  if (pending[lang]) return pending[lang]!;

  const job = (async () => {
    const url = `/locales/${lang}.json`;
    const data = await fetchJsonSafe(url);
    attempted[lang] = true;

    if (data && Object.keys(data).length) {
      cache[lang] = data;
      return true;
    }
    return false;
  })();

  pending[lang] = job;
  try {
    return await job;
  } finally {
    delete pending[lang];
  }
}

export const isRtl = (lang: Language) => lang === 'ar';

interface LanguageState {
  language: Language;
  // bump this to force rerender when cache is updated asynchronously
  dictVersion: number;
  setLanguage: (lang: Language) => void;
  ensureLoaded: (lang: Language) => Promise<void>;
  t: (key: string) => string;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      // Base stays Indonesian
      language: 'id',
      dictVersion: 0,
      setLanguage: (lang) => {
        set({ language: lang });
        void get().ensureLoaded(lang);
      },
      ensureLoaded: async (lang) => {
        // Try runtime Indonesian override exactly once (Docker volume can override id.json)
        let changed = false;
        if (!runtimeIdTried) {
          runtimeIdTried = true;
          changed = (await loadLocale('id', { force: true })) || changed;
        }

        changed = (await loadLocale(lang)) || changed;

        // Only bump version if something actually loaded/changed.
        if (changed) {
          set({ dictVersion: get().dictVersion + 1 });
        }
      },
      t: (key) => {
        const lang = get().language;
        return cache[lang]?.[key] || cache.id?.[key] || key;
      },
    }),
    {
      name: 'finance-language',
      partialize: (state) => ({ language: state.language }),
      onRehydrateStorage: () => (state) => {
        // Bootstrap once after persisted language is rehydrated.
        if (state?.language) {
          void state.ensureLoaded(state.language);
        }
      },
    }
  )
);

// Hook for easier usage
export const useTranslation = () => {
  // We deliberately don't auto-call ensureLoaded here anymore.
  // It is bootstrapped via persist rehydrate + setLanguage to avoid storms
  // when many components mount and call `useTranslation()`.
  const { language, setLanguage, t } = useLanguageStore();
  return { language, setLanguage, t, languages, isRtl: isRtl(language) };
};
