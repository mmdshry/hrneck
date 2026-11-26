"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import { PermissionCheckboxGrid } from "./permission-checkbox-grid";
import type { OrgRole } from "./role-types";

const FORM_ID = "edit-role-permissions-form";

type EditRolePermissionsDialogProps = {
  role: OrgRole;
  catalog: string[];
  /** Built-in roles show their grants but cannot be changed here. */
  readOnly: boolean;
  onClose: () => void;
  onSaved: (roleId: number, permissions: string[]) => Promise<void>;
};

export function EditRolePermissionsDialog({
  role,
  catalog,
  readOnly,
  onClose,
  onSaved,
}: EditRolePermissionsDialogProps) {
  const t = useTranslations("org.roles");
  const tCommon = useTranslations("common");
  const [selected, setSelected] = useState<string[]>(role.permissions);
  const [saving, setSaving] = useState(false);

  function togglePermission(permission: string) {
    setSelected((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission],
    );
  }

  async function savePermissions(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/roles/${role.id}`, {
        method: "PUT",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: selected }),
      });
      toastSuccess(t("roleUpdated", { name: role.name }));
      await onSaved(role.id, selected);
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("updateFailed"));
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t("permissionsTitle", { name: role.name })}
      description={readOnly ? t("builtInManaged") : undefined}
      size="lg"
      busy={saving}
      closeLabel={tCommon("close")}
      footer={
        readOnly ? undefined : (
          <>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => onClose()}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" form={FORM_ID} disabled={saving}>
              {saving ? tCommon("saving") : t("savePermissions")}
            </Button>
          </>
        )
      }
    >
      <form id={FORM_ID} onSubmit={(e) => void savePermissions(e)}>
        <PermissionCheckboxGrid
          legend={tCommon("permissions")}
          catalog={catalog}
          selected={selected}
          onToggle={togglePermission}
          disabled={readOnly}
        />
      </form>
    </Dialog>
  );
}
