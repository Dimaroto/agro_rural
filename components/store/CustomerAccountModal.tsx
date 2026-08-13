"use client";

import { useEffect, useState } from "react";
import { useCustomerAuth } from "@/lib/customer-auth/provider";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_HINT,
  validatePasswordPolicy,
} from "@/lib/password-policy";

type Mode = "register" | "login";
type Intent = "checkout" | "general";

type CustomerAccountModalProps = {
  open: boolean;
  mode: Mode;
  intent: Intent;
  onModeChange: (mode: Mode) => void;
  onClose: () => void;
  onAuthenticated: () => void;
};

export function CustomerAccountModal({
  open,
  mode,
  intent,
  onModeChange,
  onClose,
  onAuthenticated,
}: CustomerAccountModalProps) {
  const { register, login } = useCustomerAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setPassword("");
  }, [open, mode]);

  if (!open) return null;

  const isCheckout = intent === "checkout";
  const title = isCheckout
    ? "Conta obrigatória"
    : mode === "register"
      ? "Criar conta"
      : "Entrar";
  const subtitle = isCheckout
    ? "Nome, e-mail e senha para finalizar o pedido."
    : "Acesse pedidos e finalize compras com mais rapidez.";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        const trimmedName = name.trim();
        if (trimmedName.length < 2) {
          setError("Informe seu nome completo.");
          return;
        }
        const policy = validatePasswordPolicy(password);
        if (!policy.ok) {
          setError(policy.message);
          return;
        }
        await register({ name: trimmedName, email, password });
      } else {
        await login({ email, password });
      }
      onAuthenticated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === "register"
            ? "Erro ao cadastrar"
            : "Erro ao entrar"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-account-modal-title"
      onClick={onClose}
    >
      <div
        className="account-modal flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white text-[#026842] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-zinc-100 px-4 pb-3 pt-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="customer-account-modal-title"
                className="text-lg font-bold leading-tight text-brand-dark sm:text-xl"
              >
                {title}
              </h2>
              <p className="mt-1 text-sm leading-snug text-zinc-600">
                {subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg px-2 py-1 text-xl leading-none text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
            <button
              type="button"
              className={`rounded-lg py-1.5 text-sm font-semibold transition ${
                mode === "register"
                  ? "bg-white text-brand-dark shadow-sm"
                  : "text-zinc-500"
              }`}
              onClick={() => {
                onModeChange("register");
                setError("");
              }}
            >
              Criar conta
            </button>
            <button
              type="button"
              className={`rounded-lg py-1.5 text-sm font-semibold transition ${
                mode === "login"
                  ? "bg-white text-brand-dark shadow-sm"
                  : "text-zinc-500"
              }`}
              onClick={() => {
                onModeChange("login");
                setError("");
              }}
            >
              Já tenho conta
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3 sm:px-5 sm:py-4"
        >
          <div
            className={`grid gap-2.5 ${
              mode === "register" ? "sm:grid-cols-2" : "sm:grid-cols-2"
            }`}
          >
            {mode === "register" && (
              <div className="sm:col-span-1">
                <label className="text-xs font-medium text-zinc-700 sm:text-sm">
                  Nome *
                </label>
                <input
                  required
                  autoComplete="name"
                  minLength={2}
                  className="account-modal-input mt-1 box-border w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-[#026842]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className={mode === "register" ? "" : "sm:col-span-1"}>
              <label className="text-xs font-medium text-zinc-700 sm:text-sm">
                E-mail *
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                className="account-modal-input mt-1 box-border w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-[#026842]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div
              className={
                mode === "register" ? "sm:col-span-2" : "sm:col-span-1"
              }
            >
              <label className="text-xs font-medium text-zinc-700 sm:text-sm">
                Senha *
              </label>
              <input
                type="password"
                required
                minLength={mode === "register" ? PASSWORD_MIN_LENGTH : 1}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                className="account-modal-input mt-1 box-border w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-[#026842]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === "register" && (
                <p className="mt-1 text-[11px] leading-snug text-zinc-500 sm:text-xs">
                  {PASSWORD_POLICY_HINT}
                </p>
              )}
            </div>
          </div>

          {error && (
            <p className="mt-2.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-3 flex flex-col gap-1.5 sm:mt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:py-3 sm:text-base"
            >
              {loading
                ? mode === "register"
                  ? "Criando conta…"
                  : "Entrando…"
                : mode === "register"
                  ? isCheckout
                    ? "Criar conta e continuar"
                    : "Criar conta"
                  : isCheckout
                    ? "Entrar e continuar"
                    : "Entrar"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-1.5 text-sm text-zinc-500 hover:text-zinc-700"
            >
              {isCheckout ? "Voltar ao carrinho" : "Fechar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
