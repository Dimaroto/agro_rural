import { cookies, headers } from "next/headers";
import {
  AGRO_APP_CLIENT_COOKIE,
  AGRO_APP_CLIENT_HEADER,
  parseAgroAppClient,
  type AgroAppClient,
} from "@/lib/admin-app-client";

/** Lê se a requisição atual é de app desktop/mobile (cookie ou header). */
export async function getServerAgroAppClient(): Promise<AgroAppClient | null> {
  const h = await headers();
  const fromHeader = parseAgroAppClient(h.get(AGRO_APP_CLIENT_HEADER));
  if (fromHeader) return fromHeader;

  const jar = await cookies();
  return parseAgroAppClient(jar.get(AGRO_APP_CLIENT_COOKIE)?.value);
}
