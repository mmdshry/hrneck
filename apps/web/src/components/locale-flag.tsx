import type { AppLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

type Props = {
  locale: AppLocale;
  className?: string;
  title?: string;
};

/**
 * Inline SVG flags — emoji regional indicators often render as "ES"/"GB" on Windows.
 */
export function LocaleFlag({ locale, className, title }: Props) {
  const common = cn(
    "inline-block h-4 w-6 shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]",
    className,
  );

  switch (locale) {
    case "en":
      return (
        <svg
          viewBox="0 0 60 40"
          className={common}
          role="img"
          aria-label={title ?? "English"}
        >
          <title>{title ?? "English"}</title>
          <rect width="60" height="40" fill="#fff" />
          <rect y="0" width="60" height="3.08" fill="#B22234" />
          <rect y="6.15" width="60" height="3.08" fill="#B22234" />
          <rect y="12.31" width="60" height="3.08" fill="#B22234" />
          <rect y="18.46" width="60" height="3.08" fill="#B22234" />
          <rect y="24.62" width="60" height="3.08" fill="#B22234" />
          <rect y="30.77" width="60" height="3.08" fill="#B22234" />
          <rect y="36.92" width="60" height="3.08" fill="#B22234" />
          <rect width="24" height="21.54" fill="#3C3B6E" />
          <g fill="#fff">
            <circle cx="4" cy="3.5" r="0.7" />
            <circle cx="8.5" cy="3.5" r="0.7" />
            <circle cx="13" cy="3.5" r="0.7" />
            <circle cx="17.5" cy="3.5" r="0.7" />
            <circle cx="22" cy="3.5" r="0.7" />
            <circle cx="6.25" cy="6.5" r="0.7" />
            <circle cx="10.75" cy="6.5" r="0.7" />
            <circle cx="15.25" cy="6.5" r="0.7" />
            <circle cx="19.75" cy="6.5" r="0.7" />
            <circle cx="4" cy="9.5" r="0.7" />
            <circle cx="8.5" cy="9.5" r="0.7" />
            <circle cx="13" cy="9.5" r="0.7" />
            <circle cx="17.5" cy="9.5" r="0.7" />
            <circle cx="22" cy="9.5" r="0.7" />
            <circle cx="6.25" cy="12.5" r="0.7" />
            <circle cx="10.75" cy="12.5" r="0.7" />
            <circle cx="15.25" cy="12.5" r="0.7" />
            <circle cx="19.75" cy="12.5" r="0.7" />
            <circle cx="4" cy="15.5" r="0.7" />
            <circle cx="8.5" cy="15.5" r="0.7" />
            <circle cx="13" cy="15.5" r="0.7" />
            <circle cx="17.5" cy="15.5" r="0.7" />
            <circle cx="22" cy="15.5" r="0.7" />
            <circle cx="6.25" cy="18.5" r="0.7" />
            <circle cx="10.75" cy="18.5" r="0.7" />
            <circle cx="15.25" cy="18.5" r="0.7" />
            <circle cx="19.75" cy="18.5" r="0.7" />
          </g>
        </svg>
      );
    case "es":
      return (
        <svg
          viewBox="0 0 60 40"
          className={common}
          role="img"
          aria-label={title ?? "Español"}
        >
          <title>{title ?? "Español"}</title>
          <rect width="60" height="40" fill="#AA151B" />
          <rect y="10" width="60" height="20" fill="#F1BF00" />
        </svg>
      );
    case "fr":
      return (
        <svg
          viewBox="0 0 60 40"
          className={common}
          role="img"
          aria-label={title ?? "Français"}
        >
          <title>{title ?? "Français"}</title>
          <rect width="20" height="40" fill="#002395" />
          <rect x="20" width="20" height="40" fill="#fff" />
          <rect x="40" width="20" height="40" fill="#ED2939" />
        </svg>
      );
    case "pt":
      return (
        <svg
          viewBox="0 0 60 40"
          className={common}
          role="img"
          aria-label={title ?? "Português"}
        >
          <title>{title ?? "Português"}</title>
          <rect width="24" height="40" fill="#006600" />
          <rect x="24" width="36" height="40" fill="#FF0000" />
          <circle cx="24" cy="20" r="7.5" fill="#FFCC00" />
          <circle cx="24" cy="20" r="5" fill="#003399" />
        </svg>
      );
    case "de":
      return (
        <svg
          viewBox="0 0 60 40"
          className={common}
          role="img"
          aria-label={title ?? "Deutsch"}
        >
          <title>{title ?? "Deutsch"}</title>
          <rect width="60" height="13.34" fill="#000" />
          <rect y="13.34" width="60" height="13.33" fill="#D00" />
          <rect y="26.67" width="60" height="13.33" fill="#FFCE00" />
        </svg>
      );
    case "ru":
      return (
        <svg
          viewBox="0 0 60 40"
          className={common}
          role="img"
          aria-label={title ?? "Русский"}
        >
          <title>{title ?? "Русский"}</title>
          <rect width="60" height="13.34" fill="#fff" />
          <rect y="13.34" width="60" height="13.33" fill="#0039A6" />
          <rect y="26.67" width="60" height="13.33" fill="#D52B1E" />
        </svg>
      );
    default: {
      const _exhaustive: never = locale;
      return _exhaustive;
    }
  }
}
