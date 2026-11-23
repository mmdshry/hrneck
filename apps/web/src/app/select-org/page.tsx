import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { HrneckWordmark } from "@/components/hrneck-wordmark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { MinimalLoader } from "@/components/ui/minimal-loader";
import { SelectOrgClient } from "./select-org-client";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return {
    title: t("selectOrgTitle"),
    description: t("selectOrgDescription"),
  };
}

export default function SelectOrgPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-6 flex items-center justify-end gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <HrneckWordmark className="h-8" />
      <Suspense fallback={<MinimalLoader className="min-h-40 py-10" />}>
        <SelectOrgClient />
      </Suspense>
    </div>
  );
}
