export const DEFAULT_BRAND_FROM = "#4A6741";
export const DEFAULT_BRAND_TO = "#C5A059";
export const DEFAULT_PAGE_BG = "#E8F6F0";
export const DEFAULT_PAGE_FG = "#1A2E12";
export const MAX_BRAND_PRESETS = 20;
export const MAX_PRESET_NAME = 40;

export type BrandThemeMode = "solid" | "gradient";
export type BrandThemeShape = "linear" | "radial" | "conic";

export type BrandTheme = {
  mode: BrandThemeMode;
  from: string;
  to: string;
  shape: BrandThemeShape;
  angle: number;
};

export type BrandSurface = BrandTheme & {
  text: string;
};

export type BrandPreset = {
  id: string;
  name: string;
  header: BrandSurface;
  buttons: BrandSurface;
  background: BrandSurface;
};

export type BrandThemeDocument = {
  version: 2;
  activePresetId: string;
  presets: BrandPreset[];
};

export const DEFAULT_BRAND_THEME: BrandTheme = {
  mode: "solid",
  from: DEFAULT_BRAND_FROM,
  to: DEFAULT_BRAND_TO,
  shape: "linear",
  angle: 135,
};

const HEX = /^#([0-9a-fA-F]{6})$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value.trim());
}

function clampAngle(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_BRAND_THEME.angle;
  const wrapped = ((Math.round(n) % 360) + 360) % 360;
  return wrapped;
}

export function parseBrandTheme(raw: unknown): BrandTheme {
  let data: unknown = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_BRAND_THEME };
    }
  }
  if (!data || typeof data !== "object") return { ...DEFAULT_BRAND_THEME };

  const obj = data as Record<string, unknown>;
  const from = isHexColor(obj.from)
    ? obj.from.trim().toUpperCase()
    : DEFAULT_BRAND_FROM;
  const to = isHexColor(obj.to) ? obj.to.trim().toUpperCase() : DEFAULT_BRAND_TO;
  const mode: BrandThemeMode = obj.mode === "gradient" ? "gradient" : "solid";
  const shape: BrandThemeShape =
    obj.shape === "radial" || obj.shape === "conic" ? obj.shape : "linear";

  return {
    mode,
    from,
    to,
    shape,
    angle: clampAngle(obj.angle),
  };
}

export function serializeBrandTheme(theme: BrandTheme): string {
  return JSON.stringify(parseBrandTheme(theme));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = HEX.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x4a6741;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function mixTwo(a: string, b: string, amount: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function brandOnFillColor(theme: BrandTheme): string {
  const t = parseBrandTheme(theme);
  const sample = t.mode === "gradient" ? mixTwo(t.from, t.to, 0.4) : t.from;
  return relativeLuminance(sample) > 0.55 ? "#1A2E12" : "#FFFFFF";
}

export function mixHex(hex: string, amount: number, towards: "black" | "white"): string {
  const { r, g, b } = hexToRgb(hex);
  const t = towards === "white" ? 255 : 0;
  const a = Math.max(0, Math.min(1, amount));
  return rgbToHex(r + (t - r) * a, g + (t - g) * a, b + (t - b) * a);
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function brandFillCss(theme: BrandTheme): string {
  const t = parseBrandTheme(theme);
  if (t.mode === "solid") return t.from;
  if (t.shape === "radial") {
    return `radial-gradient(circle at 50% 40%, ${t.from} 0%, ${t.to} 100%)`;
  }
  if (t.shape === "conic") {
    // Conic com 2 cores puras vira “fatia” dura no header/botões.
    // Suaviza o acento e usa paradas intermediárias para um varredura contínua.
    const soft = mixTwo(t.from, t.to, 0.28);
    const mid = mixTwo(t.from, t.to, 0.48);
    const accent = mixTwo(t.from, t.to, 0.62);
    return [
      `conic-gradient(from ${t.angle}deg at 58% 42%`,
      `${t.from} 0deg`,
      `${soft} 55deg`,
      `${mid} 110deg`,
      `${accent} 155deg`,
      `${mid} 205deg`,
      `${soft} 265deg`,
      `${t.from} 320deg`,
      `${t.from} 360deg)`,
    ].join(", ");
  }
  return `linear-gradient(${t.angle}deg, ${t.from} 0%, ${t.to} 100%)`;
}

export function brandFillHoverCss(theme: BrandTheme): string {
  const t = parseBrandTheme(theme);
  const from = mixHex(t.from, 0.12, "black");
  const to = mixHex(t.to, 0.12, "black");
  if (t.mode === "solid") return from;
  return brandFillCss({ ...t, from, to });
}

export function parseBrandSurface(
  raw: unknown,
  fallback: BrandTheme = DEFAULT_BRAND_THEME
): BrandSurface {
  let data: unknown = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }
  const fill = parseBrandTheme(data && typeof data === "object" ? data : fallback);
  const obj =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const text = isHexColor(obj.text)
    ? obj.text.trim().toUpperCase()
    : brandOnFillColor(fill);
  return { ...fill, text };
}

export function clampPresetName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) return "Sem título";
  return name.slice(0, MAX_PRESET_NAME);
}

