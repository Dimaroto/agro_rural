"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FinancialSettingsForm({
  openingBalanceCents,
  defaultCurrency,
  notes,
}: {
  openingBalanceCents: number;
  defaultCurrency: string;
  notes: string | null;
}) {
  const router = useRouter();
  const [balance, setBalance] = useState((openingBalanceCents / 100).toFixed(2));
  const [currency, setCurrency] = useState(defaultCurrency);
  const [notesValue, setNotesValue] = useState(notes ?? "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    const openingBalanceCents = Math.round(parseFloat(balance.replace(",", ".")) * 100);
    await fetch("/api/admin/finance/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        openingBalanceCents,
        defaultCurrency: currency,
        notes: notesValue || null,
      }),
    });
    setLoading(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="finance-form-card space-y-3">
      <h3 className="text-sm font-semibold text-[#026842] dark:text-zinc-100">
        Configurações financeiras
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-[#6b7280]">Saldo inicial (R$)</label>
          <input className="finance-input" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-[#6b7280]">Moeda</label>
          <input className="finance-input" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-[#6b7280]">Observações fiscais</label>
        <textarea className="finance-input min-h-[5rem]" value={notesValue} onChange={(e) => setNotesValue(e.target.value)} />
      </div>
      {saved && <p className="text-sm text-emerald-700">Configurações salvas.</p>}
      <button type="submit" disabled={loading} className="admin-btn-primary">
        {loading ? "Salvando…" : "Salvar configurações"}
      </button>
    </form>
  );
}
