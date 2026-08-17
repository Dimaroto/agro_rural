export const DEFAULT_BRAND_FROM = "#4A6741";
export const DEFAULT_BRAND_TO = "#C5A059";

export type BrandThemeMode = "solid" | "gradient";
export type BrandThemeShape = "linear" | "radial" | "conic";

export type BrandTheme = {
  mode: BrandThemeMode;
  from: string;
  to: string;
  shape: BrandThemeShape;
  angle: number;
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
    return `conic-gradient(from ${t.angle}deg, ${t.from}, ${t.to}, ${t.from})`;
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

export function brandThemeToCssVars(theme: BrandTheme): Record<string, string> {
  const t = parseBrandTheme(theme);
  const primary = t.from;
  const dark = mixHex(primary, 0.28, "black");
  const light = mixHex(primary, 0.35, "white");
  return {
    "--color-primary": primary,
    "--color-primary-dark": dark,
    "--color-primary-light": light,
    "--color-charcoal": mixHex(primary, 0.55, "black"),
    "--brand-fill": brandFillCss(t),
    "--brand-fill-hover": brandFillHoverCss(t),
    "--brand-shadow": hexToRgba(primary, 0.32),
  };
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

export function applyBrandThemeToDocument(theme: BrandTheme) {
  if (typeof document === "undefined") return;
  const vars = brandThemeToCssVars(theme);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

export function brandThemeStyle(theme: BrandTheme | string | null | undefined) {
  return brandThemeToCssVars(parseBrandTheme(theme ?? null));
}
