"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

export type UnsavedPendingAction =
  | { type: "href"; href: string }
  | { type: "reload" }
  | { type: "history"; delta: number }
  | { type: "callback"; run: () => void };

type GuardHandlers = {
  isDirty: boolean;
  saveAll: () => Promise<boolean>;
  discard: () => void;
};

type UnsavedChangesContextValue = {
  isDirty: boolean;
  requestNavigation: (action: UnsavedPendingAction) => void;
  registerGuard: (handlers: GuardHandlers | null) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(
  null
);

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error(
      "useUnsavedChanges deve ser usado dentro de UnsavedChangesProvider"
    );
  }
  return ctx;
}

/** Seguro fora do provider (ex.: páginas sem shell). */
export function useUnsavedChangesOptional() {
  return useContext(UnsavedChangesContext);
}

function UnsavedChangesDialog({
  open,
  busy,
  onSave,
  onDiscard,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fechar"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h2
          id="unsaved-changes-title"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          Alterações não salvas
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Há alterações nas descrições que ainda não foram salvas. Deseja salvar
          antes de sair?
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onDiscard}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Não salvar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSave}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "Salvando…" : "Salvar tudo"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const handlersRef = useRef<GuardHandlers | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [pending, setPending] = useState<UnsavedPendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const allowLeaveRef = useRef(false);
  const historyArmedRef = useRef(false);

  const registerGuard = useCallback((handlers: GuardHandlers | null) => {
    handlersRef.current = handlers;
    setIsDirty(Boolean(handlers?.isDirty));
  }, []);

  const runPending = useCallback(
    (action: UnsavedPendingAction) => {
      allowLeaveRef.current = true;
      historyArmedRef.current = false;
      if (action.type === "href") {
        router.push(action.href);
        return;
      }
      if (action.type === "reload") {
        window.location.reload();
        return;
      }
      if (action.type === "history") {
        window.history.go(action.delta);
        return;
      }
      action.run();
    },
    [router]
  );

  const requestNavigation = useCallback(
    (action: UnsavedPendingAction) => {
      if (allowLeaveRef.current) {
        runPending(action);
        return;
      }
      if (!handlersRef.current?.isDirty) {
        runPending(action);
        return;
      }
      setPending(action);
    },
    [runPending]
  );

  const closeDialog = useCallback(() => {
    if (busy) return;
    setPending(null);
  }, [busy]);

  const handleDiscard = useCallback(() => {
    if (!pending) return;
    handlersRef.current?.discard();
    const action = pending;
    setPending(null);
    runPending(action);
  }, [pending, runPending]);

  const handleSave = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    const ok = (await handlersRef.current?.saveAll()) ?? false;
    setBusy(false);
    if (!ok) return;
    const action = pending;
    setPending(null);
    runPending(action);
  }, [pending, runPending]);

  useEffect(() => {
    if (!isDirty) {
      allowLeaveRef.current = false;
      historyArmedRef.current = false;
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowLeaveRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (allowLeaveRef.current) return;
      const isRefresh =
        event.key === "F5" ||
        ((event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "r");
      if (!isRefresh) return;
      event.preventDefault();
      requestNavigation({ type: "reload" });
    };

    if (!historyArmedRef.current) {
      window.history.pushState({ unsavedGuard: true }, "");
      historyArmedRef.current = true;
    }

    const onPopState = () => {
      if (allowLeaveRef.current) return;
      // Reempilha o estado sentinela e, ao confirmar, volta 2 entradas
      // (sentinela atual + página dirty) para sair de fato.
      window.history.pushState({ unsavedGuard: true }, "");
      requestNavigation({ type: "history", delta: -2 });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, [isDirty, requestNavigation]);

  const value = useMemo(
    () => ({ isDirty, requestNavigation, registerGuard }),
    [isDirty, requestNavigation, registerGuard]
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <UnsavedChangesDialog
        open={pending != null}
        busy={busy}
        onSave={() => void handleSave()}
        onDiscard={handleDiscard}
        onCancel={closeDialog}
      />
    </UnsavedChangesContext.Provider>
  );
}
