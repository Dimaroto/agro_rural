"use client";

import { useEffect, useState } from "react";
import { FiscalSettingsPanel } from "@/components/admin/FiscalSettingsPanel";
import { checkEmissorUp } from "@/lib/nfe/client";
import {
  openEmissorFromUi,
  startEmissorFromUi,
} from "@/lib/nfe/launcher";

type EmissorLocalClientProps = {
  setupDownloadUrl: string;
};

const STEPS = [
  "Baixe o instalador Windows neste PC.",
  "Rode o Setup sem “Executar como administrador”.",
  "Volte aqui e clique em Iniciar emissor (aguarde o LED verde).",
  "Envie o certificado A1 (.pfx) e a senha — só neste computador.",
  "Em Vendas, use Emitir NF-e.",
];

export function EmissorLocalClient({
  setupDownloadUrl,
}: EmissorLocalClientProps) {
  const [online, setOnline] = useState(false);
  const [startHint, setStartHint] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const ok = await checkEmissorUp();
      if (!cancelled) setOnline(ok);
    }
    void poll();
    const id = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  function onStart() {
    try {
      const mode = startEmissorFromUi();
      setStartHint(
        mode === "desktop"
          ? "Iniciando emissor local..."
          : "Se o navegador perguntar, permita abrir o aplicativo Agro Rural."
      );
    } catch {
      setStartHint(
        "Não foi possível iniciar. Instale o Setup desta página ou use o atalho Iniciar emissor NF-e."
      );
    }
  }

  return (
    <div className="space-y-8">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Status neste PC
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  online ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              {online
                ? "Emissor online em 127.0.0.1:8000"
                : "Emissor offline — instale e inicie neste computador"}
            </p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              O certificado e a emissão ficam só no PC. O site não guarda o
              .pfx e não fala com a SEFAZ.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {setupDownloadUrl ? (
              <a
                href={setupDownloadUrl}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Baixar para Windows
              </a>
            ) : (
              <span className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
                Instalador ainda não publicado
              </span>
            )}
            {online ? (
              <button
                type="button"
                onClick={() => openEmissorFromUi()}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Configurar emissor
              </button>
            ) : (
              <button
                type="button"
                onClick={onStart}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Iniciar emissor
              </button>
            )}
          </div>
        </div>
        {startHint && !online && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            {startHint}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <FiscalSettingsPanel online={online} />
      </div>
    </div>
  );
}
