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
import { PermissionCheckboxGrid } from "./permission-checkbox-grid";

const FORM_ID = "create-role-form";

type CreateRoleDialogProps = {
  catalog: string[];
  onClose: () => void;
  onCreated: () => Promise<void>;
};

export function CreateRoleDialog({ catalog, onClose, onCreated }: CreateRoleDialogProps) {
  const t = useTranslations("org.roles");
  const tCommon = useTranslations("common");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function togglePermission(permission: string) {
    setSelected((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission],
    );
  }

  async function createRole(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await ensureCsrf();
      await api("/api/v1/org/roles", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions: selected }),
      });
      toastSuccess(t("roleCreated"));
      await onCreated();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("createFailed"));
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t("createRole")}
      size="lg"
      busy={saving}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={() => onClose()}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving ? tCommon("creating") : tCommon("create")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="space-y-4" onSubmit={(e) => void createRole(e)}>
        <div className="space-y-1">
          <Label htmlFor="role-name">{tCommon("name")}</Label>
          <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <PermissionCheckboxGrid
          legend={tCommon("permissions")}
          catalog={catalog}
          selected={selected}
          onToggle={togglePermission}
        />
      </form>
    </Dialog>
  );
}
