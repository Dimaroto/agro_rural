import { signIn } from "@/lib/auth";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import {
  enforceAuthRateLimit,
  RateLimitError,
} from "@/lib/rate-limit";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminLoginFormFields } from "@/components/admin/AdminLoginFormFields";
import { SettingsBar } from "@/components/admin/SettingsBar";

function safeAdminCallback(raw: string | undefined) {
  if (!raw || !raw.startsWith("/admin")) return "/admin";
  if (raw.startsWith("//")) return "/admin";
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeAdminCallback(params.callbackUrl);

  async function loginAction(formData: FormData) {
    "use server";
    const redirectTo = safeAdminCallback(
      String(formData.get("callbackUrl") || "/admin")
    );
    const email = String(formData.get("email") || "");
    const h = await headers();
    try {
      await enforceAuthRateLimit("admin-login", {
        ip: getClientIpFromHeaders(
          h.get("x-forwarded-for"),
          h.get("x-real-ip")
        ),
        email: email || undefined,
      });
    } catch (e) {
      if (e instanceof RateLimitError) {
        redirect(
          `/admin/login?error=rate_limit&callbackUrl=${encodeURIComponent(redirectTo)}`
        );
      }
      throw e;
    }
    try {
      // redirect:false evita NEXT_REDIRECT engolido no server action (hang sem erro).
      const result = await signIn("credentials", {
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        redirect: false,
      });
      if (result?.error) {
        redirect(
          `/admin/login?error=1&callbackUrl=${encodeURIComponent(redirectTo)}`
        );
      }
    } catch (e) {
      if (e instanceof AuthError) {
        redirect(
          `/admin/login?error=1&callbackUrl=${encodeURIComponent(redirectTo)}`
        );
      }
      throw e;
    }
    redirect(redirectTo);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-100 p-4 dark:bg-zinc-950">
      <div className="absolute right-4 top-4">
        <SettingsBar />
      </div>
      <form
        action={loginAction}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900 dark:shadow-none dark:ring-1 dark:ring-zinc-800"
      >
        <h1 className="text-2xl font-bold dark:text-zinc-100">Admin Catálogo</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Acesso restrito à loja
        </p>
        {params.error === "rate_limit" && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            Muitas tentativas de login. Aguarde alguns minutos e tente de novo.
          </p>
        )}
        {params.error === "1" && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            Login ou senha inválidos
          </p>
        )}
        <AdminLoginFormFields callbackUrl={callbackUrl} />
      </form>
    </div>
  );
}
