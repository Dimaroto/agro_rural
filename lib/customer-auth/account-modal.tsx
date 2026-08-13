"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CustomerAccountModal } from "@/components/store/CustomerAccountModal";

export type AccountModalMode = "register" | "login";
export type AccountModalIntent = "checkout" | "general";

export type OpenAccountModalOptions = {
  initialMode?: AccountModalMode;
  intent?: AccountModalIntent;
  onSuccess?: () => void;
  onDismiss?: () => void;
};

type AccountModalContextValue = {
  openAccountModal: (options?: OpenAccountModalOptions) => void;
  closeAccountModal: () => void;
};

const AccountModalContext = createContext<AccountModalContextValue | null>(
  null
);

export function AccountModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AccountModalMode>("login");
  const [intent, setIntent] = useState<AccountModalIntent>("general");
  const [onSuccess, setOnSuccess] = useState<(() => void) | null>(null);
  const [onDismiss, setOnDismiss] = useState<(() => void) | null>(null);

  const closeAccountModal = useCallback(
    (didAuthenticate = false) => {
      setOpen(false);
      const dismiss = onDismiss;
      const success = onSuccess;
      setOnSuccess(null);
      setOnDismiss(null);
      if (didAuthenticate) {
        success?.();
      } else {
        dismiss?.();
      }
    },
    [onDismiss, onSuccess]
  );

  const openAccountModal = useCallback((options?: OpenAccountModalOptions) => {
    setMode(options?.initialMode ?? "login");
    setIntent(options?.intent ?? "general");
    setOnSuccess(() => options?.onSuccess ?? null);
    setOnDismiss(() => options?.onDismiss ?? null);
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({
      openAccountModal,
      closeAccountModal: () => closeAccountModal(false),
    }),
    [openAccountModal, closeAccountModal]
  );

  return (
    <AccountModalContext.Provider value={value}>
      {children}
      <CustomerAccountModal
        open={open}
        mode={mode}
        intent={intent}
        onModeChange={setMode}
        onClose={() => closeAccountModal(false)}
        onAuthenticated={() => closeAccountModal(true)}
      />
    </AccountModalContext.Provider>
  );
}

export function useAccountModal() {
  const ctx = useContext(AccountModalContext);
  if (!ctx) {
    throw new Error(
      "useAccountModal deve ser usado dentro de AccountModalProvider"
    );
  }
  return ctx;
}
