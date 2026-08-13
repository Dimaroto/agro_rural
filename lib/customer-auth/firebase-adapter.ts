import type { CustomerAuthAdapter } from "./types";

/**
 * Stub para integração futura com Firebase Auth + Firestore.
 * Configure CUSTOMER_AUTH_PROVIDER=firebase e implemente com firebase SDK.
 *
 * Variáveis esperadas (.env):
 * - NEXT_PUBLIC_FIREBASE_API_KEY
 * - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 * - NEXT_PUBLIC_FIREBASE_PROJECT_ID
 * - FIREBASE_ADMIN_PROJECT_ID
 * - FIREBASE_ADMIN_CLIENT_EMAIL
 * - FIREBASE_ADMIN_PRIVATE_KEY
 */
export const firebaseCustomerAuthAdapter: CustomerAuthAdapter = {
  async register() {
    throw new Error(
      "Firebase auth ainda não configurado. Use CUSTOMER_AUTH_PROVIDER=mock."
    );
  },
  async login() {
    throw new Error(
      "Firebase auth ainda não configurado. Use CUSTOMER_AUTH_PROVIDER=mock."
    );
  },
  async logout() {
    throw new Error(
      "Firebase auth ainda não configurado. Use CUSTOMER_AUTH_PROVIDER=mock."
    );
  },
  async getSession() {
    return null;
  },
};
