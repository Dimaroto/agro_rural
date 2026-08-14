"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatBrBirthDate, isValidCalendarDate } from "@/lib/br-contact";
import {
  formatBrTime,
  parseBrDateParts,
  parseBrTime,
} from "@/lib/appointment-datetime";
import { CalendarIcon, ClockIcon } from "@/components/admin/AdminIcons";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function todayParts() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function buildMonthCells(year: number, month: number) {
  const first = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let day = 1; day <= days; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {dir === "left" ? (
        <path d="M15 6l-6 6 6 6" />
      ) : (
        <path d="M9 6l6 6-6 6" />
      )}
    </svg>
  );
}

export function AppointmentDateTimeFields({
  date,
  time,
  onDateChange,
  onTimeChange,
}: {
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  const [open, setOpen] = useState<"date" | "time" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(null);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={rootRef} className="grid gap-3 sm:grid-cols-2">
      <DateField
        value={date}
        open={open === "date"}
        onToggle={() => setOpen((v) => (v === "date" ? null : "date"))}
        onChange={(next) => {
          onDateChange(next);
          setOpen(null);
        }}
        onTyped={onDateChange}
      />
      <TimeField
        value={time}
        open={open === "time"}
        onToggle={() => setOpen((v) => (v === "time" ? null : "time"))}
        onChange={onTimeChange}
        onCommit={() => setOpen(null)}
        onTyped={onTimeChange}
      />
    </div>
  );
}

function DateField({
  value,
  open,
  onToggle,
  onChange,
  onTyped,
}: {
  value: string;
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  onTyped: (value: string) => void;
}) {
  const selected = parseBrDateParts(value);
  const [cursor, setCursor] = useState(() => {
    const t = todayParts();
    return {
      year: selected?.year ?? t.year,
      month: selected?.month ?? t.month,
    };
  });

  useEffect(() => {
    if (!open) return;
    const t = todayParts();
    const s = parseBrDateParts(value);
    setCursor({
      year: s?.year ?? t.year,
      month: s?.month ?? t.month,
    });
  }, [open, value]);

  const today = todayParts();
  const cells = useMemo(
    () => buildMonthCells(cursor.year, cursor.month),
    [cursor.year, cursor.month]
  );

  return (
    <div className="text-sm">
      <span>Data *</span>
      <div className="relative mt-1">
        <input
          required
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => onTyped(formatBrBirthDate(e.target.value))}
          placeholder="DD/MM/AAAA"
          className="admin-input w-full px-3 py-2 pr-11"
        />
        <button
          type="button"
          aria-label="Abrir calendário"
          aria-expanded={open}
          onClick={onToggle}
          className="appt-picker-trigger"
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
        {open && (
          <div className="appt-picker" role="dialog" aria-label="Calendário">
            <div className="appt-cal__header">
              <button
                type="button"
                className="appt-cal__nav"
                aria-label="Mês anterior"
                onClick={() =>
                  setCursor((c) => shiftMonth(c.year, c.month, -1))
                }
              >
                <Chevron dir="left" />
              </button>
              <p className="appt-cal__title">
                {MONTHS[cursor.month - 1]} {cursor.year}
              </p>
              <button
                type="button"
                className="appt-cal__nav"
                aria-label="Próximo mês"
                onClick={() =>
                  setCursor((c) => shiftMonth(c.year, c.month, 1))
                }
              >
                <Chevron dir="right" />
              </button>
            </div>
            <div className="appt-cal__week">
              {WEEKDAYS.map((d, i) => (
                <span key={`${d}-${i}`}>{d}</span>
              ))}
            </div>
            <div className="appt-cal__grid">
              {cells.map((day, i) => {
                if (day == null) {
                  return <span key={`e-${i}`} />;
                }
                const isToday =
                  day === today.day &&
                  cursor.month === today.month &&
                  cursor.year === today.year;
                const isSelected =
                  selected != null &&
                  day === selected.day &&
                  cursor.month === selected.month &&
                  cursor.year === selected.year;
                const valid = isValidCalendarDate(
                  cursor.year,
                  cursor.month,
                  day
                );
                return (
                  <button
                    key={`d-${day}`}
                    type="button"
                    disabled={!valid}
                    className={
                      isSelected
                        ? "appt-cal__day appt-cal__day--selected"
                        : isToday
                          ? "appt-cal__day appt-cal__day--today"
                          : "appt-cal__day"
                    }
                    onClick={() =>
                      onChange(
                        `${pad(day)}/${pad(cursor.month)}/${cursor.year}`
                      )
                    }
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="appt-picker__today"
              onClick={() =>
                onChange(`${pad(today.day)}/${pad(today.month)}/${today.year}`)
              }
            >
              Hoje
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TimeField({
  value,
  open,
  onToggle,
  onChange,
  onCommit,
  onTyped,
}: {
  value: string;
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  onCommit: () => void;
  onTyped: (value: string) => void;
}) {
  const parsed = parseBrTime(value);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const hour = parsed?.hour ?? 8;
    const minute = parsed?.minute ?? 0;
    const hourEl = hoursRef.current?.querySelector(`[data-h="${hour}"]`);
    const minuteEl = minutesRef.current?.querySelector(`[data-m="${minute}"]`);
    hourEl?.scrollIntoView({ block: "nearest" });
    minuteEl?.scrollIntoView({ block: "nearest" });
  }, [open, parsed?.hour, parsed?.minute]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => {
    const base = Array.from({ length: 12 }, (_, i) => i * 5);
    if (parsed && !base.includes(parsed.minute)) {
      return [...base, parsed.minute].sort((a, b) => a - b);
    }
    return base;
  }, [parsed]);

  function apply(hour: number, minute: number, commit: boolean) {
    onChange(`${pad(hour)}:${pad(minute)}`);
    if (commit) onCommit();
  }

  return (
    <div className="text-sm">
      <span>Horário *</span>
      <div className="relative mt-1">
        <input
          required
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => onTyped(formatBrTime(e.target.value))}
          placeholder="HH:MM"
          className="admin-input w-full px-3 py-2 pr-11"
        />
        <button
          type="button"
          aria-label="Abrir relógio"
          aria-expanded={open}
          onClick={onToggle}
          className="appt-picker-trigger"
        >
          <ClockIcon className="h-4 w-4" />
        </button>
        {open && (
          <div className="appt-picker appt-clock" role="dialog" aria-label="Horário">
            <p className="appt-clock__preview">
              {pad(parsed?.hour ?? 8)}:{pad(parsed?.minute ?? 0)}
            </p>
            <div className="appt-clock__cols">
              <div className="appt-clock__group">
                <p className="appt-clock__label">Hora</p>
                <div ref={hoursRef} className="appt-clock__scroll">
                  {hours.map((h) => (
                    <button
                      key={h}
                      type="button"
                      data-h={h}
                      className={
                        parsed?.hour === h
                          ? "appt-clock__item appt-clock__item--selected"
                          : "appt-clock__item"
                      }
                      onClick={() => apply(h, parsed?.minute ?? 0, false)}
                    >
                      {pad(h)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="appt-clock__group">
                <p className="appt-clock__label">Min</p>
                <div ref={minutesRef} className="appt-clock__scroll">
                  {minutes.map((m) => (
                    <button
                      key={m}
                      type="button"
                      data-m={m}
                      className={
                        parsed?.minute === m
                          ? "appt-clock__item appt-clock__item--selected"
                          : "appt-clock__item"
                      }
                      onClick={() => apply(parsed?.hour ?? 8, m, true)}
                    >
                      {pad(m)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
