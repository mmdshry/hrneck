import { useTranslations } from "next-intl";
import { permissionLabelKeys } from "./permission-labels";

type PermissionCheckboxGridProps = {
  legend: string;
  catalog: string[];
  selected: string[];
  onToggle: (permission: string) => void;
  disabled?: boolean;
};

export function PermissionCheckboxGrid({
  legend,
  catalog,
  selected,
  onToggle,
  disabled = false,
}: PermissionCheckboxGridProps) {
  const t = useTranslations("org.roles");
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm text-[var(--muted-foreground)]">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {catalog.map((permission) => {
          const keys = permissionLabelKeys(permission);
          return (
            <label
              key={permission}
              className="flex min-h-11 items-center gap-2 text-sm"
              title={keys ? t(keys.description) : permission}
            >
              <input
                type="checkbox"
                checked={selected.includes(permission)}
                disabled={disabled}
                onChange={() => onToggle(permission)}
              />
              <span>{keys ? t(keys.label) : permission}</span>
              <span className="text-xs text-[var(--muted-foreground)]">{permission}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
