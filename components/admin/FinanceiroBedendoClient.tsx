"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatApiError } from "@/lib/apiError";
import { formatPrice } from "@/lib/format";

type Tab = "caixa" | "futuras";

type Entry = {
  id: string;
  type: "INCOME" | "EXPENSE";
  status: "PENDING" | "CONFIRMED";
  description: string;
  amountCents: number;
  entryDate: string | null;
  paymentMethod: string;
  categoryLabel: string | null;
  supplierName: string | null;
  customerName: string | null;
  boletoCode: string | null;
};

function todayLocal() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function shiftDay(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function FinanceiroBedendoClient() {
  const [tab, setTab] = useState<Tab>("caixa");
  const [day, setDay] = useState(todayLocal());
  const [summary, setSummary] = useState<{
    incomeCents: number;
    expenseCents: number;
    balanceCents: number;
    closed: boolean;
    entries: Entry[];
  } | null>(null);
  const [payables, setPayables] = useState<Entry[]>([]);
  const [receivables, setReceivables] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState<"income" | "expense" | "boleto" | null>(
    null
  );
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("dinheiro");
  const [boletoCode, setBoletoCode] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmDay, setConfirmDay] = useState(todayLocal());
  const [pendingQuery, setPendingQuery] = useState("");

  const loadDay = useCallback(async () => {
    const res = await fetch(`/api/admin/finance/ledger?view=day&day=${day}`);
    const data = await res.json();
    if (res.ok) setSummary(data);
  }, [day]);

  const loadPending = useCallback(async () => {
    const res = await fetch(`/api/admin/finance/ledger?view=pending`);
    const data = await res.json();
    if (res.ok) {
      setPayables(data.payables ?? []);
      setReceivables(data.receivables ?? []);
    }
  }, []);

  useEffect(() => {
    if (tab === "caixa") void loadDay();
    else void loadPending();
  }, [tab, loadDay, loadPending]);

  async function createEntry(type: "INCOME" | "EXPENSE", status: "CONFIRMED" | "PENDING" = "CONFIRMED") {
    setBusy(true);
    setError("");
    try {
      const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
      if (!(amountCents > 0)) throw new Error("Informe o valor");
      const res = await fetch("/api/admin/finance/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          status,
          description: desc || (type === "INCOME" ? "Receita" : "Despesa"),
          amountCents,
          entryDate: status === "CONFIRMED" ? day : confirmDay || day,
          paymentMethod: method,
          boletoCode: boletoCode || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error) || "Erro");
      setFormOpen(null);
      setDesc("");
      setAmount("");
      setBoletoCode("");
      await loadDay();
      await loadPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function parseBoleto() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/finance/boleto/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: boletoCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.result?.valido) {
        throw new Error(data.result?.mensagem || "Boleto inválido");
      }
      if (data.result.valorCents) {
        setAmount((data.result.valorCents / 100).toFixed(2));
      }
      if (data.result.vencimento) {
        setConfirmDay(data.result.vencimento);
      }
      setMethod("boleto");
      if (!desc) setDesc(`Boleto banco ${data.result.banco ?? ""}`.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function closeOrReopen(action: "close" | "reopen") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/finance/cash-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error) || "Erro");
      await loadDay();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEntry(id: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/finance/ledger/${id}?action=confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryDate: confirmDay }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error) || "Erro");
      setConfirmId(null);
      await loadPending();
      await loadDay();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  const pq = pendingQuery.trim().toLowerCase();
  const filteredPayables = useMemo(() => {
    if (!pq) return payables;
    return payables.filter(
      (e) =>
        e.description.toLowerCase().includes(pq) ||
        (e.supplierName ?? "").toLowerCase().includes(pq)
    );
  }, [payables, pq]);

  const filteredReceivables = useMemo(() => {
    if (!pq) return receivables;
    return receivables.filter(
      (e) =>
        e.description.toLowerCase().includes(pq) ||
        (e.customerName ?? "").toLowerCase().includes(pq)
    );
  }, [receivables, pq]);

  return (
    <div className="admin-stack space-y-6">
      <header className="finance-page-header">
        <h1 className="finance-page-header__title">Financeiro</h1>
        <p className="finance-page-header__desc">
          Caixa do dia e contas futuras (a pagar / a receber).
        </p>
      </header>

      <div className="admin-tabs" role="tablist">
        <button
          type="button"
          className={tab === "caixa" ? "admin-tab admin-tab--active" : "admin-tab"}
          onClick={() => setTab("caixa")}
        >
          Caixa do dia
        </button>
        <button
          type="button"
          className={tab === "futuras" ? "admin-tab admin-tab--active" : "admin-tab"}
          onClick={() => setTab("futuras")}
        >
          Contas futuras
        </button>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      {tab === "caixa" ? (
        <>
          <div className="finance-day-nav">
            <div className="finance-day-nav__center">
              <button
                type="button"
                className="btn finance-day-nav__arrow"
                aria-label="Dia anterior"
                onClick={() => setDay(shiftDay(day, -1))}
              >
                ‹
              </button>
              <input
                type="date"
                className="finance-input finance-day-nav__date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
              <button
                type="button"
                className="btn finance-day-nav__arrow"
                aria-label="Próximo dia"
                onClick={() => setDay(shiftDay(day, 1))}
              >
                ›
              </button>
            </div>
            <div className="finance-day-nav__actions">
              <button type="button" className="btn" onClick={() => setDay(todayLocal())}>
                Hoje
              </button>
              {summary?.closed ? (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void closeOrReopen("reopen")}
                >
                  Reabrir caixa
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void closeOrReopen("close")}
                >
                  Fechar caixa
                </button>
              )}
            </div>
          </div>

          <div className="finance-summary-grid">
            <div className="finance-stat">
              <span>Entradas</span>
              <strong>{formatPrice(summary?.incomeCents ?? 0)}</strong>
            </div>
            <div className="finance-stat">
              <span>Saídas</span>
              <strong>{formatPrice(summary?.expenseCents ?? 0)}</strong>
            </div>
            <div className="finance-stat">
              <span>Saldo</span>
              <strong>{formatPrice(summary?.balanceCents ?? 0)}</strong>
            </div>
            <div className="finance-stat">
              <span>Status</span>
              <strong>{summary?.closed ? "Fechado" : "Aberto"}</strong>
            </div>
          </div>

          {!summary?.closed ? (
            <div className="admin-actions">
              <button type="button" className="btn btn-primary" onClick={() => setFormOpen("income")}>
                + Receita
              </button>
              <button type="button" className="btn" onClick={() => setFormOpen("expense")}>
                + Despesa
              </button>
              <button type="button" className="btn" onClick={() => setFormOpen("boleto")}>
                + Boleto
              </button>
            </div>
          ) : null}

          {formOpen ? (
            <form
              className="finance-form-card space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (formOpen === "boleto") {
                  void createEntry("EXPENSE", "PENDING");
                } else {
                  void createEntry(formOpen === "income" ? "INCOME" : "EXPENSE");
                }
              }}
            >
              <h2>
                {formOpen === "income"
                  ? "Nova receita"
                  : formOpen === "boleto"
                    ? "Despesa via boleto"
                    : "Nova despesa"}
              </h2>
              {formOpen === "boleto" ? (
                <div className="flex gap-2 flex-wrap items-end">
                  <label className="block text-sm flex-1 min-w-[240px]">
                    Linha digitável
                    <input
                      className="finance-input mt-1 w-full"
                      value={boletoCode}
                      onChange={(e) => setBoletoCode(e.target.value)}
                      required
                    />
                  </label>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void parseBoleto()}
                  >
                    Ler boleto
                  </button>
                </div>
              ) : null}
              <label className="block text-sm">
                Descrição
                <input
                  className="finance-input mt-1 w-full"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                Valor (R$)
                <input
                  className="finance-input mt-1 w-full"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </label>
              {formOpen === "boleto" ? (
                <label className="block text-sm">
                  Vencimento (conta futura)
                  <input
                    type="date"
                    className="finance-input mt-1 w-full"
                    value={confirmDay}
                    onChange={(e) => setConfirmDay(e.target.value)}
                  />
                </label>
              ) : (
                <label className="block text-sm">
                  Forma
                  <select
                    className="finance-input mt-1 w-full"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option value="dinheiro">Dinheiro</option>
                    <option value="pix">PIX</option>
                    <option value="cartao">Cartão</option>
                    <option value="transferencia">Transferência</option>
                    <option value="boleto">Boleto</option>
                    <option value="outro">Outro</option>
                  </select>
                </label>
              )}
              <div className="admin-actions">
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Salvar
                </button>
                <button type="button" className="btn" onClick={() => setFormOpen(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : null}

          <div className="finance-dual-grid">
            <section className="finance-dual-col">
              <h2 className="text-sm font-semibold mb-2">Entradas</h2>
              <div className="finance-table-wrap finance-table-wrap--col">
                <table className="finance-table finance-table--compact">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Forma</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary?.entries ?? [])
                      .filter((e) => e.type === "INCOME")
                      .map((e) => (
                        <tr key={e.id}>
                          <td>{e.description}</td>
                          <td>{e.paymentMethod}</td>
                          <td>{formatPrice(e.amountCents)}</td>
                        </tr>
                      ))}
                    {(summary?.entries ?? []).filter((e) => e.type === "INCOME")
                      .length === 0 ? (
                      <tr>
                        <td colSpan={3}>Nenhuma entrada neste dia.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="finance-dual-col">
              <h2 className="text-sm font-semibold mb-2">Saídas</h2>
              <div className="finance-table-wrap finance-table-wrap--col">
                <table className="finance-table finance-table--compact">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Forma</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary?.entries ?? [])
                      .filter((e) => e.type === "EXPENSE")
                      .map((e) => (
                        <tr key={e.id}>
                          <td>{e.description}</td>
                          <td>{e.paymentMethod}</td>
                          <td>{formatPrice(e.amountCents)}</td>
                        </tr>
                      ))}
                    {(summary?.entries ?? []).filter((e) => e.type === "EXPENSE")
                      .length === 0 ? (
                      <tr>
                        <td colSpan={3}>Nenhuma saída neste dia.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {confirmId ? (
            <div className="finance-form-card space-y-3">
              <h2>Confirmar no caixa</h2>
              <label className="block text-sm">
                Data do caixa
                <input
                  type="date"
                  className="finance-input mt-1 w-full"
                  value={confirmDay}
                  onChange={(e) => setConfirmDay(e.target.value)}
                />
              </label>
              <div className="admin-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void confirmEntry(confirmId)}
                >
                  Confirmar
                </button>
                <button type="button" className="btn" onClick={() => setConfirmId(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          <label className="block text-sm">
            <span className="sr-only">Pesquisar contas futuras</span>
            <input
              type="search"
              className="finance-input w-full"
              placeholder="Buscar por cliente, fornecedor ou descrição…"
              value={pendingQuery}
              onChange={(e) => setPendingQuery(e.target.value)}
            />
          </label>

          <div className="finance-dual-grid">
            <section className="finance-dual-col">
              <h2 className="text-sm font-semibold mb-2">A pagar</h2>
              <div className="finance-table-wrap finance-table-wrap--col">
                <table className="finance-table finance-table--compact">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Venc.</th>
                      <th>Valor</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayables.map((e) => (
                      <tr key={e.id}>
                        <td>
                          {e.description}
                          {e.supplierName ? (
                            <span className="text-xs text-zinc-500 block">{e.supplierName}</span>
                          ) : null}
                        </td>
                        <td>{e.entryDate ? String(e.entryDate).slice(0, 10) : "—"}</td>
                        <td>{formatPrice(e.amountCents)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => {
                              setConfirmId(e.id);
                              setConfirmDay(todayLocal());
                            }}
                          >
                            Pagar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredPayables.length === 0 ? (
                      <tr>
                        <td colSpan={4}>
                          {pq
                            ? "Nenhuma conta a pagar corresponde à pesquisa."
                            : "Nenhuma conta a pagar."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="finance-dual-col">
              <h2 className="text-sm font-semibold mb-2">A receber</h2>
              <div className="finance-table-wrap finance-table-wrap--col">
                <table className="finance-table finance-table--compact">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Venc.</th>
                      <th>Valor</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceivables.map((e) => (
                      <tr key={e.id}>
                        <td>
                          {e.description}
                          {e.customerName ? (
                            <span className="text-xs text-zinc-500 block">{e.customerName}</span>
                          ) : null}
                        </td>
                        <td>{e.entryDate ? String(e.entryDate).slice(0, 10) : "—"}</td>
                        <td>{formatPrice(e.amountCents)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => {
                              setConfirmId(e.id);
                              setConfirmDay(todayLocal());
                            }}
                          >
                            Receber
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredReceivables.length === 0 ? (
                      <tr>
                        <td colSpan={4}>
                          {pq
                            ? "Nenhuma conta a receber corresponde à pesquisa."
                            : "Nenhuma conta a receber."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
