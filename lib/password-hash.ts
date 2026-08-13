import bcrypt from "bcryptjs";

export const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function bcryptCost(passwordHash: string): number | null {
  const match = passwordHash.match(/^\$2[aby]?\$(\d{2})\$/);
  if (!match) return null;
  const cost = Number(match[1]);
  return Number.isFinite(cost) ? cost : null;
}

export type PasswordVerification = {
  valid: boolean;
  upgradedHash?: string;
};

/** Valida senha e devolve hash novo se o custo bcrypt estiver abaixo do atual. */
export async function verifyPasswordWithUpgrade(
  password: string,
  passwordHash: string | null | undefined
): Promise<PasswordVerification> {
  if (!passwordHash) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    return { valid: false };
  }

  const valid = await bcrypt.compare(password, passwordHash);
  if (!valid) return { valid: false };

  const cost = bcryptCost(passwordHash);
  if (cost !== null && cost < BCRYPT_ROUNDS) {
    return { valid: true, upgradedHash: await hashPassword(password) };
  }

  return { valid: true };
}

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "__password_timing_placeholder__",
  BCRYPT_ROUNDS
);

export function getDummyPasswordHash(): string {
  return DUMMY_PASSWORD_HASH;
}
