"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  countActiveFilters,
  emptyFilterState,
  hasActiveFilters,
  serializeDataTableQuery,
  type DataTableFilterState,
} from "@/lib/data-table-query";

const DEFAULT_DEBOUNCE_MS = 250;

export type UseDataTableQueryOptions = {
  debounceMs?: number;
  /** Called with debounced filter state (page should reset to 1 in the consumer). */
  onDebouncedChange?: (state: DataTableFilterState) => void;
  initialState?: Partial<DataTableFilterState>;
};

export function useDataTableQuery(options: UseDataTableQueryOptions = {}) {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const onDebouncedChange = options.onDebouncedChange;
  const [state, setState] = useState<DataTableFilterState>(() => ({
    ...emptyFilterState(),
    ...options.initialState,
    columnFilters: {
      ...emptyFilterState().columnFilters,
      ...options.initialState?.columnFilters,
    },
  }));
  const [debounced, setDebounced] = useState<DataTableFilterState>(state);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDebouncedRef = useRef(onDebouncedChange);
  onDebouncedRef.current = onDebouncedChange;

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebounced(state);
      onDebouncedRef.current?.(state);
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state, debounceMs]);

  const setQ = useCallback((q: string) => {
    setState((prev) => ({ ...prev, q }));
  }, []);

  const setColumnFilter = useCallback((id: string, value: string) => {
    setState((prev) => {
      const next = { ...prev.columnFilters };
      if (!value.trim()) {
        delete next[id];
      } else {
        next[id] = value;
      }
      return { ...prev, columnFilters: next };
    });
  }, []);

  const setSorting = useCallback((id: string) => {
    setState((prev) => {
      const current = prev.sorting[0];
      if (current?.id === id) {
        if (!current.desc) {
          return { ...prev, sorting: [{ id, desc: true }] };
        }
        return { ...prev, sorting: [] };
      }
      return { ...prev, sorting: [{ id, desc: false }] };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      q: "",
      columnFilters: {},
    }));
  }, []);

  const reset = useCallback(() => {
    setState(emptyFilterState());
  }, []);

  const queryParams = useMemo(() => serializeDataTableQuery(debounced), [debounced]);

  return {
    state,
    setState,
    debounced,
    queryParams,
    setQ,
    setColumnFilter,
    setSorting,
    clearFilters,
    reset,
    activeCount: countActiveFilters(state),
    hasFilters: hasActiveFilters(state),
  };
}
