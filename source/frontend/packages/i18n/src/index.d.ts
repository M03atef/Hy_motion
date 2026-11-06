export type Locale = 'en' | 'ar';

export declare function t(
  key: string,
  params?: Record<string, string | number>,
  locale?: Locale,
  opts?: { missingKey?: 'throw' | 'fallback' | 'key' },
): string;

export declare function hasKey(key: string): boolean;
export declare function listKeys(): string[];

export declare function pickBilingual(
  message: string | null | undefined,
  messageAr: string | null | undefined,
  locale: Locale,
): string;

export declare function splitSlashBilingual(
  combined: string | null | undefined,
): { message: string; messageAr: string };

export declare function displayBilingualText(
  input:
    | string
    | { message?: string | null; messageAr?: string | null; detail?: string | null }
    | null
    | undefined,
  locale: Locale,
): string;

export declare function tLabel(en: string, ar: string, locale: Locale): string;
export declare function statusLabel(code: string, locale?: Locale): string;
export declare function formatMoney(amount: number, locale?: Locale): string;
export declare function formatNumber(
  value: number,
  locale?: Locale,
  opts?: Intl.NumberFormatOptions,
): string;
export declare function formatDate(isoOrDate: string | Date, locale?: Locale): string;
export declare function formatDateTime(isoOrDate: string | Date, locale?: Locale): string;

export declare const catalogs: { en: Record<string, string>; ar: Record<string, string> };
