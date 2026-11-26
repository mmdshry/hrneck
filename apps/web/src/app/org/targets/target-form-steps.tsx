"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import { AvatarUploader } from "@/components/ui/avatar-uploader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationSelect } from "@/components/ui/location-select";
import { Select } from "@/components/ui/select";
import {
  PREFERRED_LANGUAGE_OPTIONS,
  type DepartmentOption,
  type Target,
  type TargetFormState,
} from "./target-types";

/** Sets one field of the employee form. */
export type PatchTargetField = <K extends keyof TargetFormState>(
  key: K,
  value: TargetFormState[K],
) => void;

export type RoleOption = { id: number; name: string };

/** Photo upload for an existing employee. */
export type AvatarField = {
  endpoint: string;
  url: string | null;
  onChanged: (url: string | null) => void;
};

/** Sign-in fields, only shown when creating an employee. */
export type CreateSignInFields = {
  password: string;
  onPasswordChange: (value: string) => void;
  /** Omit to hide the role field when the viewer cannot assign roles. */
  roleOptions?: RoleOption[];
  roleValue: string;
  onRoleChange: (value: string) => void;
};

export function useEmployeeStatusOptions() {
  const tCommon = useTranslations("common");
  return [
    { label: tCommon("active"), value: "active" },
    { label: tCommon("inactive"), value: "inactive" },
  ];
}

export function useEmploymentTypeOptions() {
  const t = useTranslations("org.employees");
  return [
    { label: t("employmentTypeFullTime"), value: "full_time" },
    { label: t("employmentTypePartTime"), value: "part_time" },
    { label: t("employmentTypeContractor"), value: "contractor" },
    { label: t("employmentTypeIntern"), value: "intern" },
  ];
}

export function useRiskTierOptions() {
  const t = useTranslations("org.employees");
  return [
    { label: t("riskTierUnknown"), value: "unknown" },
    { label: t("riskTierLow"), value: "low" },
    { label: t("riskTierMedium"), value: "medium" },
    { label: t("riskTierHigh"), value: "high" },
  ];
}

type IdentityStepProps = {
  form: TargetFormState;
  onPatch: PatchTargetField;
  emailRef: RefObject<HTMLInputElement | null>;
  passwordRef: RefObject<HTMLInputElement | null>;
  avatar?: AvatarField;
  createSignIn?: CreateSignInFields;
};

