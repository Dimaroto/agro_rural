"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
  presetToCssVars,
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
  | "cards"
  | "categories"
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
      cards: false,
      categories: false,
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
    key: "header" | "buttons" | "background" | "cards" | "categories",
    partial: Partial<BrandSurface>
  ) {
    setDoc((prev) => {
      const active = activePreset(prev);
      const fallback =
        key === "background"
          ? active.background
          : key === "cards"
            ? active.cards
            : key === "categories"
              ? active.categories
              : active[key];
      const nextSurface = parseBrandSurface(
        { ...active[key], ...partial },
        fallback
      );
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
            ? "mx-auto w-full max-w-[22rem]"
            : "w-full min-w-0"
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
    <div className="theme-studio grid gap-6 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
      <div className="order-1 xl:order-2 xl:sticky xl:top-3 xl:self-start">
        <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-3">
          {previewBlock}
        </div>
      </div>

      <div className="order-2 space-y-3 xl:order-1">
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
            showBorder
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
            showBorder
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
          title="Boxes de produtos"
          hint="Cards de itens na home e no catálogo"
          open={openSections.cards}
          onToggle={() => toggleSection("cards")}
        >
          <SurfaceEditor
            surface={current.cards}
            onChange={(partial) => patchSurface("cards", partial)}
            showBorder
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Boxes de categorias"
          hint="Cards de categorias na home"
          open={openSections.categories}
          onToggle={() => toggleSection("categories")}
        >
          <SurfaceEditor
            surface={current.categories}
            onChange={(partial) => patchSurface("categories", partial)}
            showBorder
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
  showBorder = false,
}: {
  surface: BrandSurface;
  onChange: (partial: Partial<BrandSurface>) => void;
  showBorder?: boolean;
}) {
  const radiusSlider =
    surface.borderRadius >= 999 ? 48 : Math.min(48, surface.borderRadius);

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

      {showBorder ? (
        <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Borda
          </p>
          <ColorRow
            label="Cor da borda"
            value={surface.borderColor}
            onChange={(borderColor) => onChange({ borderColor })}
          />
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="w-24 shrink-0">Espessura</span>
            <input
              type="range"
              min={0}
              max={12}
              value={surface.borderWidth}
              onChange={(e) =>
                onChange({ borderWidth: Number(e.target.value) })
              }
              className="flex-1"
            />
            <span className="w-10 tabular-nums text-right text-xs">
              {surface.borderWidth}px
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="w-24 shrink-0">Arredondar</span>
            <input
              type="range"
              min={0}
              max={48}
              value={radiusSlider}
              onChange={(e) =>
                onChange({ borderRadius: Number(e.target.value) })
              }
              className="flex-1"
            />
            <span className="w-14 tabular-nums text-right text-xs">
              {surface.borderRadius >= 999
                ? "Pílula"
                : `${surface.borderRadius}px`}
            </span>
          </label>
          <button
            type="button"
            onClick={() =>
              onChange({
                borderRadius: surface.borderRadius >= 999 ? 16 : 999,
              })
            }
            className={`w-full rounded-lg border px-2 py-2 text-xs font-medium ${
              surface.borderRadius >= 999
                ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {surface.borderRadius >= 999
              ? "Usar cantos arredondados (sair da pílula)"
              : "Usar formato pílula"}
          </button>
        </div>
      ) : null}

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

/** Prévia em escala do layout real (mesmas CSS vars + proporções do catálogo). */
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
  const isMobile = device === "mobile";
  const stageWidth = isMobile ? 390 : 1180;
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [stageHeight, setStageHeight] = useState(isMobile ? 720 : 860);

  const cssVars = useMemo(
    () => presetToCssVars(preset) as CSSProperties,
    [preset]
  );

  const shownBanner = isMobile
    ? bannerUrlMobile || bannerUrl || null
    : bannerUrl || null;
  const aspectClass = isMobile
    ? HOME_BANNER_MOBILE.aspectClass
    : HOME_BANNER_DESKTOP.aspectClass;

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const sync = () => {
      const next = Math.min(1, viewport.clientWidth / stageWidth);
      setScale(next > 0 ? next : 1);
      if (stageRef.current) {
        setStageHeight(stageRef.current.offsetHeight);
      }
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(viewport);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [stageWidth, shownBanner, isMobile, preset]);

  return (
    <div
      ref={viewportRef}
      className={`relative w-full overflow-hidden border border-zinc-200 bg-zinc-100 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 ${
        isMobile ? "rounded-[1.75rem]" : "rounded-2xl"
      }`}
      style={{ height: Math.max(240, stageHeight * scale) }}
      aria-hidden
    >
      <div
        ref={stageRef}
        className="origin-top-left"
        style={{
          ...cssVars,
          width: stageWidth,
          transform: `scale(${scale})`,
        }}
      >
        {/* Header — mesmas alturas/estrutura do CatalogHeader */}
        {isMobile ? (
          <header
            className="catalog-header"
            style={{
              background: "var(--header-fill)",
              color: "var(--header-text)",
            }}
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="catalog-header__menu-btn" style={{ position: "static" }}>
                <span className="catalog-header__menu-icon" />
              </span>
              <div className="flex min-h-[4.75rem] min-w-0 flex-1 items-center justify-center">
                <BrandLogo size="headerWide" className="!h-[4.5rem] !max-w-[14rem]" />
              </div>
              <span className="catalog-header__icon-btn">
                <PreviewSearchIcon className="catalog-header__icon" />
              </span>
              <span className="catalog-header__cart">
                <PreviewCartIcon className="catalog-header__cart-icon" />
              </span>
            </div>
          </header>
        ) : (
          <header
            className="catalog-header"
            style={{
              background: "var(--header-fill)",
              color: "var(--header-text)",
            }}
          >
            <div
              className="grid items-stretch"
              style={{
                gridTemplateColumns:
                  "minmax(13rem, 17rem) minmax(0, 1fr) minmax(11rem, 15rem)",
                gridTemplateRows: "auto auto",
              }}
            >
              <div
                className="relative flex items-center px-4 py-3"
                style={{ gridRow: "1 / -1" }}
              >
                <BrandLogo
                  size="headerWide"
                  className="!h-full !max-h-[6.5rem] !max-w-full"
                />
              </div>
              <div className="flex min-h-[4.75rem] items-center px-3 py-3">
                <div className="catalog-header__search w-full">
                  <PreviewSearchIcon className="catalog-header__search-icon" />
                  <span className="catalog-header__search-input text-zinc-500">
                    Buscar produtos…
                  </span>
                </div>
              </div>
              <div className="flex min-h-[4.75rem] items-center justify-end gap-3 px-4 py-3">
                <span className="catalog-header__action text-sm font-semibold">
                  Entrar
                </span>
                <span className="catalog-header__cart relative">
                  <PreviewCartIcon className="catalog-header__cart-icon" />
                  <span className="catalog-header__cart-badge">2</span>
                </span>
              </div>
              <div
                className="flex items-center gap-1 px-3 pb-3 pt-1"
                style={{ gridColumn: "2 / 3" }}
              >
                {["Home", "Todos", "Rações", "Insumos", "Ferramentas"].map(
                  (label, i) => (
                    <span
                      key={label}
                      className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
                      style={
                        i === 0
                          ? {
                              background:
                                "color-mix(in srgb, var(--header-text) 22%, transparent)",
                              color: "var(--header-text)",
                            }
                          : {
                              color:
                                "color-mix(in srgb, var(--header-text) 78%, transparent)",
                            }
                      }
                    >
                      {label}
                    </span>
                  )
                )}
              </div>
            </div>
          </header>
        )}

        {/* Corpo — mesmas classes/cores da home real */}
        <div className="catalog-page catalog-page--simple">
          <div className="mx-auto w-full max-w-[var(--catalog-content-max,72rem)] px-[var(--catalog-gutter,1rem)] py-8 sm:py-10">
            {shownBanner ? (
              <section className="home-hero overflow-hidden rounded-3xl border border-brand/25 p-0">
                <div className={`relative w-full overflow-hidden ${aspectClass}`}>
                  <Image
                    src={shownBanner}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              </section>
            ) : (
              <section className="home-hero rounded-3xl border border-brand/25 px-6 py-10 text-center sm:px-10 sm:py-14">
                <p
                  className="text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{ color: "var(--color-primary)" }}
                >
                  Catálogo
                </p>
                <h1
                  className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl"
                  style={{ color: "var(--page-fg)" }}
                >
                  Agrorural Agropecuária
                </h1>
                <p
                  className="mx-auto mt-4 max-w-xl text-sm leading-relaxed sm:text-base"
                  style={{
                    color:
                      "color-mix(in srgb, var(--page-fg) 75%, transparent)",
                  }}
                >
                  Texto de apresentação quando não há banner.
                </p>
                <div className="mt-7 flex justify-center">
                  <span className="home-cta">Ver produtos</span>
                </div>
              </section>
            )}

            <section className="mt-10 sm:mt-12">
              <div className="mb-4 flex items-end justify-between gap-3">
                <h2
                  className="text-xl font-extrabold sm:text-2xl"
                  style={{ color: "var(--page-fg)" }}
                >
                  Últimos lançamentos
                </h2>
                <span
                  className="home-cta text-sm"
                  style={{ padding: "0.4rem 0.9rem", fontSize: "0.8rem" }}
                >
                  Ver todos
                </span>
              </div>
              <div
                className={
                  isMobile
                    ? "grid grid-cols-2 gap-4"
                    : "grid grid-cols-4 gap-5"
                }
              >
                {(isMobile ? [0, 1] : [0, 1, 2, 3]).map((i) => (
                  <div
                    key={i}
                    className="catalog-product-card overflow-hidden shadow-sm"
                  >
                    <div
                      className={
                        isMobile
                          ? "aspect-square bg-[color-mix(in_srgb,var(--catalog-card-fg)_8%,transparent)]"
                          : "aspect-[4/3] bg-[color-mix(in_srgb,var(--catalog-card-fg)_8%,transparent)]"
                      }
                    />
                    <div className="space-y-2 p-3">
                      <div
                        className="h-2.5 w-[90%] rounded"
                        style={{
                          background:
                            "color-mix(in srgb, var(--catalog-card-fg) 28%, transparent)",
                        }}
                      />
                      <div
                        className="h-2.5 w-1/2 rounded"
                        style={{
                          background:
                            "color-mix(in srgb, var(--catalog-card-fg) 18%, transparent)",
                        }}
                      />
                      <div
                        className="mt-2 flex h-9 items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          background: "var(--brand-fill)",
                          color: "var(--brand-on-fill)",
                        }}
                      >
                        Comprar
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-10 sm:mt-12">
              <h2
                className="mb-5 text-xl font-extrabold sm:text-2xl"
                style={{ color: "var(--page-fg)" }}
              >
                Categorias
              </h2>
              <div className="flex gap-3 overflow-hidden">
                {["Rações", "Insumos", "Ferramentas"].map((label) => (
                  <div
                    key={label}
                    className="catalog-category-card w-28 shrink-0 overflow-hidden sm:w-32"
                  >
                    <div className="aspect-square bg-[color-mix(in_srgb,var(--catalog-category-fg)_10%,transparent)]" />
                    <p className="truncate px-2 py-2 text-center text-sm font-bold">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-10 flex justify-center sm:mt-12">
              <span className="home-cta home-cta--large">
                Ver todos os produtos
              </span>
            </div>
          </div>
        </div>

        <footer
          className="catalog-footer"
          style={{
            background: "var(--header-fill)",
            color: "var(--header-text)",
          }}
        >
          <div className="catalog-footer__inner px-4 py-5">
            <div
              className={
                isMobile
                  ? "flex items-start gap-3"
                  : "grid grid-cols-3 gap-6"
              }
            >
              <div>
                <BrandLogo
                  size="header"
                  className="!h-[4.75rem] !max-w-[15rem]"
                />
                <p
                  className="mt-2 max-w-xs text-sm"
                  style={{
                    color:
                      "color-mix(in srgb, var(--header-text) 70%, transparent)",
                  }}
                >
                  Agropecuária e insumos para o campo.
                </p>
              </div>
              {!isMobile ? (
                <>
                  <div>
                    <p className="catalog-footer__label">Navegação</p>
                    <p className="mt-1 opacity-85">Home</p>
                    <p className="opacity-85">Todos</p>
                  </div>
                  <div>
                    <p className="catalog-footer__label">Contato</p>
                    <p className="mt-1 font-semibold">WhatsApp</p>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </footer>
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
