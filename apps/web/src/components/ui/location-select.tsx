"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useState,
  type InputHTMLAttributes,
} from "react";
import { Input } from "@/components/ui/input";
import { MAJOR_CITIES, isMajorCity } from "@/lib/locations";
import { cn } from "@/lib/utils";

export type LocationSelectProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "list" | "type"
> & {
  value: string;
  onChange: (value: string) => void;
};

export const LocationSelect = forwardRef<HTMLInputElement, LocationSelectProps>(
  ({ value, onChange, className, id, disabled, ...props }, ref) => {
    const listId = useId();
    const [query, setQuery] = useState(value);

    useEffect(() => {
      setQuery(value);
    }, [value]);

    const options = useMemo(() => {
      const current = value.trim();
      const base = [...MAJOR_CITIES];
      if (current && !isMajorCity(current)) {
        base.unshift(current);
      }
      const needle = query.trim().toLowerCase();
      if (!needle) {
        return base.slice(0, 80);
      }
      return base
        .filter((city) => city.toLowerCase().includes(needle))
        .slice(0, 80);
    }, [query, value]);

    return (
      <>
        <Input
          ref={ref}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          list={listId}
          autoComplete="off"
          disabled={disabled}
          className={cn(className)}
          value={query}
          placeholder="Iran/Tehran"
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            if (next === "" || isMajorCity(next) || next === value) {
              onChange(next);
            }
          }}
          onBlur={() => {
            if (query === "" || isMajorCity(query) || query === value) {
              onChange(query);
              return;
            }
            setQuery(value);
          }}
          {...props}
        />
        <datalist id={listId}>
          {options.map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>
      </>
    );
  },
);
LocationSelect.displayName = "LocationSelect";