export function newBrandPresetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_HEADER_SURFACE: BrandSurface = {
  ...DEFAULT_BRAND_THEME,
  text: "#FFFFFF",
};

export const DEFAULT_BUTTONS_SURFACE: BrandSurface = {
  ...DEFAULT_BRAND_THEME,
  text: "#FFFFFF",
};

export const DEFAULT_BACKGROUND_SURFACE: BrandSurface = {
  mode: "solid",
  from: DEFAULT_PAGE_BG,
  to: "#F4F0E6",
  shape: "linear",
  angle: 180,
  text: DEFAULT_PAGE_FG,
};

export function createDefaultPreset(name = "Padrão"): BrandPreset {
  return {
    id: newBrandPresetId(),
    name: clampPresetName(name),
    header: { ...DEFAULT_HEADER_SURFACE },
    buttons: { ...DEFAULT_BUTTONS_SURFACE },
    background: { ...DEFAULT_BACKGROUND_SURFACE },
  };
}

function presetFromLegacyFill(fill: BrandTheme, name = "Padrão"): BrandPreset {
  const text = brandOnFillColor(fill);
  const surface: BrandSurface = { ...parseBrandTheme(fill), text };
  return {
    id: "padrao",
    name: clampPresetName(name),
    header: { ...surface },
    buttons: { ...surface },
    background: { ...DEFAULT_BACKGROUND_SURFACE },
  };
}

export function parseBrandPreset(raw: unknown): BrandPreset {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id =
    typeof obj.id === "string" && obj.id.trim()
      ? obj.id.trim()
      : newBrandPresetId();
  return {
    id,
    name: clampPresetName(obj.name),
    header: parseBrandSurface(obj.header),
    buttons: parseBrandSurface(obj.buttons),
    background: parseBrandSurface(obj.background, DEFAULT_BACKGROUND_SURFACE),
  };
}

function looksLikeLegacyTheme(obj: Record<string, unknown>): boolean {
  return (
    typeof obj.from === "string" ||
    obj.mode === "solid" ||
    obj.mode === "gradient"
  );
}

function emptyThemeDocument(): BrandThemeDocument {
  const preset = createDefaultPreset("Padrão");
  preset.id = "padrao";
  return { version: 2, activePresetId: "padrao", presets: [preset] };
}

function looksLikeDocument(obj: Record<string, unknown>): boolean {
  return obj.version === 2 || Array.isArray(obj.presets);
}

export function parseBrandThemeDocument(raw: unknown): BrandThemeDocument {
  let data: unknown = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      return emptyThemeDocument();
    }
  }

  if (!data || typeof data !== "object") {
    return emptyThemeDocument();
  }

  const obj = data as Record<string, unknown>;

  if (looksLikeDocument(obj)) {
    const list = Array.isArray(obj.presets) ? obj.presets : [];
    const presets = list
      .slice(0, MAX_BRAND_PRESETS)
      .map((item) => parseBrandPreset(item));
    if (presets.length === 0) {
      return emptyThemeDocument();
    }
    const active =
      typeof obj.activePresetId === "string" &&
      presets.some((p) => p.id === obj.activePresetId)
        ? obj.activePresetId
        : presets[0].id;
    return { version: 2, activePresetId: active, presets };
  }

  if (looksLikeLegacyTheme(obj)) {
    const preset = presetFromLegacyFill(parseBrandTheme(obj));
    return { version: 2, activePresetId: preset.id, presets: [preset] };
  }

  return emptyThemeDocument();
}

