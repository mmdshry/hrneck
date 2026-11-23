"use client";

import { forwardRef, useMemo, type SelectHTMLAttributes } from "react";
import { Select } from "@/components/ui/select";

type TimezoneOption = {
  value: string;
  label: string;
};

function formatUtcOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}

function offsetMinutesForZone(timeZone: string, at: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(at);
    const raw = parts.find((part) => part.type === "timeZoneName")?.value;
    if (!raw) {
      return null;
    }
    if (raw === "GMT" || raw === "UTC") {
      return 0;
    }
    const match = raw.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?$/);
    if (!match) {
      return null;
    }
    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = Number(match[3] ?? "0");
    return sign * (hours * 60 + minutes);
  } catch {
    return null;
  }
}

function labelForZone(timeZone: string, at: Date): string {
  const offsetMinutes = offsetMinutesForZone(timeZone, at);
  if (offsetMinutes === null) {
    return timeZone;
  }
  return `${timeZone} (${formatUtcOffset(offsetMinutes)})`;
}

function listTimezoneOptions(at: Date): TimezoneOption[] {
  const supported =
    typeof Intl !== "undefined" && "supportedValuesOf" in Intl
      ? Intl.supportedValuesOf("timeZone")
      : [];
  const zones = new Set<string>(supported);
  zones.add("UTC");
  return Array.from(zones)
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({
      value,
      label: labelForZone(value, at),
    }));
}

export type TimezoneSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children">;

export const TimezoneSelect = forwardRef<HTMLSelectElement, TimezoneSelectProps>(
  ({ value, required = true, ...props }, ref) => {
    const options = useMemo(() => {
      const at = new Date();
      const base = listTimezoneOptions(at);
      const current = typeof value === "string" ? value : "";
      if (current && !base.some((option) => option.value === current)) {
        return [{ value: current, label: labelForZone(current, at) }, ...base];
      }
      return base;
    }, [value]);

    return (
      <Select ref={ref} value={value} required={required} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    );
  },
);
TimezoneSelect.displayName = "TimezoneSelect";
