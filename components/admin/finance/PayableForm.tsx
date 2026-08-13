"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Category = { id: string; name: string };

export function PayableForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        throw new Error("Informe um valor válido");
      }
      const res = await fetch("/api/admin/finance/payables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          amountCents,
          dueDate: new Date(`${dueDate}T12:00:00`).toISOString(),
          categoryId: categoryId || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      setTitle("");
      setAmount("");
      setDueDate("");
      setCategoryId("");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="finance-form-card space-y-3">
      <h3 className="text-sm font-semibold text-[#026842] dark:text-zinc-100">
        Nova conta a pagar
      </h3>
      <div>
        <label className="text-xs font-medium text-[#6b7280]">Título</label>
        <input className="finance-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-[#6b7280]">Valor (R$)</label>
          <input className="finance-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs font-medium text-[#6b7280]">Vencimento</label>
          <input type="date" className="finance-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-[#6b7280]">Categoria</label>
        <select className="finance-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-[#6b7280]">Observações</label>
        <input className="finance-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="admin-btn-primary">
        {loading ? "Salvando…" : "Adicionar"}
      </button>
    </form>
  );
}

export function MarkPayablePaidButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await fetch(`/api/admin/finance/payables/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markPaid: true }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <button type="button" onClick={handleClick} disabled={loading} className="admin-btn-secondary text-xs">
      {loading ? "…" : "Marcar pago"}
    </button>
  );
}
