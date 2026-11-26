"use client";

import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";

/** Language picker for the sidebar footer, rendered directly below the theme toggle. */
export function SidebarLanguageRow() {
  const t = useTranslations("language");

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        {t("label")}
      </p>
      <LanguageSwitcher />
    </div>
  );
}
