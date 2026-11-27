"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";
import { organizationSlugFromInput } from "@/lib/tenant";
import { toastError } from "@/lib/toast";

type OrganizationLookup = {
  data: { tenant_id: string; name: string; login_url: string };
};

/**
 * Main-site entry point. Finds an organization by name or address, then sends the browser to that
 * organization's own sign-in page. Nothing is signed in here.
 */
export function OrgFinder() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const slug = organizationSlugFromInput(value);
    if (!slug) {
      toastError(t("orgFinderInvalid"));
      return;
    }

    setLoading(true);
    try {
      const result = await api<OrganizationLookup>(
        `/api/v1/auth/organizations/${encodeURIComponent(slug)}`,
      );
      // A full navigation: the organization's sign-in page lives on its own host.
      window.location.assign(result.data.login_url);
    } catch (err) {
      toastError(
        err instanceof ApiError && err.status === 404
          ? t("orgFinderNotFound")
          : t("requestFailed"),
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="organization">{t("organizationAddress")}</Label>
        <Input
          id="organization"
          name="organization"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t("organizationPlaceholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? tCommon("loading") : t("orgFinderContinue")}
      </Button>
    </form>
  );
}
