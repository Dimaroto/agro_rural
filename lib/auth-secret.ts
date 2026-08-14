/**
 * Secret do Auth.js — precisa ser o mesmo no Node (NextAuth) e no Edge (middleware).
 * Sem imports Node-only, para o middleware poder usar.
 */
export function resolveAuthSecret(): string {
  const fromEnv =
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const isNextBuild = process.env.NEXT_PHASE === "phase-production-build";
  if (process.env.NODE_ENV !== "production" || isNextBuild) {
    return "dev-secret-change-in-production";
  }

  const projectId = process.env.VERCEL_PROJECT_ID?.trim() || "";
  const databaseUrl = process.env.DATABASE_URL?.trim() || "";
  if (projectId || databaseUrl) {
    return `agrorural-auth-fallback:${projectId}:${databaseUrl}`;
  }

  throw new Error(
    "AUTH_SECRET é obrigatório em produção. Defina uma string aleatória longa nas variáveis de ambiente."
  );
}