export function IdentityStep({
  form,
  onPatch,
  emailRef,
  passwordRef,
  avatar,
  createSignIn,
}: IdentityStepProps) {
  const t = useTranslations("org.employees");
  const tCommon = useTranslations("common");
  return (
    <div className="space-y-4">
      {avatar ? (
        <div className="space-y-1">
          <Label>{tCommon("photo")}</Label>
          <AvatarUploader
            name={[form.first_name, form.last_name].filter(Boolean).join(" ")}
            email={form.email}
            avatarUrl={avatar.url}
            endpoint={avatar.endpoint}
            withTenant
            size="md"
            onChanged={avatar.onChanged}
          />
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="target-email">{tCommon("email")}</Label>
        <Input
          id="target-email"
          ref={emailRef}
          type="email"
          value={form.email}
          onChange={(e) => onPatch("email", e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="target-first-name">{tCommon("firstName")}</Label>
          <Input
            id="target-first-name"
            value={form.first_name}
            onChange={(e) => onPatch("first_name", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="target-last-name">{tCommon("lastName")}</Label>
          <Input
            id="target-last-name"
            value={form.last_name}
            onChange={(e) => onPatch("last_name", e.target.value)}
          />
        </div>
      </div>
      {createSignIn ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="target-login-password">{t("loginPassword")}</Label>
            <Input
              id="target-login-password"
              ref={passwordRef}
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={createSignIn.password}
              onChange={(e) => createSignIn.onPasswordChange(e.target.value)}
            />
            <p className="text-xs text-[var(--muted-foreground)]">{t("loginPasswordHint")}</p>
          </div>
          {createSignIn.roleOptions ? (
            <div className="space-y-1">
              <Label htmlFor="target-role">{tCommon("role")}</Label>
              <Select
                id="target-role"
                value={createSignIn.roleValue}
                onChange={(e) => createSignIn.onRoleChange(e.target.value)}
              >
                <option value="">{t("noRole")}</option>
                {createSignIn.roleOptions.map((role) => (
                  <option key={role.id} value={role.name}>
                    {role.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-[var(--muted-foreground)]">{t("roleHint")}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

type EmploymentStepProps = {
  form: TargetFormState;
  onPatch: PatchTargetField;
  departments: DepartmentOption[];
  /** Employees that can be picked as manager. The employee being edited is excluded. */
  managers: Target[];
};

export function EmploymentStep({ form, onPatch, departments, managers }: EmploymentStepProps) {
  const t = useTranslations("org.employees");
  const tCommon = useTranslations("common");
  const employmentTypeOptions = useEmploymentTypeOptions();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="target-department">{tCommon("department")}</Label>
          <Select
            id="target-department"
            value={form.department_id}
            onChange={(e) => onPatch("department_id", e.target.value)}
          >
            <option value="">{t("noDepartment")}</option>
            {departments.map((department) => (
              <option key={department.id} value={String(department.id)}>
                {department.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="target-job-title">{tCommon("titleLabel")}</Label>
          <Input
            id="target-job-title"
            value={form.job_title}
            onChange={(e) => onPatch("job_title", e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="target-manager">{tCommon("manager")}</Label>
          <Select
            id="target-manager"
            value={form.manager_target_id}
            onChange={(e) => onPatch("manager_target_id", e.target.value)}
          >
            <option value="">{t("noManager")}</option>
            {managers.map((row) => (
              <option key={row.id} value={String(row.id)}>
                {[row.first_name, row.last_name].filter(Boolean).join(" ") || row.email} ({row.email})
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="target-employment-type">{t("employmentType")}</Label>
          <Select
            id="target-employment-type"
            value={form.employment_type}
            onChange={(e) => onPatch("employment_type", e.target.value)}
          >
            <option value="">{t("notSet")}</option>
            {employmentTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="target-hire-date">{tCommon("hireDate")}</Label>
          <Input
            id="target-hire-date"
            type="date"
            value={form.hire_date}
            onChange={(e) => onPatch("hire_date", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="target-employee-number">{tCommon("employeeNumber")}</Label>
          <Input
            id="target-employee-number"
            value={form.employee_number}
            onChange={(e) => onPatch("employee_number", e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="target-external-id">{tCommon("externalId")}</Label>
          <Input
            id="target-external-id"
            value={form.external_id}
            onChange={(e) => onPatch("external_id", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

type ContactStatusStepProps = {
  form: TargetFormState;
  onPatch: PatchTargetField;
  /** Account status is only editable for an existing employee. */
  showStatus: boolean;
};

export function ContactStatusStep({ form, onPatch, showStatus }: ContactStatusStepProps) {
  const t = useTranslations("org.employees");
  const tCommon = useTranslations("common");
  const statusOptions = useEmployeeStatusOptions();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="target-phone">{tCommon("phone")}</Label>
          <Input
            id="target-phone"
            value={form.phone}
            onChange={(e) => onPatch("phone", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="target-location">{tCommon("location")}</Label>
          <LocationSelect
            id="target-location"
            value={form.location}
            onChange={(next) => onPatch("location", next)}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="target-language">{t("preferredLanguage")}</Label>
          <Select
            id="target-language"
            value={form.preferred_language}
            onChange={(e) => onPatch("preferred_language", e.target.value)}
          >
            <option value="">{t("notSet")}</option>
            {PREFERRED_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        {showStatus ? (
          <div className="space-y-1">
            <Label htmlFor="target-status">{tCommon("status")}</Label>
            <Select
              id="target-status"
              value={form.status}
              onChange={(e) => onPatch("status", e.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.notification_opt_out}
          onChange={(e) => onPatch("notification_opt_out", e.target.checked)}
        />
        {t("optOutCampaignNotifications")}
      </label>
    </div>
  );
}
