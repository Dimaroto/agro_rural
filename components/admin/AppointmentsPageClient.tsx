"use client";

import { useEffect, useMemo, useState } from "react";
import { formatApiError } from "@/lib/apiError";
import {
  formatBrBirthDate,
  formatBrPhone,
} from "@/lib/br-contact";
import {
  type AppointmentRange,
  formatAppointmentDate,
  formatAppointmentTime,
  formatBrTime,
  isoDateFromMasked,
  isoTimeFromMasked,
  maskedDateFromIso,
  startOfSaoPauloDay,
} from "@/lib/appointment-datetime";
import { CalendarIcon, ClockIcon } from "@/components/admin/AdminIcons";
import type { AppointmentListItem } from "@/lib/admin-appointments-shared";

type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
};

const RANGE_TABS: { id: AppointmentRange; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "upcoming", label: "Próximos" },
  { id: "all", label: "Todos" },
];

const STATUS_LABEL: Record<AppointmentListItem["status"], string> = {
  SCHEDULED: "Agendado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

function isToday(iso: string) {
  const start = startOfSaoPauloDay();
  const day = formatAppointmentDate(start);
  return formatAppointmentDate(new Date(iso)) === day;
}

export function AppointmentsPageClient({
  initialAppointments,
}: {
  initialAppointments: AppointmentListItem[];
}) {
  const [range, setRange] = useState<AppointmentRange>("today");
  const [appointments, setAppointments] = useState(initialAppointments);
  const [loadingList, setLoadingList] = useState(false);

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [date, setDate] = useState(() => formatAppointmentDate(new Date()));
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const q = customerQuery.trim();
    if (customer || q.length < 2) {
      setCustomerResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void fetch(`/api/admin/customers?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => {
          const list = (data.customers ?? []) as CustomerOption[];
          setCustomerResults(list.slice(0, 8));
        })
        .catch(() => setCustomerResults([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [customerQuery, customer]);

  async function loadRange(next: AppointmentRange) {
    setLoadingList(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/appointments?range=${encodeURIComponent(next)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(data.error, "Erro ao carregar agendamentos"));
        return;
      }
      setAppointments(data.appointments ?? []);
    } catch {
      setError("Não foi possível carregar os agendamentos.");
    } finally {
      setLoadingList(false);
    }
  }

  function selectRange(next: AppointmentRange) {
    setRange(next);
    void loadRange(next);
  }

  function resetAppointmentForm() {
    setDate(formatAppointmentDate(new Date()));
    setTime("");
    setNotes("");
  }

  async function saveNewCustomer() {
    if (savingCustomer) return;
    setSavingCustomer(true);
    setError("");
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          phone: newPhone,
          email: newEmail,
          birthDate: newBirthDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(data.error, "Erro ao salvar cliente"));
        return;
      }
      const created = data.customer as CustomerOption;
      setCustomer({
        id: created.id,
        name: created.name,
        phone: created.phone,
      });
      setShowNewCustomer(false);
      setNewName("");
      setNewPhone("");
      setNewEmail("");
      setNewBirthDate("");
      setCustomerQuery("");
    } catch {
      setError("Não foi possível cadastrar o cliente.");
    } finally {
      setSavingCustomer(false);
    }
  }

  async function createAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) {
      setError("Selecione ou cadastre um cliente.");
      return;
    }
    if (saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          date,
          time,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(data.error, "Erro ao criar agendamento"));
        return;
      }
      const created = data.appointment as AppointmentListItem;
      const nextRange: AppointmentRange = isToday(created.startsAt)
        ? "today"
        : "upcoming";
      setRange(nextRange);
      resetAppointmentForm();
      setSuccess(
        nextRange === "today"
          ? "Agendamento criado para hoje."
          : "Agendamento criado. Veja em Próximos."
      );
      await loadRange(nextRange);
    } catch {
      setError("Não foi possível criar o agendamento.");
    } finally {
      setSaving(false);
    }
  }

  async function patchStatus(
    id: string,
    status: AppointmentListItem["status"]
  ) {
    setUpdatingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(data.error, "Erro ao atualizar"));
        return;
      }
      const updated = data.appointment as AppointmentListItem;
      setAppointments((prev) =>
        prev.map((item) => (item.id === id ? updated : item))
      );
    } catch {
      setError("Não foi possível atualizar o agendamento.");
    } finally {
      setUpdatingId(null);
    }
  }

  const grouped = useMemo(() => {
    if (range === "today") {
      return [{ label: null as string | null, items: appointments }];
    }
    const map = new Map<string, AppointmentListItem[]>();
    for (const item of appointments) {
      const key = formatAppointmentDate(new Date(item.startsAt));
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }));
  }, [appointments, range]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Agendamentos
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Fluxo do dia: ao abrir a página, veja os horários de hoje. Use
          Próximos para o que vem pela frente.
        </p>
      </header>

      <form
        onSubmit={createAppointment}
        className="admin-card space-y-3 p-4 sm:p-5"
      >
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Novo agendamento
        </h2>
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {success}
          </p>
        )}

        {customer ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/60">
            <span className="font-medium">{customer.name}</span>
            {customer.phone && (
              <span className="text-zinc-500">{customer.phone}</span>
            )}
            <button
              type="button"
              className="ml-auto text-xs font-medium text-[#026842]"
              onClick={() => {
                setCustomer(null);
                setCustomerQuery("");
              }}
            >
              Trocar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm">
              Cliente
              <input
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Buscar por nome ou telefone"
                className="admin-input mt-1 w-full px-3 py-2"
              />
            </label>
            {customerResults.length > 0 && (
              <ul className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
                {customerResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      onClick={() => {
                        setCustomer(c);
                        setCustomerQuery("");
                        setCustomerResults([]);
                        setShowNewCustomer(false);
                      }}
                    >
                      <span>{c.name}</span>
                      {c.phone && (
                        <span className="text-zinc-500">{c.phone}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="text-sm font-medium text-[#026842]"
              onClick={() => setShowNewCustomer((v) => !v)}
            >
              {showNewCustomer ? "Cancelar cadastro" : "Cadastrar cliente"}
            </button>
          </div>
        )}

        {showNewCustomer && !customer && (
          <div className="grid gap-3 rounded-xl border border-dashed border-zinc-300 p-3 sm:grid-cols-2">
            <label className="text-sm">
              Nome *
              <input
                required
                minLength={2}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="admin-input mt-1 w-full px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Telefone
              <input
                inputMode="numeric"
                value={newPhone}
                onChange={(e) => setNewPhone(formatBrPhone(e.target.value))}
                placeholder="(49) 99999-9999"
                className="admin-input mt-1 w-full px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Data de nascimento *
              <input
                required
                inputMode="numeric"
                value={newBirthDate}
                onChange={(e) =>
                  setNewBirthDate(formatBrBirthDate(e.target.value))
                }
                placeholder="DD/MM/AAAA"
                className="admin-input mt-1 w-full px-3 py-2"
              />
            </label>
            <label className="text-sm">
              E-mail
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="admin-input mt-1 w-full px-3 py-2"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="button"
                disabled={savingCustomer}
                onClick={() => void saveNewCustomer()}
                className="admin-btn-primary"
              >
                {savingCustomer ? "Salvando..." : "Salvar cliente"}
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Data *
            <div className="relative mt-1">
              <input
                required
                inputMode="numeric"
                value={date}
                onChange={(e) => setDate(formatBrBirthDate(e.target.value))}
                placeholder="DD/MM/AAAA"
                className="admin-input w-full px-3 py-2 pr-10"
              />
              <span className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-500">
                <CalendarIcon className="h-4 w-4" />
              </span>
              <input
                type="date"
                aria-label="Selecionar data"
                className="absolute inset-y-0 right-0 w-10 cursor-pointer opacity-0"
                value={isoDateFromMasked(date)}
                onChange={(e) => {
                  if (e.target.value) setDate(maskedDateFromIso(e.target.value));
                }}
              />
            </div>
          </label>
          <label className="text-sm">
            Horário *
            <div className="relative mt-1">
              <input
                required
                inputMode="numeric"
                value={time}
                onChange={(e) => setTime(formatBrTime(e.target.value))}
                placeholder="HH:MM"
                className="admin-input w-full px-3 py-2 pr-10"
              />
              <span className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-500">
                <ClockIcon className="h-4 w-4" />
              </span>
              <input
                type="time"
                aria-label="Selecionar horário"
                className="absolute inset-y-0 right-0 w-10 cursor-pointer opacity-0"
                value={isoTimeFromMasked(time)}
                onChange={(e) => {
                  if (e.target.value) {
                    setTime(formatBrTime(e.target.value.replace(/\D/g, "")));
                  }
                }}
              />
            </div>
          </label>
        </div>

        <label className="text-sm">
          Observações
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={2000}
            className="admin-input mt-1 w-full px-3 py-2"
            placeholder="Opcional"
          />
        </label>

        <button
          type="submit"
          disabled={saving || !customer}
          className="admin-btn-primary"
        >
          {saving ? "Salvando..." : "Criar agendamento"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {RANGE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectRange(tab.id)}
            className={
              range === tab.id
                ? "admin-btn-primary"
                : "admin-btn-secondary"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loadingList ? (
        <p className="text-sm text-zinc-500">Carregando...</p>
      ) : appointments.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {range === "today"
            ? "Nenhum agendamento para hoje."
            : range === "upcoming"
              ? "Nenhum agendamento futuro."
              : "Nenhum agendamento cadastrado."}
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <section key={group.label ?? "today"} className="space-y-2">
              {group.label && (
                <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                  {group.label}
                </h3>
              )}
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="admin-card flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatAppointmentTime(new Date(item.startsAt))}
                        {range !== "today" && (
                          <span className="ml-2 text-sm font-normal text-zinc-500">
                            {formatAppointmentDate(new Date(item.startsAt))}
                          </span>
                        )}
                        <span className="ml-2 text-xs font-medium text-zinc-500">
                          {STATUS_LABEL[item.status]}
                        </span>
                      </p>
                      <p className="text-sm">{item.customer.name}</p>
                      {item.customer.phone && (
                        <p className="text-xs text-zinc-500">
                          {item.customer.phone}
                        </p>
                      )}
                      {item.notes && (
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {item.notes}
                        </p>
                      )}
                    </div>
                    {item.status === "SCHEDULED" && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          className="admin-btn-primary text-sm"
                          onClick={() => void patchStatus(item.id, "COMPLETED")}
                        >
                          Concluir
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          className="admin-btn-secondary text-sm"
                          onClick={() => void patchStatus(item.id, "CANCELLED")}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
