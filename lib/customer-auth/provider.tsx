"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { mockCustomerAuthAdapter } from "./mock-adapter";
import type { CustomerAuthProfile, LoginInput, RegisterInput } from "./types";

type CustomerAuthContextValue = {
  customer: CustomerAuthProfile | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerAuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const session = await mockCustomerAuthAdapter.getSession();
      setCustomer(session);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (input: LoginInput) => {
    const profile = await mockCustomerAuthAdapter.login(input);
    setCustomer(profile);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const profile = await mockCustomerAuthAdapter.register(input);
    setCustomer(profile);
  }, []);

  const logout = useCallback(async () => {
    await mockCustomerAuthAdapter.logout();
    setCustomer(null);
  }, []);

  const value = useMemo(
    () => ({ customer, loading, login, register, logout, refresh }),
    [customer, loading, login, register, logout, refresh]
  );

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) {
    throw new Error("useCustomerAuth deve ser usado dentro de CustomerAuthProvider");
  }
  return ctx;
}
