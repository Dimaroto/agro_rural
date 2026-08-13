"use client";

import { useState } from "react";

type CatalogLinkCardProps = {
  catalogUrl: string;
  storeName?: string;
};

export function CatalogLinkCard({ catalogUrl, storeName }: CatalogLinkCardProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(catalogUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function shareWhatsApp() {
    const message = `Olá! Confira o catálogo${storeName ? ` da ${storeName}` : ""}: ${catalogUrl}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="admin-card p-4">
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
        Link do catálogo
      </h2>
      <p className="mt-2 break-all rounded-lg bg-zinc-50 p-3 text-sm text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400">
        {catalogUrl}
      </p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Compartilhe este link com seus clientes no WhatsApp.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {copied ? "Link copiado!" : "Copiar link"}
        </button>
        <button
          type="button"
          onClick={shareWhatsApp}
          className="rounded-xl border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
        >
          Compartilhar no WhatsApp
        </button>
      </div>
    </div>
  );
}
