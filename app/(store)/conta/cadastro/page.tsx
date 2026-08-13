"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useCustomerAuth } from "@/lib/customer-auth/provider";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_HINT,
  validatePasswordPolicy,
} from "@/lib/password-policy";
import { safeStoreCallbackUrl } from "@/lib/safe-callback-url";

function CadastroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeStoreCallbackUrl(
    searchParams.get("callbackUrl"),
    "/meus-pedidos"
  );
  const { register } = useCustomerAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    street: "",
    number: "",
    district: "",
    city: "",
    zipCode: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const trimmedName = form.name.trim();
      if (trimmedName.length < 2) {
        setError("Informe seu nome (mínimo 2 caracteres).");
        return;
      }
      const policy = validatePasswordPolicy(form.password);
      if (!policy.ok) {
        setError(policy.message);
        return;
      }
      await register({ ...form, name: trimmedName });
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  const loginHref = `/conta/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <div className="catalog-page-content mx-auto w-full min-w-0 max-w-lg flex-1 px-4 py-8 pb-10 sm:px-6">
      <h1 className="text-2xl font-bold text-brand-dark">Criar conta</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Conta obrigatória para finalizar pedidos. Informe nome, e-mail e senha.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 min-w-0 space-y-4 rounded-2xl border border-brand/10 bg-white p-5 shadow-sm"
      >
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="min-w-0 sm:col-span-2">
            <label className="text-sm font-medium text-zinc-700">Nome *</label>
            <input
              required
              minLength={2}
              autoComplete="name"
              className="mt-1.5 box-border w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-2.5"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
          </div>
          <div className="min-w-0 sm:col-span-2">
            <label className="text-sm font-medium text-zinc-700">E-mail *</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="mt-1.5 box-border w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-2.5"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
            />
          </div>
          <div className="min-w-0 sm:col-span-2">
            <label className="text-sm font-medium text-zinc-700">Senha *</label>
            <input
              type="password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              autoComplete="new-password"
              className="mt-1.5 box-border w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-2.5"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
            />
            <p className="mt-1.5 text-xs text-zinc-500">{PASSWORD_POLICY_HINT}</p>
          </div>
          <div className="min-w-0">
            <label className="text-sm font-medium text-zinc-700">Telefone</label>
            <input
              className="mt-1.5 box-border w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-2.5"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
            />
          </div>
          <div className="min-w-0 sm:col-span-2">
            <label className="text-sm font-medium text-zinc-700">Rua</label>
            <input
              className="mt-1.5 box-border w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-2.5"
              value={form.street}
              onChange={(e) => updateField("street", e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <label className="text-sm font-medium text-zinc-700">Número</label>
            <input
              className="mt-1.5 box-border w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-2.5"
              value={form.number}
              onChange={(e) => updateField("number", e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <label className="text-sm font-medium text-zinc-700">Bairro</label>
            <input
              className="mt-1.5 box-border w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-2.5"
              value={form.district}
              onChange={(e) => updateField("district", e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <label className="text-sm font-medium text-zinc-700">Cidade</label>
            <input
              className="mt-1.5 box-border w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-2.5"
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <label className="text-sm font-medium text-zinc-700">CEP</label>
            <input
              className="mt-1.5 box-border w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-2.5"
              value={form.zipCode}
              onChange={(e) => updateField("zipCode", e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Cadastrando…" : "Criar conta"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-600">
        Já tem conta?{" "}
        <Link href={loginHref} className="font-medium text-brand">
          Entrar
        </Link>
      </p>
    </div>
  );
}

export default function CadastroPage() {
  return (
    <Suspense
      fallback={
        <div className="catalog-page-content flex flex-1 items-center justify-center p-8">
          <p className="text-zinc-600">Carregando…</p>
        </div>
      }
    >
      <CadastroForm />
    </Suspense>
  );
}
