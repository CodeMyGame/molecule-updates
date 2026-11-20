import en from './en.json';

export const LOCALE_CODES = [
  'en',
  'hi',
  'ta',
  'te',
  'kn',
  'ml',
  'mr',
  'bn',
  'gu',
  'pa',
  'es',
  'fr',
  'ar',
  'zh',
  'ja',
] as const;

export type LocaleCode = (typeof LOCALE_CODES)[number];

const localeLoaders: Record<
  Exclude<LocaleCode, 'en'>,
  () => Promise<{ default: Record<string, any> }>
> = {
  hi: () => import('./hi.json'),
  ta: () => import('./ta.json'),
  te: () => import('./te.json'),
  kn: () => import('./kn.json'),
  ml: () => import('./ml.json'),
  mr: () => import('./mr.json'),
  bn: () => import('./bn.json'),
  gu: () => import('./gu.json'),
  pa: () => import('./pa.json'),
  es: () => import('./es.json'),
  fr: () => import('./fr.json'),
  ar: () => import('./ar.json'),
  zh: () => import('./zh.json'),
  ja: () => import('./ja.json'),
};

/**
 * Default bundled UI locales (only English is bundled synchronously into index.js).
 * Other locales are loaded on-demand via loadLocaleResource.
 */
export const defaultLocaleResources = {
  en: { translation: en },
} as const;

export const localeResources = defaultLocaleResources;

export async function loadLocaleResource(lang: LocaleCode): Promise<Record<string, any>> {
  if (lang === 'en') return en;
  const loader = localeLoaders[lang as Exclude<LocaleCode, 'en'>];
  if (!loader) return en;
  const mod = await loader();
  return mod.default || mod;
}
