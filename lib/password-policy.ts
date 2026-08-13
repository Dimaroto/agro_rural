/** Política de senha do cliente (cadastro). */
export const PASSWORD_MIN_LENGTH = 10;

export const PASSWORD_POLICY_HINT =
  "Mínimo 10 caracteres, com pelo menos 1 letra maiúscula e 1 caractere especial.";

const HAS_UPPERCASE = /[A-ZÀ-Ý]/;
const HAS_SPECIAL = /[^A-Za-z0-9À-ÿ]/;

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; message: string };

export function validatePasswordPolicy(
  password: string
): PasswordPolicyResult {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`,
    };
  }
  if (!HAS_UPPERCASE.test(password)) {
    return {
      ok: false,
      message: "A senha deve incluir pelo menos 1 letra maiúscula.",
    };
  }
  if (!HAS_SPECIAL.test(password)) {
    return {
      ok: false,
      message:
        "A senha deve incluir pelo menos 1 caractere especial (ex.: ! @ # $ %).",
    };
  }
  return { ok: true };
}
