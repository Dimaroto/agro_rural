import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { config } from "@/lib/config";

const PREFIX = "enc:v1:";

function encryptionKey(): Buffer {
  return createHash("sha256")
    .update(`saboart-customer-pii:${config.authSecret}`)
    .digest();
}

/** Cifra campo sensível (AES-256-GCM). Idempotente se já cifrado. */
export function encryptCustomerField(
  plain: string | null | undefined
): string | null {
  if (plain == null) return null;
  const value = plain.trim();
  if (!value) return null;
  if (value.startsWith(PREFIX)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64url")
  );
}

/** Decifra campo; valores legados em texto claro passam direto. */
export function decryptCustomerField(
  value: string | null | undefined
): string | null {
  if (value == null || value === "") return value ?? null;
  if (!value.startsWith(PREFIX)) return value;

  try {
    const raw = Buffer.from(value.slice(PREFIX.length), "base64url");
    if (raw.length < 28) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8"
    );
  } catch {
    return null;
  }
}

export type CustomerPiiFields = {
  name?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  street?: string | null;
  number?: string | null;
  district?: string | null;
  city?: string | null;
  zipCode?: string | null;
  document?: string | null;
  complement?: string | null;
};

export function encryptCustomerPii<T extends CustomerPiiFields>(fields: T): T {
  return {
    ...fields,
    name: encryptCustomerField(fields.name ?? null),
    phone: encryptCustomerField(fields.phone ?? null),
    birthDate: encryptCustomerField(fields.birthDate ?? null),
    street: encryptCustomerField(fields.street ?? null),
    number: encryptCustomerField(fields.number ?? null),
    district: encryptCustomerField(fields.district ?? null),
    city: encryptCustomerField(fields.city ?? null),
    zipCode: encryptCustomerField(fields.zipCode ?? null),
    document: encryptCustomerField(fields.document ?? null),
    complement: encryptCustomerField(fields.complement ?? null),
  };
}

export function decryptCustomerPii<T extends CustomerPiiFields>(fields: T): T {
  return {
    ...fields,
    name: decryptCustomerField(fields.name ?? null),
    phone: decryptCustomerField(fields.phone ?? null),
    birthDate: decryptCustomerField(fields.birthDate ?? null),
    street: decryptCustomerField(fields.street ?? null),
    number: decryptCustomerField(fields.number ?? null),
    district: decryptCustomerField(fields.district ?? null),
    city: decryptCustomerField(fields.city ?? null),
    zipCode: decryptCustomerField(fields.zipCode ?? null),
    document: decryptCustomerField(fields.document ?? null),
    complement: decryptCustomerField(fields.complement ?? null),
  };
}
