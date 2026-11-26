export type RoleChoiceOption = { value: string; label: string };

export type RoleChoices = {
  value: string;
  options: RoleChoiceOption[];
};

/**
 * Select state for one login's role. `currentRoles` is the login's roles in this org ("" when it has none).
 * `catalog` is the roles the viewer may assign. A current role missing from the catalog stays selectable, so
 * the select always shows the stored value.
 */
export function roleChoicesFor(
  currentRoles: readonly string[],
  catalog: readonly { name: string }[],
  noRoleLabel: string,
): RoleChoices {
  const current = currentRoles[0] ?? "";
  const options: RoleChoiceOption[] = catalog.map((role) => ({ value: role.name, label: role.name }));
  if (current === "") {
    options.unshift({ value: "", label: noRoleLabel });
    return { value: "", options };
  }
  if (!options.some((option) => option.value === current)) {
    options.unshift({ value: current, label: current });
  }
  return { value: current, options };
}
