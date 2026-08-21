"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BrandLogo } from "@/components/BrandLogo";
import { formatApiError } from "@/lib/apiError";
import { useUnsavedChangesOptional } from "@/components/admin/UnsavedChangesContext";
import { BannerImageField } from "@/components/admin/BannerImageField";
import {
  HOME_BANNER_DESKTOP,
  HOME_BANNER_MOBILE,
} from "@/lib/home-banner";
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

type PreviewDevice = "desktop" | "mobile";
type StudioSection =
  | "preset"
  | "header"
  | "buttons"
  | "background"
  | "banners";

type ThemeStudioProps = {
  initialTheme?: string | BrandThemeDocument | null;
  initialBannerUrl?: string | null;
  initialBannerUrlMobile?: string | null;
};

export function ThemeStudio({
  initialTheme,
  initialBannerUrl = null,
  initialBannerUrlMobile = null,
}: ThemeStudioProps) {
  const router = useRouter();
  const unsaved = useUnsavedChangesOptional();
  const [saved, setSaved] = useState(() =>
    parseBrandThemeDocument(initialTheme ?? null)
  );
  const [doc, setDoc] = useState(saved);
  const [bannerUrl, setBannerUrl] = useState<string | null>(
    initialBannerUrl ?? null
  );
  const [bannerUrlMobile, setBannerUrlMobile] = useState<string | null>(
    initialBannerUrlMobile ?? null
  );
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [openSections, setOpenSections] = useState<Record<StudioSection, boolean>>(
    {
      preset: true,
      header: false,
      buttons: false,
      background: false,
      banners: true,
    }
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const next = parseBrandThemeDocument(initialTheme ?? null);
    setSaved(next);
    setDoc(next);
  }, [initialTheme]);

  useEffect(() => {
    setBannerUrl(initialBannerUrl ?? null);
  }, [initialBannerUrl]);

  useEffect(() => {
    setBannerUrlMobile(initialBannerUrlMobile ?? null);
  }, [initialBannerUrlMobile]);

  const current = activePreset(doc);
  const isDirty = useMemo(
    () => JSON.stringify(doc) !== JSON.stringify(saved),
    [doc, saved]
  );

  function toggleSection(id: StudioSection) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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

  const previewBlock = (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Prévia do catálogo
        </p>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 p-0.5 dark:border-zinc-700">
          {(
            [
              ["desktop", "Computador"],
              ["mobile", "Celular"],
            ] as [PreviewDevice, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPreviewDevice(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                previewDevice === id
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        className={
          previewDevice === "mobile"
            ? "mx-auto w-full max-w-[24rem]"
            : "w-full"
        }
      >
        <CatalogPagePreview
          preset={current}
          bannerUrl={bannerUrl}
          bannerUrlMobile={bannerUrlMobile}
          device={previewDevice}
        />
      </div>
    </div>
  );

  return (
    <div className="theme-studio grid gap-6 lg:grid-cols-[minmax(18rem,24rem)_1fr]">
      <div className="order-1 lg:order-2 lg:sticky lg:top-3 lg:self-start">
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-4">
          {previewBlock}
        </div>
      </div>

      <div className="order-2 space-y-3 lg:order-1">
        <CollapsibleSection
          title="Predefinição"
          open={openSections.preset}
          onToggle={() => toggleSection("preset")}
        >
          <div className="flex gap-2">
            <select
              value={current.id}
              onChange={(e) => selectPreset(e.target.value)}
              className="admin-input flex-1 py-2.5 text-sm"
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
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Nova
            </button>
          </div>
          <label className="mt-3 block text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Nome
            <input
              type="text"
              maxLength={40}
              value={current.name}
              onChange={(e) => patchPreset({ name: e.target.value })}
              className="admin-input mt-1.5 w-full py-2.5 text-sm"
              placeholder="Ex: Oliva clássico"
            />
          </label>
          {error ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          {msg ? (
            <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
              {msg}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="flex-1 rounded-lg py-3 text-sm font-medium disabled:opacity-50"
              style={{
                background: brandFillCss(current.buttons),
                color: current.buttons.text,
              }}
            >
              {saving ? "Salvando..." : "Salvar predefinição"}
            </button>
            {doc.presets.length > 1 ? (
              <button
                type="button"
                onClick={deletePreset}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Excluir
              </button>
            ) : null}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Header"
          hint="Barra do topo e rodapé"
          open={openSections.header}
          onToggle={() => toggleSection("header")}
        >
          <SurfaceEditor
            surface={current.header}
            onChange={(partial) => patchSurface("header", partial)}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Botões"
          hint="Comprar, filtros e CTAs"
          open={openSections.buttons}
          onToggle={() => toggleSection("buttons")}
        >
          <SurfaceEditor
            surface={current.buttons}
            onChange={(partial) => patchSurface("buttons", partial)}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Fundo do site"
          hint="Área atrás dos produtos"
          open={openSections.background}
          onToggle={() => toggleSection("background")}
        >
          <SurfaceEditor
            surface={current.background}
            onChange={(partial) => patchSurface("background", partial)}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Banners"
          hint="Imagens da home — computador e celular"
          open={openSections.banners}
          onToggle={() => toggleSection("banners")}
        >
          <div className="space-y-6">
            <BannerImageField
              variant="desktop"
              currentUrl={bannerUrl}
              onSaved={(url) => {
                setBannerUrl(url);
                router.refresh();
              }}
            />
            <BannerImageField
              variant="mobile"
              currentUrl={bannerUrlMobile}
              onSaved={(url) => {
                setBannerUrlMobile(url);
                router.refresh();
              }}
            />
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </span>
          {hint ? (
            <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
              {hint}
            </span>
          ) : null}
        </span>
        <span
          className={`text-zinc-400 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? (
        <div className="border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function SurfaceEditor({
  surface,
  onChange,
}: {
  surface: BrandSurface;
  onChange: (partial: Partial<BrandSurface>) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
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
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Forma
          </p>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
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
                className={`rounded-lg border px-2 py-2 text-xs font-medium ${
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
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Direção
              </p>
              <div className="mt-1 grid grid-cols-4 gap-1.5">
                {LINEAR_DIRECTIONS.map((d) => (
                  <button
                    key={d.angle}
                    type="button"
                    title={d.label}
                    onClick={() => onChange({ angle: d.angle })}
                    className={`rounded-lg border px-1 py-2 text-xs font-medium ${
                      surface.angle === d.angle
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40"
                        : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                    }`}
                  >
                    {d.angle}°
                  </button>
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                Ângulo
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={surface.angle}
                  onChange={(e) => onChange({ angle: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="w-8 tabular-nums text-xs">{surface.angle}°</span>
              </label>
            </>
          )}
        </>
      )}
    </div>
  );
}

function PreviewMenuIcon({ color }: { color: string }) {
  return (
    <span className="flex h-4 w-4 flex-col justify-center gap-[3px]" aria-hidden>
      <span className="h-px w-full rounded" style={{ background: color }} />
      <span className="h-px w-full rounded" style={{ background: color }} />
      <span className="h-px w-full rounded" style={{ background: color }} />
    </span>
  );
}

function PreviewSearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function PreviewCartIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden
    >
      <path
        d="M6.5 8h11l-1 10.5a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5L6.5 8Z"
        strokeLinejoin="round"
      />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" strokeLinecap="round" />
    </svg>
  );
}

function CatalogPagePreview({
  preset,
  bannerUrl,
  bannerUrlMobile,
  device,
}: {
  preset: BrandPreset;
  bannerUrl?: string | null;
  bannerUrlMobile?: string | null;
  device: PreviewDevice;
}) {
  const headerFill = brandFillCss(preset.header);
  const headerText = preset.header.text;
  const pageBg = brandFillCss(preset.background);
  const pageFg = preset.background.text;
  const btnFill = brandFillCss(preset.buttons);
  const btnText = preset.buttons.text;
  const isLightHeaderText =
    headerText === "#FFFFFF" || headerText === "#ffffff";
  const muted = isLightHeaderText
    ? "rgba(255,255,255,0.78)"
    : "rgba(26,46,18,0.7)";
  const pillBg = isLightHeaderText
    ? "rgba(255,255,255,0.22)"
    : "rgba(26,46,18,0.14)";
  const divider = isLightHeaderText
    ? "rgba(255,255,255,0.28)"
    : "rgba(26,46,18,0.18)";
  const navBorder = isLightHeaderText
    ? "rgba(255,255,255,0.16)"
    : "rgba(26,46,18,0.12)";

  const isMobile = device === "mobile";
  const shownBanner = isMobile
    ? bannerUrlMobile || bannerUrl || null
    : bannerUrl || null;
  const aspectClass = isMobile
    ? HOME_BANNER_MOBILE.aspectClass
    : HOME_BANNER_DESKTOP.aspectClass;
  const navLabels = ["Home", "Todos", "Rações", "Insumos", "Ferramentas"];

  return (
    <div
      className={`overflow-hidden border border-zinc-200 shadow-sm dark:border-zinc-700 ${
        isMobile ? "rounded-[1.75rem]" : "rounded-2xl"
      }`}
      aria-hidden
    >
      {/* Header — espelha CatalogHeader (logo real + busca + ações + nav) */}
      <div style={{ background: headerFill, color: headerText }}>
        {isMobile ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: pillBg }}
            >
              <PreviewMenuIcon color={headerText} />
            </span>
            <div className="flex min-h-[2.75rem] min-w-0 flex-1 items-center justify-center px-1">
              <BrandLogo
                size="header"
                className="!h-10 !max-w-[min(100%,11rem)]"
              />
            </div>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: pillBg }}
            >
              <PreviewSearchIcon className="h-3.5 w-3.5 opacity-90" />
            </span>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: pillBg }}
            >
              <PreviewCartIcon className="h-3.5 w-3.5 opacity-90" />
            </span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[minmax(7.5rem,9.5rem)_minmax(0,1fr)_auto] items-stretch gap-0">
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="flex min-h-[3.25rem] min-w-0 flex-1 items-center">
                  <BrandLogo
                    size="headerWide"
                    className="!h-[3.1rem] !max-h-full !max-w-full sm:!h-[3.4rem]"
                  />
                </div>
                <span
                  className="hidden h-10 w-px shrink-0 sm:block"
                  style={{ background: divider }}
                />
              </div>
              <div className="flex min-w-0 items-center px-1 py-2 sm:px-2">
                <div className="flex h-9 w-full items-center gap-2 rounded-full bg-white px-3 text-zinc-400 shadow-sm">
                  <PreviewSearchIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate text-[10px] sm:text-[11px]">
                    Buscar produtos…
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3">
                <span
                  className="hidden text-[10px] font-semibold sm:inline"
                  style={{ color: muted }}
                >
                  Entrar
                </span>
                <span
                  className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: pillBg }}
                >
                  <PreviewCartIcon className="h-3.5 w-3.5" />
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] font-bold leading-none"
                    style={{ background: headerText, color: headerFill }}
                  >
                    2
                  </span>
                </span>
              </div>
            </div>
            <div
              className="flex items-center gap-1 overflow-x-auto px-3 py-1.5"
              style={{ borderTop: `1px solid ${navBorder}` }}
            >
              {navLabels.map((label, i) => (
                <span
                  key={label}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none ${
                    i === 0 ? "" : "font-medium"
                  }`}
                  style={
                    i === 0
                      ? { background: pillBg, color: headerText }
                      : { color: muted }
                  }
                >
                  {label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Corpo — home: banner + lançamentos + categorias + CTA */}
      <div
        className="space-y-4 px-3 py-4 sm:px-4"
        style={{ background: pageBg, color: pageFg }}
      >
        {shownBanner ? (
          <div
            className={`relative w-full overflow-hidden rounded-3xl border border-black/10 ${aspectClass}`}
          >
            <Image
              src={shownBanner}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-black/15 px-4 py-8 text-center sm:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-55">
              Sem banner {isMobile ? "celular" : "computador"}
            </p>
            <p className="mt-2 text-sm font-extrabold tracking-tight opacity-90 sm:text-base">
              Agrorural Agropecuária
            </p>
            <p className="mx-auto mt-2 max-w-[16rem] text-[10px] leading-relaxed opacity-55 sm:text-[11px]">
              Texto de apresentação aparece aqui quando não há imagem de capa.
            </p>
            <div
              className="mx-auto mt-4 h-8 w-28 rounded-full text-center text-[10px] font-bold leading-8"
              style={{ background: btnFill, color: btnText }}
            >
              Ver produtos
            </div>
          </div>
        )}

        <div>
          <div className="mb-2.5 flex items-end justify-between gap-2">
            <p className="text-xs font-extrabold tracking-tight sm:text-sm">
              Últimos lançamentos
            </p>
            <span className="text-[10px] font-semibold opacity-55">Ver todos</span>
          </div>
          <div
            className={
              isMobile ? "grid grid-cols-2 gap-2.5" : "grid grid-cols-3 gap-2.5 sm:grid-cols-4"
            }
          >
            {(isMobile ? [0, 1] : [0, 1, 2, 3]).map((i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-black/8 bg-white/70 shadow-sm"
              >
                <div
                  className={
                    isMobile ? "aspect-square bg-zinc-200/70" : "aspect-[4/3] bg-zinc-200/70"
                  }
                />
                <div className="space-y-1.5 p-2">
                  <div className="h-2 w-[88%] rounded bg-zinc-300/80" />
                  <div className="h-2 w-1/2 rounded bg-zinc-300/55" />
                  <div
                    className="mt-1 h-7 w-full rounded-full text-center text-[10px] font-semibold leading-7"
                    style={{ background: btnFill, color: btnText }}
                  >
                    Comprar
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-xs font-extrabold tracking-tight sm:text-sm">
            Categorias
          </p>
          <div className="flex gap-2 overflow-hidden">
            {["Rações", "Insumos", "Ferramentas"].map((label) => (
              <div
                key={label}
                className="w-[4.75rem] shrink-0 overflow-hidden rounded-xl border border-black/8 bg-white/70 sm:w-24"
              >
                <div className="aspect-square bg-zinc-200/65" />
                <p className="truncate px-1.5 py-1.5 text-center text-[9px] font-semibold">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center pt-1">
          <div
            className="h-9 min-w-[10.5rem] rounded-full px-5 text-center text-[11px] font-bold leading-9"
            style={{ background: btnFill, color: btnText }}
          >
            Ver todos os produtos
          </div>
        </div>
      </div>

      {/* Rodapé — logo real como no CatalogFooter */}
      <div
        className={`gap-3 px-3 py-3 text-[10px] leading-tight ${
          isMobile ? "grid grid-cols-1" : "grid grid-cols-3"
        }`}
        style={{ background: headerFill, color: headerText }}
      >
        <div className={isMobile ? "flex items-start gap-3" : ""}>
          <BrandLogo
            size="header"
            className={
              isMobile
                ? "!h-11 !max-w-[8.5rem]"
                : "!h-12 !max-w-[9.5rem] sm:!h-[3.25rem]"
            }
          />
          <p className={`mt-1.5 max-w-[12rem] opacity-70 ${isMobile ? "mt-0" : ""}`}>
            Agropecuária e insumos para o campo.
          </p>
        </div>
        {!isMobile ? (
          <>
            <div>
              <p className="font-bold uppercase tracking-wide opacity-85">
                Navegação
              </p>
              <p className="mt-1 opacity-80">Home</p>
              <p className="opacity-80">Todos</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wide opacity-85">
                Contato
              </p>
              <p className="mt-1 font-semibold">WhatsApp</p>
            </div>
          </>
        ) : null}
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
