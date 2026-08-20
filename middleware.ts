import { CUSTOMER_SESSION_COOKIE } from "@/lib/session-cookies";
import { isValidCustomerSessionCookie } from "@/lib/customer-session-token";
import { isAllowedAdminLogin } from "@/lib/admin-login";
import { resolveAuthSecret } from "@/lib/auth-secret";
import {
  AGRO_APP_CLIENT_COOKIE,
  AGRO_APP_CLIENT_HEADER,
  isAdminWebAllowedPath,
  parseAgroAppClient,
} from "@/lib/admin-app-client";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { JWT } from "next-auth/jwt";

/** Em HTTPS o Auth.js usa `__Secure-authjs.session-token`; sem secureCookie o getToken não acha a sessão. */
async function getAdminJwt(req: NextRequest): Promise<JWT | null> {
  const secret = resolveAuthSecret();
  if (!secret) return null;

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const isHttps =
    req.nextUrl.protocol === "https:" || forwardedProto === "https";

  const primary = await getToken({
    req,
    secret,
    secureCookie: isHttps,
  });
  if (primary?.sub) return primary;

  const fallback = await getToken({
    req,
    secret,
    secureCookie: !isHttps,
  });
  return fallback?.sub ? fallback : null;
}

/** Só a conta admin allowlisted conta como autenticada no /admin. */
function isAllowedAdminSession(jwt: JWT | null): boolean {
  if (!jwt?.sub) return false;
  if (typeof jwt.email === "string" && jwt.email) {
    return isAllowedAdminLogin(jwt.email);
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isLogin = pathname === "/admin/login";

  if (isAdminRoute) {
    const jwt = await getAdminJwt(req);
    const authenticated = isAllowedAdminSession(jwt);

    if (!isLogin && !authenticated) {
      const login = new URL("/admin/login", req.nextUrl.origin);
      login.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(login);
    }

    if (isLogin && authenticated) {
      const callback = req.nextUrl.searchParams.get("callbackUrl");
      const target =
        callback?.startsWith("/admin") && !callback.startsWith("//")
          ? callback
          : "/admin";
      return NextResponse.redirect(new URL(target, req.nextUrl.origin));
    }

    // Browser: só portal de download + login. Apps: cookie/header liberam o restante.
    if (authenticated && !isLogin) {
      const appClient =
        parseAgroAppClient(req.headers.get(AGRO_APP_CLIENT_HEADER)) ??
        parseAgroAppClient(req.cookies.get(AGRO_APP_CLIENT_COOKIE)?.value) ??
        parseAgroAppClient(req.nextUrl.searchParams.get("app"));

      if (
        !appClient &&
        !isAdminWebAllowedPath(pathname) &&
        !pathname.startsWith("/admin/app-boot")
      ) {
        return NextResponse.redirect(new URL("/admin", req.nextUrl.origin));
      }

      if (appClient && req.nextUrl.searchParams.get("app")) {
        const clean = new URL(pathname, req.nextUrl.origin);
        req.nextUrl.searchParams.forEach((v, k) => {
          if (k !== "app") clean.searchParams.set(k, v);
        });
        const res = NextResponse.redirect(clean);
        res.cookies.set(AGRO_APP_CLIENT_COOKIE, appClient, {
          path: "/",
          httpOnly: false,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365,
          secure:
            req.nextUrl.protocol === "https:" ||
            req.headers.get("x-forwarded-proto") === "https",
        });
        return res;
      }
    }
  }

  if (
    pathname === "/meus-pedidos" &&
    !(await isValidCustomerSessionCookie(
      req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value
    ))
  ) {
    const login = new URL("/conta/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/meus-pedidos"],
};
