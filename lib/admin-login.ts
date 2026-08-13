/** Normaliza CPF/login do admin (apenas dígitos quando parecer documento). */
export function normalizeAdminLogin(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11) return digits;
  return trimmed;
}

/** Único login autorizado no painel admin (override via ADMIN_LOGIN). */
export const DEFAULT_ADMIN_LOGIN = "02371501905";

/** Login do único admin permitido. Contas Customer nunca autenticam aqui. */
export function getAllowedAdminLogin(): string {
  return normalizeAdminLogin(
    process.env.ADMIN_LOGIN?.trim() || DEFAULT_ADMIN_LOGIN
  );
}

export function isAllowedAdminLogin(value: string | null | undefined): boolean {
  if (!value) return false;
  return normalizeAdminLogin(value) === getAllowedAdminLogin();
}
