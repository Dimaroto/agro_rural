"use client";

import { useEffect, useMemo, useState } from "react";
import { formatApiError } from "@/lib/apiError";

type Supplier = {
  id: string;
  name: string;
  tradeName: string | null;
  document: string;
  ie: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  zipCode: string | null;
  active: boolean;
};

const empty = {
  name: "",
  tradeName: "",
  document: "",
  ie: "",
  phone: "",
  email: "",
  street: "",
  number: "",
  district: "",
  city: "",
  state: "",
  zipCode: "",
};

function moneyDoc(d: string) {
  return d.replace(/\D/g, "");
}

export function SuppliersPageClient() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load(q?: string) {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    const res = await fetch(`/api/admin/suppliers${qs}`);
    const data = await res.json();
    if (res.ok) setSuppliers(data.suppliers ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.document.includes(moneyDoc(q)) ||
        (s.tradeName ?? "").toLowerCase().includes(q)
    );
  }, [suppliers, query]);

  function reset() {
    setEditingId(null);
    setForm(empty);
    setError("");
  }

  function edit(s: Supplier) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      tradeName: s.tradeName ?? "",
      document: s.document,
      ie: s.ie ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      street: s.street ?? "",
      number: s.number ?? "",
      district: s.district ?? "",
      city: s.city ?? "",
      state: s.state ?? "",
      zipCode: s.zipCode ?? "",
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        document: moneyDoc(form.document),
        tradeName: form.tradeName || null,
        ie: form.ie || null,
        phone: form.phone || null,
        email: form.email || null,
      };
      const res = await fetch(
        editingId ? `/api/admin/suppliers/${editingId}` : "/api/admin/suppliers",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error) || "Erro ao salvar");
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(id: string) {
    if (!confirm("Desativar este fornecedor?")) return;
    await fetch(`/api/admin/suppliers/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="admin-stack">
      <header className="finance-page-header">
        <h1 className="finance-page-header__title">Fornecedores</h1>
        <p className="finance-page-header__desc">
          Cadastro usado na importação de NF-e de entrada e contas a pagar.
        </p>
      </header>

      <div className="admin-toolbar">
        <input
          className="finance-input"
          placeholder="Buscar nome ou CNPJ…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <form className="finance-form-card" onSubmit={save}>
        <h2>{editingId ? "Editar fornecedor" : "Novo fornecedor"}</h2>
        {error ? <p className="admin-error">{error}</p> : null}
        <div className="admin-form-grid">
          <label>
            Razão social
            <input
              className="finance-input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Nome fantasia
            <input
              className="finance-input"
              value={form.tradeName}
              onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
            />
          </label>
          <label>
            CNPJ/CPF
            <input
              className="finance-input"
              required
              value={form.document}
              onChange={(e) => setForm({ ...form, document: e.target.value })}
            />
          </label>
          <label>
            IE
            <input
              className="finance-input"
              value={form.ie}
              onChange={(e) => setForm({ ...form, ie: e.target.value })}
            />
          </label>
          <label>
            Telefone
            <input
              className="finance-input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label>
            E-mail
            <input
              className="finance-input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Cidade
            <input
              className="finance-input"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </label>
          <label>
            UF
            <input
              className="finance-input"
              maxLength={2}
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
          </label>
        </div>
        <div className="admin-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Salvando…" : editingId ? "Atualizar" : "Cadastrar"}
          </button>
          {editingId ? (
            <button type="button" className="btn" onClick={reset}>
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <div className="finance-table-wrap">
        <table className="finance-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Documento</th>
              <th>Cidade</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.document}</td>
                <td>
                  {[s.city, s.state].filter(Boolean).join("/")}
                </td>
                <td>
                  <span
                    className={
                      s.active
                        ? "finance-badge finance-badge--paid"
                        : "finance-badge finance-badge--pending"
                    }
                  >
                    {s.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="admin-actions">
                  <button type="button" className="btn btn-sm" onClick={() => edit(s)}>
                    Editar
                  </button>
                  {s.active ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void deactivate(s.id)}
                    >
                      Desativar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5}>Nenhum fornecedor.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
