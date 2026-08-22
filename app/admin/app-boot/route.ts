import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AGRO_APP_CLIENT_COOKIE,
  AGRO_APP_CLIENT_HEADER,
  parseAgroAppClient,
} from "@/lib/admin-app-client";

/**
 * Apps Electron/Capacitor abrem /admin/app-boot?client=desktop|mobile
 * para gravar o cookie e liberar a UI completa.
 */
export async function GET(req: NextRequest) {
  const client =
    parseAgroAppClient(req.nextUrl.searchParams.get("client")) ??
    parseAgroAppClient(req.headers.get(AGRO_APP_CLIENT_HEADER));

  const dest = new URL("/admin", req.nextUrl.origin);
  const res = NextResponse.redirect(dest);

  if (client) {
    res.cookies.set(AGRO_APP_CLIENT_COOKIE, client, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      secure:
        req.nextUrl.protocol === "https:" ||
        req.headers.get("x-forwarded-proto") === "https",
    });
  }

  return res;
}
