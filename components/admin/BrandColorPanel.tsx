"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatApiError } from "@/lib/apiError";
import {
  DEFAULT_BRAND_THEME,
  LINEAR_DIRECTIONS,
  applyBrandThemeToDocument,
  brandFillCss,
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
        Cor principal do catálogo e do admin. Degradê vale nos botões.
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

      <div
        className="mt-3 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700"
        style={{ background: previewFill }}
        title="Prévia"
      />
      <button
        type="button"
        className="admin-btn-primary mt-2 w-full"
        style={{ background: previewFill }}
      >
        Botão de exemplo
      </button>

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
          className="flex-1 rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: previewFill }}
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
