"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatApiError } from "@/lib/apiError";
import {
  DEFAULT_BRAND_THEME,
  LINEAR_DIRECTIONS,
  applyBrandThemeToDocument,
  brandFillCss,
  brandOnFillColor,
  parseBrandTheme,
  type BrandTheme,
  type BrandThemeShape,
} from "@/lib/brand-theme";

type BrandColorPanelProps = {
  initialTheme?: BrandTheme | string | null;
};

export function BrandColorPanel({ initialTheme }: BrandColorPanelProps) {
  const router = useRouter();
  const [committed, setCommitted] = useState(() =>
    parseBrandTheme(initialTheme ?? null)
  );
  const [theme, setTheme] = useState(committed);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const next = parseBrandTheme(initialTheme ?? null);
    setCommitted(next);
    setTheme(next);
  }, [initialTheme]);

  useEffect(() => {
    applyBrandThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    return () => applyBrandThemeToDocument(committed);
  }, [committed]);

  function patch(partial: Partial<BrandTheme>) {
    setTheme((prev) => parseBrandTheme({ ...prev, ...partial }));
    setMsg("");
    setError("");
  }

  async function save() {
    setSaving(true);
    setMsg("");
    setError("");
    const res = await fetch("/api/admin/store", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(formatApiError(data.error, "Erro ao salvar cores"));
      return;
    }
    const saved = parseBrandTheme(data.theme ?? theme);
    setCommitted(saved);
    setTheme(saved);
    applyBrandThemeToDocument(saved);
    setMsg("Cores salvas!");
    router.refresh();
  }

  function resetDefault() {
    setTheme({ ...DEFAULT_BRAND_THEME });
    setMsg("");
    setError("");
  }

  const previewFill = brandFillCss(theme);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        Cores do site
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Cor do cabeçalho, botões e destaques do catálogo.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <ModeBtn
          label="Sólida"
          active={theme.mode === "solid"}
          onClick={() => patch({ mode: "solid" })}
        />
        <ModeBtn
          label="Degradê"
          active={theme.mode === "gradient"}
          onClick={() => patch({ mode: "gradient" })}
        />
      </div>

      <div className="mt-3 space-y-2">
        <ColorRow
          label={theme.mode === "gradient" ? "Cor 1" : "Cor principal"}
          value={theme.from}
          onChange={(from) => patch({ from })}
        />
        {theme.mode === "gradient" && (
          <ColorRow
            label="Cor 2"
            value={theme.to}
            onChange={(to) => patch({ to })}
          />
        )}
      </div>

      {theme.mode === "gradient" && (
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
                onClick={() => patch({ shape })}
                className={`rounded-lg border px-2 py-1.5 text-xs font-medium ${
                  theme.shape === shape
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {theme.shape !== "radial" && (
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
                    onClick={() => patch({ angle: d.angle })}
                    className={`rounded-lg border px-1 py-1.5 text-[10px] font-medium ${
                      theme.angle === d.angle
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
                  value={theme.angle}
                  onChange={(e) => patch({ angle: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="w-8 tabular-nums">{theme.angle}°</span>
              </label>
            </>
          )}
        </>
      )}

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        Prévia do catálogo
      </p>
      <CatalogPagePreview theme={theme} />

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {msg && (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
          {msg}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="flex-1 rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: previewFill, color: brandOnFillColor(theme) }}
        >
          {saving ? "Salvando..." : "Salvar cores"}
        </button>
        <button
          type="button"
          onClick={resetDefault}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Restaurar
        </button>
      </div>
    </div>
  );
}

function CatalogPagePreview({ theme }: { theme: BrandTheme }) {
  const fill = brandFillCss(theme);
  const onFill = brandOnFillColor(theme);
  const muted = onFill === "#FFFFFF" ? "rgba(255,255,255,0.78)" : "rgba(26,46,18,0.7)";
  const pillBg =
    onFill === "#FFFFFF" ? "rgba(255,255,255,0.28)" : "rgba(26,46,18,0.16)";

  return (
    <div
      className="mt-1 overflow-hidden rounded-xl border border-zinc-200 shadow-sm dark:border-zinc-700"
      aria-hidden
    >
      <p className="sr-only">Prévia do catálogo</p>
      <div className="px-2 pb-1.5 pt-1.5" style={{ background: fill, color: onFill }}>
        <div className="flex items-center gap-1.5">
          <span className="flex h-3.5 w-3.5 flex-col justify-center gap-[2px]">
            <span className="h-px w-full rounded" style={{ background: onFill }} />
            <span className="h-px w-full rounded" style={{ background: onFill }} />
            <span className="h-px w-full rounded" style={{ background: onFill }} />
          </span>
          <span
            className="h-5 w-5 shrink-0 rounded-md"
            style={{ background: pillBg }}
          />
          <span
            className="h-2 w-14 rounded-sm"
            style={{ background: onFill, opacity: 0.92 }}
          />
          <span className="ml-auto h-5 min-w-0 flex-1 rounded-full bg-white/95 shadow-sm" />
          <span
            className="h-5 w-5 shrink-0 rounded-full"
            style={{ background: pillBg }}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <span
            className="rounded-full px-1.5 py-[2px] text-[8px] font-semibold leading-none"
            style={{ background: pillBg, color: onFill }}
          >
            Home
          </span>
          {["Todos", "Rações", "Insumos"].map((label) => (
            <span
              key={label}
              className="px-1 text-[8px] font-medium leading-none"
              style={{ color: muted }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-1.5 bg-[#e8f6f0] px-2 py-2">
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-amber-200/70 bg-[#F3EFE4]"
            >
              <div className="h-8 bg-zinc-200/80" />
              <div className="space-y-1 p-1">
                <div className="h-1.5 w-full rounded bg-zinc-300/80" />
                <div className="h-1.5 w-2/3 rounded bg-zinc-300/60" />
                <div
                  className="mt-1 h-3.5 w-full rounded-full"
                  style={{ background: fill }}
                />
              </div>
            </div>
          ))}
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
