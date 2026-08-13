"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Category = { id: string; name: string };

export function FinanceEntryForm({
  type,
  categories = [],
}: {
  type: "INCOME" | "EXPENSE";
  categories?: Category[];
}) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
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
      const res = await fetch("/api/admin/finance/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          description,
          amountCents,
          categoryId: categoryId || null,
          entryDate: new Date(`${entryDate}T12:00:00`).toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Erro ao salvar lançamento"
        );
      }
      setDescription("");
      setAmount("");
      setCategoryId("");
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
        {type === "INCOME" ? "Nova receita manual" : "Nova despesa"}
      </h3>
      <div>
        <label className="text-xs font-medium text-[#6b7280]">Descrição</label>
        <input
          className="finance-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-[#6b7280]">Valor (R$)</label>
          <input
            className="finance-input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[#6b7280]">Data</label>
          <input
            type="date"
            className="finance-input"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            required
          />
        </div>
      </div>
      {type === "EXPENSE" && categories.length > 0 && (
        <div>
          <label className="text-xs font-medium text-[#6b7280]">Categoria</label>
          <select
            className="finance-input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="admin-btn-primary">
        {loading ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
