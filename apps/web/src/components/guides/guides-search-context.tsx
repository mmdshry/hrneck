"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type GuidesSearchContextValue = {
  query: string;
  setQuery: (value: string) => void;
};

const GuidesSearchContext = createContext<GuidesSearchContextValue | null>(null);

export function GuidesSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return (
    <GuidesSearchContext.Provider value={value}>
      {children}
    </GuidesSearchContext.Provider>
  );
}

export function useGuidesSearch(): GuidesSearchContextValue {
  const value = useContext(GuidesSearchContext);
  if (!value) {
    throw new Error("useGuidesSearch must be used within GuidesSearchProvider");
  }
  return value;
}
