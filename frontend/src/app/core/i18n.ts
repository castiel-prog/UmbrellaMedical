import { Injectable, Pipe, PipeTransform, computed, inject, signal } from '@angular/core';

export type Lang = 'en' | 'ka' | 'de' | 'fr' | 'it' | 'es' | 'ru';

/** Languages offered in the switcher, each named in its own language. */
export const LANGUAGES: { code: Lang; name: string; short: string }[] = [
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'ka', name: 'ქართული', short: 'KA' },
  { code: 'de', name: 'Deutsch', short: 'DE' },
  { code: 'fr', name: 'Français', short: 'FR' },
  { code: 'it', name: 'Italiano', short: 'IT' },
  { code: 'es', name: 'Español', short: 'ES' },
  { code: 'ru', name: 'Русский', short: 'RU' }
];

type Dictionary = Record<string, string>;

/** Translations are loaded only when chosen. English is the source text itself, so it needs no file. */
const LOADERS: Record<Exclude<Lang, 'en'>, () => Promise<Dictionary>> = {
  ka: () => import('./i18n/ka').then(m => m.default),
  de: () => import('./i18n/de').then(m => m.default),
  fr: () => import('./i18n/fr').then(m => m.default),
  it: () => import('./i18n/it').then(m => m.default),
  es: () => import('./i18n/es').then(m => m.default),
  ru: () => import('./i18n/ru').then(m => m.default)
};

const LOCALES: Record<Lang, string> = { en: 'en-GB', ka: 'ka-GE', de: 'de-DE', fr: 'fr-FR', it: 'it-IT', es: 'es-ES', ru: 'ru-RU' };
const STORAGE_KEY = 'umbrella.lang';

/**
 * Runtime translations. Texts are written in English in the templates and looked up in the chosen
 * language's dictionary; anything missing falls back to English. Placeholders use {name}.
 */
@Injectable({ providedIn: 'root' })
export class I18n {
  readonly lang = signal<Lang>('en');
  private readonly dict = signal<Dictionary>({});
  /** BCP 47 locale for Intl formatting (dates, numbers). */
  readonly locale = computed(() => LOCALES[this.lang()]);

  constructor() {
    void this.use(this.initialLang());
  }

  async use(lang: Lang): Promise<void> {
    const dict = lang === 'en' ? {} : await LOADERS[lang]().catch(() => ({}));
    this.dict.set(dict);
    this.lang.set(lang);
    document.documentElement.lang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* storage unavailable */ }
  }

  t(text: string, params?: Record<string, string | number | null | undefined>): string {
    let out = this.dict()[text] ?? text;
    if (params) for (const [k, v] of Object.entries(params)) out = out.split(`{${k}}`).join(String(v ?? ''));
    return out;
  }

  private initialLang(): Lang {
    const known = (l: string | null | undefined): l is Lang => !!l && LANGUAGES.some(x => x.code === l);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (known(saved)) return saved;
    } catch { /* storage unavailable */ }
    const browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return known(browser) ? browser : 'en';
  }
}

// Some browsers ship without Georgian date data and quietly fall back to English; Georgian month and weekday
// names are filled in here in that case (day-month-year order, as in Georgia).
const KA_MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const KA_MONTHS_SHORT = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const KA_DAYS = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
const KA_DAYS_SHORT = ['კვ', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];

/** Like new Intl.DateTimeFormat(locale, options), in the site language, with a Georgian fallback. */
export function dateFormatter(i18n: I18n, options: Intl.DateTimeFormatOptions): { format(date: Date): string } {
  const native = new Intl.DateTimeFormat(i18n.locale(), options);
  if (i18n.lang() !== 'ka' || native.resolvedOptions().locale.startsWith('ka')) return native;
  const en = new Intl.DateTimeFormat('en-GB', options);
  return {
    format: (date: Date) => en.formatToParts(date).map(p =>
      p.type === 'month' && (options.month === 'long' || options.month === 'short') ? (options.month === 'long' ? KA_MONTHS : KA_MONTHS_SHORT)[date.getMonth()]
      : p.type === 'weekday' ? (options.weekday === 'long' ? KA_DAYS : KA_DAYS_SHORT)[date.getDay()]
      : p.type === 'literal' && p.value.trim() === 'at' ? ', '
      : p.value).join('')
  };
}

const DATE_FORMATS: Record<string, Intl.DateTimeFormatOptions> = {
  weekday: { weekday: 'short' },
  day: { day: 'numeric' },
  month: { month: 'short' },
  monthYear: { month: 'short', year: 'numeric' },
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  time: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  dayTime: { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  mediumTime: { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  longTime: { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  weekdayMediumTime: { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  dayMonth: { day: 'numeric', month: 'short' },
  dayMonthTime: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  weekdayDay: { weekday: 'short', day: 'numeric' },
  weekdayDayMonth: { weekday: 'short', day: 'numeric', month: 'short' },
  fullDate: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
};

/** Dates in the chosen language: {{ value | ldate: 'medium' }}. Accepts Date, ISO strings and "YYYY-MM-DD". */
@Pipe({ name: 'ldate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly i18n = inject(I18n);
  transform(value: string | Date | null | undefined, format: keyof typeof DATE_FORMATS = 'medium'): string {
    if (!value) return '';
    const date = typeof value === 'string'
      ? (/^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00') : new Date(value))
      : value;
    if (isNaN(date.getTime())) return '';
    return dateFormatter(this.i18n, DATE_FORMATS[format] ?? DATE_FORMATS['medium']).format(date);
  }
}

/** {{ 'Text' | t }} or {{ 'Hello {name}' | t: { name: x } }}. Impure so it updates when the language changes. */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18n);
  transform(text: string | null | undefined, params?: Record<string, string | number | null | undefined>): string {
    return text ? this.i18n.t(text, params) : '';
  }
}
