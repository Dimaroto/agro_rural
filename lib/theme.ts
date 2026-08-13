export type Theme = "light" | "dark";

export const THEME_COOKIE = "theme";

export function parseTheme(value: string | undefined): Theme | null {
  if (value === "dark" || value === "light") return value;
  return null;
}

export function persistTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_COOKIE, theme);
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}

export function resolveClientTheme(stored: string | null): Theme {
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
