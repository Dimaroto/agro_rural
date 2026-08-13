"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type CatalogSearchContextValue = {
  search: string;
  setSearch: (value: string) => void;
};

const CatalogSearchContext = createContext<CatalogSearchContextValue | null>(
  null
);

export function CatalogSearchProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState("");

  const value = useMemo(
    () => ({ search, setSearch }),
    [search]
  );

  return (
    <CatalogSearchContext.Provider value={value}>
      {children}
    </CatalogSearchContext.Provider>
  );
}

export function useCatalogSearch() {
  const ctx = useContext(CatalogSearchContext);
  if (!ctx) {
    throw new Error(
      "useCatalogSearch deve ser usado dentro de CatalogSearchProvider"
    );
  }
  return ctx;
}
