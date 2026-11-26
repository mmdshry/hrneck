"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";

export type EditableProfile = {
  id: number;
  name: string;
  from_name: string;
  from_email: string;
};

type SendingProfileDialogProps = {
  /** Profile being edited. Null opens the create form. */
  profile: EditableProfile | null;
  onClose: () => void;
  /** Reloads the list after a successful save, before the dialog closes. */
  onSaved: () => void | Promise<void>;
};

/** Mounted only while open, so every session starts from the profile's saved values or the defaults. */
export function SendingProfileDialog({ profile, onClose, onSaved }: SendingProfileDialogProps) {
  const t = useTranslations("org.settings");
  const tCommon = useTranslations("common");
  const [name, setName] = useState(profile?.name ?? t("defaultProfileName"));
  const [fromName, setFromName] = useState(profile?.from_name ?? "HRneck");
  const [fromEmail, setFromEmail] = useState(profile?.from_email ?? "noreply@hrneck.com");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await ensureCsrf();
      const payload = {
        name,
        from_name: fromName,
        from_email: fromEmail,
        mailer: "smtp",
        is_default: true,
      };
      if (profile !== null) {
        await api(`/api/v1/org/sending-profiles/${profile.id}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/v1/org/sending-profiles", {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      await onSaved();
      toastSuccess(t("profileSaved"));
      onClose();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("saveFailedSignIn"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={profile !== null ? t("editProfile") : t("newProfile")}
      busy={saving}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={() => onClose()}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form="sending-profile-form" disabled={saving}>
            {saving
              ? tCommon("saving")
              : profile !== null
                ? t("updateProfile")
                : t("saveProfile")}
          </Button>
        </>
      }
    >
      <form
        id="sending-profile-form"
        onSubmit={(event) => void onSubmit(event)}
        className="space-y-4"
      >
        <div className="space-y-1">
          <Label htmlFor="sp-name" className="text-[var(--muted-foreground)]">
            {tCommon("name")}
          </Label>
          <Input id="sp-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sp-from-name" className="text-[var(--muted-foreground)]">
            {t("fromName")}
          </Label>
          <Input
            id="sp-from-name"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sp-from-email" className="text-[var(--muted-foreground)]">
            {t("fromEmail")}
          </Label>
          <Input
            id="sp-from-email"
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
          />
        </div>
      </form>
    </Dialog>
  );
}
