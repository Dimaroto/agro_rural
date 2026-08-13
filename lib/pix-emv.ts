/** Gera payload PIX copia-e-cola (BR Code) com valor fixo. */
function formatEmvField(id: string, value: string): string {
  const size = value.length.toString().padStart(2, "0");
  return `${id}${size}${value}`;
}

function crc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function normalizePixKey(pixKey: string): string {
  const trimmed = pixKey.trim();
  if (trimmed.includes("@")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 11) {
    return `+55${digits}`;
  }
  if (digits.startsWith("55") && digits.length >= 12) {
    return `+${digits}`;
  }
  return trimmed;
}

export function buildPixPayload({
  pixKey,
  merchantName,
  merchantCity,
  amountCents,
  txId = "***",
}: {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amountCents: number;
  txId?: string;
}): string {
  const key = normalizePixKey(pixKey);
  const amount = (amountCents / 100).toFixed(2);
  const name = merchantName.slice(0, 25).toUpperCase();
  const city = merchantCity.slice(0, 15).toUpperCase();

  const merchantAccount = formatEmvField(
    "26",
    formatEmvField("00", "BR.GOV.BCB.PIX") + formatEmvField("01", key)
  );

  const payloadWithoutCrc =
    formatEmvField("00", "01") +
    merchantAccount +
    formatEmvField("52", "0000") +
    formatEmvField("53", "986") +
    formatEmvField("54", amount) +
    formatEmvField("58", "BR") +
    formatEmvField("59", name) +
    formatEmvField("60", city) +
    formatEmvField("62", formatEmvField("05", txId));

  return `${payloadWithoutCrc}6304${crc16Ccitt(payloadWithoutCrc + "6304")}`;
}
