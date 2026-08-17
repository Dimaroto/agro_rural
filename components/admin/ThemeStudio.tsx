"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatApiError } from "@/lib/apiError";
import { useUnsavedChangesOptional } from "@/components/admin/UnsavedChangesContext";
import {
  LINEAR_DIRECTIONS,
  MAX_BRAND_PRESETS,
  activePreset,
  brandFillCss,
  clampPresetName,
  cloneBrandPreset,
  parseBrandPreset,
  parseBrandSurface,
  parseBrandThemeDocument,
  replacePreset,
  type BrandPreset,
  type BrandSurface,
  type BrandThemeDocument,
  type BrandThemeShape,
} from "@/lib/brand-theme";

type ThemeStudioProps = {
  initialTheme?: string | BrandThemeDocument | null;
};

export function ThemeStudio({ initialTheme }: ThemeStudioProps) {
  const router = useRouter();
  const unsaved = useUnsavedChangesOptional();
  const [saved, setSaved] = useState(() =>
    parseBrandThemeDocument(initialTheme ?? null)
  );
  const [doc, setDoc] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const next = parseBrandThemeDocument(initialTheme ?? null);
    setSaved(next);
    setDoc(next);
  }, [initialTheme]);

  const current = activePreset(doc);
  const isDirty = useMemo(
    () => JSON.stringify(doc) !== JSON.stringify(saved),
    [doc, saved]
  );

  function patchPreset(partial: Partial<BrandPreset>) {
    setDoc((prev) => {
      const active = activePreset(prev);
      return replacePreset(prev, { ...active, ...partial });
    });
    setMsg("");
    setError("");
  }

  function patchSurface(
    key: "header" | "buttons" | "background",
    partial: Partial<BrandSurface>
  ) {
    setDoc((prev) => {
      const active = activePreset(prev);
      const fallback =
        key === "background" ? active.background : active[key];
      const nextSurface = parseBrandSurface({ ...active[key], ...partial }, fallback);
      return replacePreset(prev, { ...active, [key]: nextSurface });
    });
    setMsg("");
    setError("");
  }

  const save = useCallback(async () => {
    setSaving(true);
    setMsg("");
    setError("");
    const payload: BrandThemeDocument = {
      version: 2,
      activePresetId: doc.activePresetId,
      presets: doc.presets.map((p) =>
        parseBrandPreset({ ...p, name: clampPresetName(p.name) })
      ),
    };
    const res = await fetch("/api/admin/store", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: payload }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(formatApiError(data.error, "Erro ao salvar cores"));
      return false;
    }
    const next = parseBrandThemeDocument(data.theme ?? payload);
    setSaved(next);
    setDoc(next);
    setMsg("Predefinição salva!");
    router.refresh();
    return true;
  }, [doc, router]);

  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    unsaved?.registerGuard({
      isDirty,
      saveAll: () => saveRef.current(),
      discard: () => {
        setDoc(saved);
        setMsg("");
        setError("");
      },
    });
    return () => unsaved?.registerGuard(null);
  }, [isDirty, saved, unsaved]);

  function selectPreset(id: string) {
    setDoc((prev) => ({ ...prev, activePresetId: id }));
    setMsg("");
    setError("");
  }

  function createPreset() {
    if (doc.presets.length >= MAX_BRAND_PRESETS) {
      setError(`Limite de ${MAX_BRAND_PRESETS} predefinições.`);
      return;
    }
    const next = cloneBrandPreset(current, "Sem título");
    setDoc((prev) => ({
      ...prev,
      presets: [...prev.presets, next],
      activePresetId: next.id,
    }));
    setMsg("");
    setError("");
  }

  function deletePreset() {
    if (doc.presets.length <= 1) return;
    const presets = doc.presets.filter((p) => p.id !== current.id);
    setDoc({
      version: 2,
      presets,
      activePresetId: presets[0].id,
    });
    setMsg("");
    setError("");
  }

  return (
    <div className="theme-studio grid gap-6 lg:grid-cols-[minmax(18rem,22rem)_1fr]">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Predefinição
        </p>
        <div className="mt-2 flex gap-2">
          <select
            value={current.id}
            onChange={(e) => selectPreset(e.target.value)}
            className="admin-input flex-1 py-2 text-sm"
          >
            {doc.presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={createPreset}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Nova
          </button>
        </div>

        <SurfaceEditor
          title="Header"
          hint="Barra do topo e rodapé"
          surface={current.header}
          onChange={(partial) => patchSurface("header", partial)}
        />
        <SurfaceEditor
          title="Botões"
          hint="Comprar, filtros e CTAs"
          surface={current.buttons}
          onChange={(partial) => patchSurface("buttons", partial)}
        />
        <SurfaceEditor
          title="Fundo do site"
          hint="Área atrás dos produtos"
          surface={current.background}
          onChange={(partial) => patchSurface("background", partial)}
        />

        <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-zinc-400">
          Nome da predefinição
          <input
            type="text"
            maxLength={40}
            value={current.name}
            onChange={(e) => patchPreset({ name: e.target.value })}
            className="admin-input mt-2 w-full py-2 text-sm font-medium normal-case tracking-normal"
            placeholder="Ex: Oliva clássico"
          />
        </label>

        {error && (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        {msg && (
          <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">
            {msg}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="flex-1 rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
            style={{
              background: brandFillCss(current.buttons),
              color: current.buttons.text,
            }}
          >
            {saving ? "Salvando..." : "Salvar predefinição"}
          </button>
          {doc.presets.length > 1 && (
            <button
              type="button"
              onClick={deletePreset}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Excluir
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Prévia do catálogo
        </p>
        <CatalogPagePreview preset={current} />
      </div>
    </div>
  );
}

function SurfaceEditor({
  title,
  hint,
  surface,
  onChange,
}: {
  title: string;
  hint: string;
  surface: BrandSurface;
  onChange: (partial: Partial<BrandSurface>) => void;
}) {
  return (
    <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {title}
      </p>
      <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <ModeBtn
          label="Sólida"
          active={surface.mode === "solid"}
          onClick={() => onChange({ mode: "solid" })}
        />
        <ModeBtn
          label="Degradê"
          active={surface.mode === "gradient"}
          onClick={() => onChange({ mode: "gradient" })}
        />
      </div>

      <div className="mt-3 space-y-2">
        <ColorRow
          label={surface.mode === "gradient" ? "Cor 1" : "Cor de fundo"}
          value={surface.from}
          onChange={(from) => onChange({ from })}
        />
        {surface.mode === "gradient" && (
          <ColorRow
            label="Cor 2"
            value={surface.to}
            onChange={(to) => onChange({ to })}
          />
        )}
        <ColorRow
          label="Texto"
          value={surface.text}
          onChange={(text) => onChange({ text })}
        />
      </div>

      {surface.mode === "gradient" && (
        <>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Forma
          </p>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {(
              [
                ["linear", "Linear"],
                ["radial", "Radial"],
                ["conic", "Cônico"],
              ] as [BrandThemeShape, string][]
            ).map(([shape, label]) => (
              <button
                key={shape}
                type="button"
                onClick={() => onChange({ shape })}
                className={`rounded-lg border px-2 py-1.5 text-xs font-medium ${
                  surface.shape === shape
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {surface.shape !== "radial" && (
            <>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Direção
              </p>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {LINEAR_DIRECTIONS.map((d) => (
                  <button
                    key={d.angle}
                    type="button"
                    title={d.label}
                    onClick={() => onChange({ angle: d.angle })}
                    className={`rounded-lg border px-1 py-1.5 text-[10px] font-medium ${
                      surface.angle === d.angle
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40"
                        : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                    }`}
                  >
                    {d.angle}°
                  </button>
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                Ângulo
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={surface.angle}
                  onChange={(e) => onChange({ angle: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="w-8 tabular-nums">{surface.angle}°</span>
              </label>
            </>
          )}
        </>
      )}
    </div>
  );
}

function CatalogPagePreview({ preset }: { preset: BrandPreset }) {
  const headerFill = brandFillCss(preset.header);
  const headerText = preset.header.text;
  const pageBg = brandFillCss(preset.background);
  const pageFg = preset.background.text;
  const btnFill = brandFillCss(preset.buttons);
  const btnText = preset.buttons.text;
  const muted =
    headerText === "#FFFFFF" || headerText === "#ffffff"
      ? "rgba(255,255,255,0.78)"
      : "rgba(26,46,18,0.7)";
  const pillBg =
    headerText === "#FFFFFF" || headerText === "#ffffff"
      ? "rgba(255,255,255,0.28)"
      : "rgba(26,46,18,0.16)";

  return (
    <div
      className="overflow-hidden rounded-2xl border border-zinc-200 shadow-sm dark:border-zinc-700"
      aria-hidden
    >
      <div
        className="px-3 pb-2 pt-2"
        style={{ background: headerFill, color: headerText }}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-4 w-4 flex-col justify-center gap-[3px]">
            <span className="h-px w-full rounded" style={{ background: headerText }} />
            <span className="h-px w-full rounded" style={{ background: headerText }} />
            <span className="h-px w-full rounded" style={{ background: headerText }} />
          </span>
          <span
            className="h-7 w-7 shrink-0 rounded-md"
            style={{ background: pillBg }}
          />
          <span
            className="h-2.5 w-20 rounded-sm"
            style={{ background: headerText, opacity: 0.92 }}
          />
          <span className="ml-auto h-7 min-w-0 flex-1 rounded-full bg-white/95 shadow-sm" />
          <span className="hidden text-[10px] font-semibold sm:inline" style={{ color: muted }}>
            Entrar
          </span>
          <span
            className="h-7 w-7 shrink-0 rounded-full"
            style={{ background: pillBg }}
          />
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none"
            style={{ background: pillBg, color: headerText }}
          >
            Home
          </span>
          {["Todos", "Rações", "Insumos"].map((label) => (
            <span
              key={label}
              className="px-1 text-[10px] font-medium leading-none"
              style={{ color: muted }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-3 py-3" style={{ background: pageBg, color: pageFg }}>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-amber-200/70 bg-[#F3EFE4]"
            >
              <div className="h-14 bg-zinc-200/80 sm:h-20" />
              <div className="space-y-1.5 p-2">
                <div className="h-2 w-full rounded bg-zinc-300/80" />
                <div className="h-2 w-2/3 rounded bg-zinc-300/60" />
                <div
                  className="mt-1.5 h-6 w-full rounded-full text-center text-[9px] font-semibold leading-6"
                  style={{ background: btnFill, color: btnText }}
                >
                  Comprar
                </div>
              </div>
            </div>
          ))}
        </div>
        <div
          className="mx-auto h-8 w-40 rounded-full text-center text-[11px] font-semibold leading-8"
          style={{ background: btnFill, color: btnText }}
        >
          Ver ofertas
        </div>
      </div>

      <div
        className="grid grid-cols-3 gap-2 px-3 py-3 text-[9px] leading-tight"
        style={{ background: headerFill, color: headerText }}
      >
        <div>
          <div className="h-4 w-12 rounded" style={{ background: pillBg }} />
          <p className="mt-1.5 opacity-70">Agropecuária e insumos.</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wide opacity-85">Navegação</p>
          <p className="mt-1 opacity-80">Home</p>
          <p className="opacity-80">Todos</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wide opacity-85">Contato</p>
          <p className="mt-1 font-semibold">WhatsApp</p>
        </div>
      </div>
    </div>
  );
}

function ModeBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2 py-2 text-xs font-medium ${
        active
          ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      }`}
    >
      {label}
    </button>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-500">
      <span className="w-24 shrink-0">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-8 w-10 cursor-pointer rounded border border-zinc-200 bg-transparent p-0 dark:border-zinc-700"
      />
      <input
        type="text"
        value={value}
        maxLength={7}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (v === "" || v === "#") return;
          if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v.toUpperCase());
        }}
        className="admin-input flex-1 py-1.5 font-mono text-xs uppercase"
      />
    </label>
  );
}
