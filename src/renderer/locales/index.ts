import en from './en.json';
import hi from './hi.json';
import ta from './ta.json';
import te from './te.json';
import kn from './kn.json';
import ml from './ml.json';
import mr from './mr.json';
import bn from './bn.json';
import gu from './gu.json';
import pa from './pa.json';
import es from './es.json';
import fr from './fr.json';
import ar from './ar.json';
import zh from './zh.json';
import ja from './ja.json';

/** All bundled UI locales — add a new *.json and import it here. */
export const localeResources = {
  en: { translation: en },
  hi: { translation: hi },
  ta: { translation: ta },
  te: { translation: te },
  kn: { translation: kn },
  ml: { translation: ml },
  mr: { translation: mr },
  bn: { translation: bn },
  gu: { translation: gu },
  pa: { translation: pa },
  es: { translation: es },
  fr: { translation: fr },
  ar: { translation: ar },
  zh: { translation: zh },
  ja: { translation: ja },
} as const;

export type LocaleCode = keyof typeof localeResources;

export const LOCALE_CODES = Object.keys(localeResources) as LocaleCode[];
