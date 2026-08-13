import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  getAllowedAdminLogin,
  isAllowedAdminLogin,
  normalizeAdminLogin,
} from "./admin-login";
import { prisma } from "./db";
import { config } from "./config";
import { verifyPasswordWithUpgrade } from "./password-hash";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: config.authSecret,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/admin/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Login", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const loginRaw = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!loginRaw || !password) return null;

        const login = normalizeAdminLogin(loginRaw);
        const allowed = getAllowedAdminLogin();

        // Só a conta admin permitida — ignora qualquer outro User no banco.
        const user =
          login === allowed
            ? await prisma.user.findUnique({
                where: { email: allowed },
                include: { store: true },
              })
            : null;

        const verified = await verifyPasswordWithUpgrade(
          password,
          user?.passwordHash
        );
        if (!user || !verified.valid) return null;

        if (verified.upgradedHash) {
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: verified.upgradedHash },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.store.name,
          storeId: user.storeId,
          storeSlug: user.store.slug,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.storeId = (user as { storeId?: string }).storeId;
        token.storeSlug = (user as { storeSlug?: string }).storeSlug;
        token.email = user.email;
      }

      if (token.email && !isAllowedAdminLogin(String(token.email))) {
        return {};
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.sub || !isAllowedAdminLogin(token.email as string | undefined)) {
        return { ...session, user: undefined };
      }
      if (session.user) {
        session.user.id = token.sub;
        session.user.email = token.email as string;
        (session.user as { storeId?: string }).storeId =
          token.storeId as string;
        (session.user as { storeSlug?: string }).storeSlug =
          token.storeSlug as string;
      }
      return session;
    },
  },
});
