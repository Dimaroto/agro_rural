"use client";

import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { formatApiError } from "@/lib/apiError";
import {
  formatBrBirthDate,
  formatBrPhone,
  isoToBrBirthDate,
} from "@/lib/br-contact";
import { searchIncludes } from "@/lib/search-text";

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  isBirthday: boolean;
  document?: string | null;
  street?: string | null;
  number?: string | null;
  district?: string | null;
  city?: string | null;
  zipCode?: string | null;
  state?: string | null;
  complement?: string | null;
  ie?: string | null;
  openBalanceCents: number;
  paidOrderCount: number;
  lastOrderAt: string | null;
};

const emptyFiscal = {
  document: "",
  street: "",
  number: "",
  district: "",
  city: "",
  zipCode: "",
  state: "",
  complement: "",
  ie: "",
};

export function CustomersPageClient({
  initialCustomers,
}: {
  initialCustomers: CustomerRow[];
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [fiscal, setFiscal] = useState(emptyFiscal);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        searchIncludes(c.name, q) ||
        (c.phone ? searchIncludes(c.phone, q) : false) ||
        (c.email ? searchIncludes(c.email, q) : false) ||
        (c.document ? searchIncludes(c.document, q) : false)
    );
  }, [customers, query]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setPhone("");
    setEmail("");
    setBirthDate("");
    setFiscal(emptyFiscal);
  }

  function startEdit(c: CustomerRow) {
    setEditingId(c.id);
    setName(c.name);
    setPhone(c.phone ? formatBrPhone(c.phone) : "");
    setEmail(c.email ?? "");
    setBirthDate(isoToBrBirthDate(c.birthDate));
    setFiscal({
      document: c.document ?? "",
      street: c.street ?? "",
      number: c.number ?? "",
      district: c.district ?? "",
      city: c.city ?? "",
      zipCode: c.zipCode ?? "",
      state: c.state ?? "",
      complement: c.complement ?? "",
      ie: c.ie ?? "",
    });
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const url = editingId
        ? `/api/admin/customers/${editingId}`
        : "/api/admin/customers";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          birthDate,
          ...fiscal,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(data.error, "Erro ao salvar cliente"));
        return;
      }
      const saved = data.customer as CustomerRow & {
        name: string | null;
        phone: string | null;
      };
      setCustomers((prev) => {
        const row: CustomerRow = {
          id: saved.id,
          name: saved.name?.trim() || "Sem nome",
          phone: saved.phone ? formatBrPhone(saved.phone) : null,
          email: saved.email,
          birthDate: saved.birthDate ?? null,
          isBirthday: Boolean(saved.isBirthday),
          document: saved.document ?? null,
          street: saved.street ?? null,
          number: saved.number ?? null,
          district: saved.district ?? null,
          city: saved.city ?? null,
          zipCode: saved.zipCode ?? null,
          state: saved.state ?? null,
          complement: saved.complement ?? null,
          ie: saved.ie ?? null,
          openBalanceCents: saved.openBalanceCents ?? 0,
          paidOrderCount:
            prev.find((p) => p.id === saved.id)?.paidOrderCount ?? 0,
          lastOrderAt: prev.find((p) => p.id === saved.id)?.lastOrderAt ?? null,
        };
        if (editingId) {
          return prev.map((p) => (p.id === editingId ? { ...p, ...row } : p));
        }
        return [row, ...prev];
      });
      resetForm();
    } catch {
      setError("Não foi possível salvar o cliente.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "admin-input mt-1 w-full px-3 py-2";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Clientes
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cadastro para o caixa, vendas a prazo e NF-e
        </p>
      </header>

      <form onSubmit={handleSubmit} className="admin-card space-y-3 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {editingId ? "Editar cliente" : "Novo cliente"}
        </h2>
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            Nome *
            <input
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            Telefone
            <input
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(formatBrPhone(e.target.value))}
              placeholder="(49) 99999-9999"
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            Data de nascimento *
            <input
              required
              inputMode="numeric"
              autoComplete="bday"
              value={birthDate}
              onChange={(e) => setBirthDate(formatBrBirthDate(e.target.value))}
              placeholder="DD/MM/AAAA"
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Dados fiscais (NF-e)
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            CPF/CNPJ
            <input
              value={fiscal.document}
              onChange={(e) =>
                setFiscal((f) => ({ ...f, document: e.target.value }))
              }
              className={inputClass}
              placeholder="Somente números"
            />
          </label>
          <label className="text-sm">
            IE
            <input
              value={fiscal.ie}
              onChange={(e) => setFiscal((f) => ({ ...f, ie: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Logradouro
            <input
              value={fiscal.street}
              onChange={(e) =>
                setFiscal((f) => ({ ...f, street: e.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            Número
            <input
              value={fiscal.number}
              onChange={(e) =>
                setFiscal((f) => ({ ...f, number: e.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            Complemento
            <input
              value={fiscal.complement}
              onChange={(e) =>
                setFiscal((f) => ({ ...f, complement: e.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            Bairro
            <input
              value={fiscal.district}
              onChange={(e) =>
                setFiscal((f) => ({ ...f, district: e.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            Cidade
            <input
              value={fiscal.city}
              onChange={(e) =>
                setFiscal((f) => ({ ...f, city: e.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            UF
            <input
              value={fiscal.state}
              onChange={(e) =>
                setFiscal((f) => ({
                  ...f,
                  state: e.target.value.toUpperCase().slice(0, 2),
                }))
              }
              className={inputClass}
              maxLength={2}
              placeholder="SC"
            />
          </label>
          <label className="text-sm">
            CEP
            <input
              value={fiscal.zipCode}
              onChange={(e) =>
                setFiscal((f) => ({ ...f, zipCode: e.target.value }))
              }
              className={inputClass}
              placeholder="00000000"
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="admin-btn-primary">
            {saving ? "Salvando…" : editingId ? "Atualizar" : "Cadastrar"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="admin-btn-secondary"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="admin-card overflow-hidden">
        <div className="border-b border-zinc-100 p-3 dark:border-zinc-800">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, telefone, documento ou e-mail…"
            className="admin-input w-full px-3 py-2"
          />
        </div>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {filtered.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-zinc-500">
              Nenhum cliente encontrado
            </li>
          ) : (
            filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {c.name}
                      {c.isBirthday ? " · aniversário hoje" : ""}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {[
                        c.phone,
                        c.document,
                        c.birthDate ? isoToBrBirthDate(c.birthDate) : null,
                        c.email,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Sem contato"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    {c.openBalanceCents > 0 ? (
                      <p className="font-semibold text-amber-700">
                        Aberto {formatPrice(c.openBalanceCents)}
                      </p>
                    ) : (
                      <p className="text-zinc-400">Em dia</p>
                    )}
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
