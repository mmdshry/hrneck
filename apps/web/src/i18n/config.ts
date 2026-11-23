export const locales = ["en", "es", "fr", "pt", "de", "ru"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

export const LOCALE_COOKIE = "hrneck_locale";

export type LocaleOption = {
  code: AppLocale;
  label: string;
};

export const localeOptions: LocaleOption[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "pt", label: "Português" },
  { code: "de", label: "Deutsch" },
  { code: "ru", label: "Русский" },
];

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return (
    typeof value === "string" &&
    (locales as readonly string[]).includes(value)
  );
}

export function normalizeLocale(
  value: string | null | undefined,
): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}