export function serializeBrandThemeDocument(doc: BrandThemeDocument): string {
  return JSON.stringify(parseBrandThemeDocument(doc));
}

export function activePreset(doc: BrandThemeDocument): BrandPreset {
  const parsed = parseBrandThemeDocument(doc);
  return (
    parsed.presets.find((p) => p.id === parsed.activePresetId) ??
    parsed.presets[0]
  );
}

export function cloneBrandPreset(
  preset: BrandPreset,
  name = "Sem título"
): BrandPreset {
  const parsed = parseBrandPreset(preset);
  return {
    ...parsed,
    id: newBrandPresetId(),
    name: clampPresetName(name),
    header: { ...parsed.header },
    buttons: { ...parsed.buttons },
    background: { ...parsed.background },
  };
}

export function replacePreset(
  doc: BrandThemeDocument,
  preset: BrandPreset
): BrandThemeDocument {
  const parsed = parseBrandThemeDocument(doc);
  const next = parseBrandPreset(preset);
  const index = parsed.presets.findIndex((p) => p.id === next.id);
  const presets =
    index >= 0
      ? parsed.presets.map((p, i) => (i === index ? next : p))
      : [...parsed.presets, next].slice(0, MAX_BRAND_PRESETS);
  return { ...parsed, presets, activePresetId: next.id };
}

export function presetToCssVars(preset: BrandPreset): Record<string, string> {
  const buttons = parseBrandSurface(preset.buttons);
  const header = parseBrandSurface(preset.header);
  const background = parseBrandSurface(
    preset.background,
    DEFAULT_BACKGROUND_SURFACE
  );
  const primary = buttons.from;
  const dark =
    buttons.mode === "gradient"
      ? mixTwo(buttons.from, buttons.to, 0.72)
      : mixHex(primary, 0.28, "black");
  const light =
    buttons.mode === "gradient"
      ? mixTwo(buttons.from, buttons.to, 0.28)
      : mixHex(primary, 0.35, "white");
  return {
    "--color-primary": primary,
    "--color-primary-dark": dark,
    "--color-primary-light": light,
    "--color-charcoal": mixHex(primary, 0.55, "black"),
    "--brand-fill": brandFillCss(buttons),
    "--brand-fill-hover": brandFillHoverCss(buttons),
    "--brand-on-fill": buttons.text,
    "--brand-shadow": hexToRgba(primary, 0.32),
    "--header-fill": brandFillCss(header),
    "--header-text": header.text,
    "--page-bg": brandFillCss(background),
    "--page-fg": background.text,
  };
}

export function brandThemeToCssVars(theme: BrandTheme): Record<string, string> {
  return presetToCssVars(presetFromLegacyFill(parseBrandTheme(theme)));
}

export const LINEAR_DIRECTIONS: { angle: number; label: string }[] = [
  { angle: 0, label: "Cima" },
  { angle: 45, label: "Cima-direita" },
  { angle: 90, label: "Direita" },
  { angle: 135, label: "Baixo-direita" },
  { angle: 180, label: "Baixo" },
  { angle: 225, label: "Baixo-esquerda" },
  { angle: 270, label: "Esquerda" },
  { angle: 315, label: "Cima-esquerda" },
];

export function applyBrandThemeToDocument(
  theme: BrandTheme | BrandThemeDocument | BrandPreset | string | null
) {
  if (typeof document === "undefined") return;
  const vars = brandThemeStyle(theme);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

export function brandThemeStyle(
  theme: BrandTheme | BrandThemeDocument | BrandPreset | string | null | undefined
) {
  if (!theme) {
    return presetToCssVars(createDefaultPreset());
  }
  if (typeof theme === "string") {
    return presetToCssVars(activePreset(parseBrandThemeDocument(theme)));
  }
  if (typeof theme === "object" && "presets" in theme) {
    return presetToCssVars(activePreset(parseBrandThemeDocument(theme)));
  }
  if (typeof theme === "object" && "header" in theme && "buttons" in theme) {
    return presetToCssVars(parseBrandPreset(theme));
  }
  return presetToCssVars(presetFromLegacyFill(parseBrandTheme(theme)));
}
