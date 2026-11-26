import { payloadFromForm, type TargetFormState } from "./target-types";

/** Role preselected on the add-employee form, so a new employee can sign in to the portal. */
export const DEFAULT_CREATE_ROLE = "learner";

/** Keeps the selected role only when the viewer may assign it; otherwise the employee gets no role. */
export function resolveCreateRole(assignableRoleNames: readonly string[], selected: string): string {
  return assignableRoleNames.includes(selected) ? selected : "";
}

/** True when any field differs from the state the form opened with. */
export function isTargetFormDirty(form: TargetFormState, initial: TargetFormState): boolean {
  return (Object.keys(initial) as Array<keyof TargetFormState>).some(
    (key) => form[key] !== initial[key],
  );
}

/** Create request body: the shared form payload plus the optional create-only password and role. */
export function createTargetBody(
  form: TargetFormState,
  options: { password: string; roleName: string },
): Record<string, unknown> {
  return {
    ...payloadFromForm(form),
    ...(options.password ? { password: options.password } : {}),
    ...(options.roleName ? { roles: [options.roleName] } : {}),
  };
}
