import {
  getDummyPasswordHash,
  verifyPasswordWithUpgrade,
  type PasswordVerification,
} from "@/lib/password-hash";

/** Resposta genérica — não revela se o e-mail existe. */
export const CUSTOMER_LOGIN_ERROR = "E-mail ou senha incorretos.";

/** Resposta genérica — não revela e-mail duplicado nem detalhes de validação. */
export const CUSTOMER_REGISTER_ERROR =
  "Não foi possível concluir o cadastro. Verifique os dados ou faça login se já possui conta.";

export async function customerPasswordMatches(
  password: string,
  passwordHash: string | null | undefined
): Promise<boolean> {
  const result = await verifyPasswordWithUpgrade(password, passwordHash);
  return result.valid;
}

export async function verifyCustomerPassword(
  password: string,
  passwordHash: string | null | undefined
): Promise<PasswordVerification> {
  if (!passwordHash) {
    await verifyPasswordWithUpgrade(password, getDummyPasswordHash());
    return { valid: false };
  }
  return verifyPasswordWithUpgrade(password, passwordHash);
}
