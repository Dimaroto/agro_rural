"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useCustomerAuth } from "@/lib/customer-auth/provider";
import { safeStoreCallbackUrl } from "@/lib/safe-callback-url";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeStoreCallbackUrl(searchParams.get("callbackUrl"), "/");
  const { login } = useCustomerAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login({ email, password });
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="catalog-page-content mx-auto w-full min-w-0 max-w-md flex-1 px-4 py-8 pb-10 sm:px-6">
      <h1 className="text-2xl font-bold text-brand-dark">Entrar</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Entre com sua conta para finalizar pedidos e ver o histórico.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 min-w-0 space-y-4 rounded-2xl border border-brand/10 bg-white p-5 shadow-sm">
        <div className="min-w-0">
          <label className="text-sm font-medium text-zinc-700">E-mail</label>
          <input
            type="email"
            required
            autoComplete="email"
            className="mt-1.5 box-border w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-2.5"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="min-w-0">
          <label className="text-sm font-medium text-zinc-700">Senha</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            className="mt-1.5 box-border w-full min-w-0 rounded-xl border border-zinc-200 px-3 py-2.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-600">
        Não tem conta?{" "}
        <Link
          href={`/conta/cadastro?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-medium text-brand"
        >
          Cadastre-se
        </Link>
      </p>
      <p className="mt-2 text-center">
        <Link href="/" className="text-sm text-zinc-500">
          Voltar ao catálogo
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="catalog-page-content flex flex-1 items-center justify-center p-8">
          <p className="text-zinc-600">Carregando…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
