"use client";

import { useFormStatus } from "react-dom";

/** Campos + botão com bloqueio de clique duplo e estado de carregamento. */
export function AdminLoginFormFields({ callbackUrl }: { callbackUrl: string }) {
  const { pending } = useFormStatus();

  return (
    <fieldset disabled={pending} className="min-w-0 space-y-4 border-0 p-0">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div>
        <label className="text-sm text-zinc-600 dark:text-zinc-400">Login</label>
        <input
          name="email"
          type="text"
          inputMode="numeric"
          autoComplete="username"
          required
          className="admin-input mt-1 w-full py-2"
        />
      </div>
      <div>
        <label className="text-sm text-zinc-600 dark:text-zinc-400">Senha</label>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="admin-input mt-1 w-full py-2"
        />
      </div>
      <button
        type="submit"
        aria-busy={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (
          <>
            <span
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden
            />
            Entrando…
          </>
        ) : (
          "Entrar"
        )}
      </button>
    </fieldset>
  );
}
