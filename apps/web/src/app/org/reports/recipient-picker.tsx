"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

export type RecipientOption = {
  id: number;
  name: string;
  email: string;
  /** Still selected, but the person no longer has report access, so they cannot be saved. */
  unavailable?: boolean;
};

type RecipientPickerProps = {
  id: string;
  options: RecipientOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
};

function matchesQuery(option: RecipientOption, query: string): boolean {
  if (query === "") return true;
  const needle = query.toLowerCase();
  return (
    option.name.toLowerCase().includes(needle) || option.email.toLowerCase().includes(needle)
  );
}

function preventFormSubmitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") {
    event.preventDefault();
  }
}

export function RecipientPicker({ id, options, selectedIds, onChange }: RecipientPickerProps) {
  const t = useTranslations("org.reports");
  const tCommon = useTranslations("common");
  const [query, setQuery] = useState("");

  const visibleOptions = useMemo(
    () => options.filter((option) => matchesQuery(option, query.trim())),
    [options, query],
  );

  const selectedOptions = useMemo(
    () =>
      selectedIds
        .map((selectedId) => options.find((option) => option.id === selectedId))
        .filter((option): option is RecipientOption => option !== undefined),
    [options, selectedIds],
  );

  const visibleIds = visibleOptions.map((option) => option.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((visibleId) => selectedIds.includes(visibleId));

  function toggle(optionId: number) {
    onChange(
      selectedIds.includes(optionId)
        ? selectedIds.filter((selectedId) => selectedId !== optionId)
        : [...selectedIds, optionId],
    );
  }

  function toggleVisible() {
    if (allVisibleSelected) {
      onChange(selectedIds.filter((selectedId) => !visibleIds.includes(selectedId)));
      return;
    }
    onChange([...new Set([...selectedIds, ...visibleIds])]);
  }

  let emptyMessage: string | null = null;
  if (visibleOptions.length === 0) {
    emptyMessage = options.length === 0 ? t("recipientsEmpty") : t("recipientsNoMatch");
  }

  return (
    <div className="space-y-2">
      <Input
        id={id}
        type="search"
        autoComplete="off"
        value={query}
        placeholder={tCommon("search")}
        aria-label={tCommon("search")}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={preventFormSubmitOnEnter}
      />

      {selectedOptions.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={tCommon("recipients")}>
          {selectedOptions.map((option) => (
            <li
              key={option.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-xs"
            >
              <span className="truncate">{option.name || option.email}</span>
              <button
                type="button"
                className="rounded-full px-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                aria-label={t("removeRecipient", { name: option.name || option.email })}
                onClick={() => toggle(option.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted-foreground)]">
        <span>{t("recipientsSelectedCount", { count: selectedIds.length })}</span>
        <button
          type="button"
          className="underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          disabled={visibleIds.length === 0}
          onClick={toggleVisible}
        >
          {allVisibleSelected ? tCommon("clear") : tCommon("selectAll")}
        </button>
      </div>

      <div className="max-h-56 overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        {emptyMessage !== null ? (
          <p className="px-3 py-2 text-sm text-[var(--muted-foreground)]">{emptyMessage}</p>
        ) : (
          <ul>
            {visibleOptions.map((option) => (
              <li key={option.id} className="border-b border-[var(--border)] last:border-b-0">
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[var(--muted)]">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0"
                    checked={selectedIds.includes(option.id)}
                    onChange={() => toggle(option.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{option.name || option.email}</span>
                    <span className="block truncate text-xs text-[var(--muted-foreground)]">
                      {option.email}
                    </span>
                  </span>
                  {option.unavailable ? (
                    <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                      {t("recipientUnavailable")}
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
