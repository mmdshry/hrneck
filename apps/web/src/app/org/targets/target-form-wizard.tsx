"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useWizardLabels } from "@/components/ui/use-wizard-labels";
import { WizardDialog, type WizardStep } from "@/components/ui/wizard-dialog";
import { api, ensureCsrf } from "@/lib/api";
import { paginationQuery, parsePaginatedResponse } from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  DEFAULT_CREATE_ROLE,
  createTargetBody,
  isTargetFormDirty,
  resolveCreateRole,
} from "./target-form-logic";
import {
  ContactStatusStep,
  EmploymentStep,
  IdentityStep,
  type AvatarField,
  type CreateSignInFields,
  type RoleOption,
} from "./target-form-steps";
import {
  emptyTargetForm,
  formFromTarget,
  payloadFromForm,
  type DepartmentOption,
  type Target,
  type TargetFormState,
} from "./target-types";

type TargetFormWizardProps = {
  /** Employee to edit. Null starts the create flow. */
  target: Target | null;
  /** Roles the viewer may give a new employee's sign-in. Omit to hide the role field. */
  roleOptions?: RoleOption[];
  onClose: () => void;
  /** Called with the saved employee after a successful save. */
  onSaved: (saved: Target) => void | Promise<void>;
  /** Edit only: reports a new photo so the caller can update its list. Enables the photo field. */
  onAvatarChanged?: (targetId: number, avatarUrl: string | null) => void;
};

async function loadFormOptions(): Promise<{ departments: DepartmentOption[]; managers: Target[] }> {
  const tenant = resolveTenant();
  const [deptRes, mgrRes] = await Promise.all([
    api(`/api/v1/org/departments?${paginationQuery(1, 500, { active_only: "1" })}`, { tenant }),
    api(`/api/v1/org/targets?${paginationQuery(1, 500)}`, { tenant }),
  ]);
  const departments = parsePaginatedResponse<DepartmentOption>(deptRes, 500);
  const managers = parsePaginatedResponse<Target>(mgrRes, 500);
  return {
    departments: departments.data.filter((department) => department.is_active !== false),
    managers: managers.data,
  };
}

/**
 * Creates or edits one employee with the same three steps and validation on both
 * the targets list and the employee detail page. Mounted only while open, so every
 * session starts from fresh form state.
 */
export function TargetFormWizard({
  target,
  roleOptions,
  onClose,
  onSaved,
  onAvatarChanged,
}: TargetFormWizardProps) {
  const t = useTranslations("org.employees");
  const tCommon = useTranslations("common");
  const labels = useWizardLabels({ submit: target ? tCommon("saveChanges") : t("addEmployee") });
  const [initialForm] = useState<TargetFormState>(() =>
    target ? formFromTarget(target) : emptyTargetForm(),
  );
  const [form, setForm] = useState<TargetFormState>(initialForm);
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState(DEFAULT_CREATE_ROLE);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(target?.avatar_url ?? null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [managers, setManagers] = useState<Target[]>([]);
  const [saving, setSaving] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void loadFormOptions()
      .then((options) => {
        if (cancelled) return;
        setDepartments(options.departments);
        setManagers(options.managers);
      })
      .catch((err: unknown) => {
        toastError(err instanceof Error ? err.message : t("failedFormOptions"));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  function patchForm<K extends keyof TargetFormState>(key: K, value: TargetFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const managerChoices = managers.filter((row) => row.id !== target?.id);
  const createRoleName = roleOptions
    ? resolveCreateRole(roleOptions.map((role) => role.name), createRole)
    : "";
  const isDirty =
    createPassword !== "" ||
    createRole !== DEFAULT_CREATE_ROLE ||
    isTargetFormDirty(form, initialForm);

  /** Uses the inputs' native constraints: a required, well-formed email and, when set, a password of 8+ characters. */
  function validateIdentity(): boolean {
    const emailValid = emailRef.current?.reportValidity() ?? false;
    return emailValid && (passwordRef.current?.reportValidity() ?? true);
  }

  const avatar: AvatarField | undefined =
    target && onAvatarChanged
      ? {
          endpoint: `/api/v1/org/targets/${target.id}/avatar`,
          url: avatarUrl,
          onChanged: (url) => {
            setAvatarUrl(url);
            onAvatarChanged(target.id, url);
          },
        }
      : undefined;

  const createSignIn: CreateSignInFields | undefined = target
    ? undefined
    : {
        password: createPassword,
        onPasswordChange: setCreatePassword,
        roleOptions,
        roleValue: createRoleName,
        onRoleChange: setCreateRole,
      };

  const steps: WizardStep[] = [
    {
      id: "identity",
      title: t("stepIdentity"),
      description: target ? t("editEmployeeDescription") : t("createEmployeeDescription"),
      validate: validateIdentity,
      render: () => (
        <IdentityStep
          form={form}
          onPatch={patchForm}
          emailRef={emailRef}
          passwordRef={passwordRef}
          avatar={avatar}
          createSignIn={createSignIn}
        />
      ),
    },
    {
      id: "employment",
      title: t("stepEmployment"),
      description: t("stepEmploymentHint"),
      render: () => (
        <EmploymentStep
          form={form}
          onPatch={patchForm}
          departments={departments}
          managers={managerChoices}
        />
      ),
    },
    {
      id: "contact",
      title: t("stepContact"),
      description: t("stepContactHint"),
      render: () => (
        <ContactStatusStep form={form} onPatch={patchForm} showStatus={target !== null} />
      ),
    },
  ];

  async function save() {
    setSaving(true);
    try {
      await ensureCsrf();
      let saved: Target;
      if (target) {
        const res = await api<{ data: Target }>(`/api/v1/org/targets/${target.id}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadFromForm(form, { includeStatus: true })),
        });
        saved = res.data;
        toastSuccess(t("employeeUpdated"));
      } else {
        const res = await api<{
          data: Target;
          meta?: { auto_assigned_instance_count?: number };
        }>("/api/v1/org/targets", {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            createTargetBody(form, { password: createPassword, roleName: createRoleName }),
          ),
        });
        saved = res.data;
        const autoCount = res.meta?.auto_assigned_instance_count ?? 0;
        toastSuccess(
          autoCount > 0
            ? `${t("employeeCreated")} ${t("autoAssigned", { count: autoCount })}`
            : t("employeeCreated"),
        );
      }
      onClose();
      await onSaved(saved);
    } catch (err) {
      toastError(
        err instanceof Error
          ? err.message
          : target
            ? tCommon("updateFailed")
            : tCommon("createFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <WizardDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={target ? t("editEmployee") : t("addEmployee")}
      steps={steps}
      onSubmit={save}
      labels={labels}
      busy={saving}
      isDirty={isDirty}
    />
  );
}
