import { firebaseCustomerAuthAdapter } from "./firebase-adapter";
import { mockCustomerAuthAdapter } from "./mock-adapter";
import type { CustomerAuthAdapter } from "./types";

export function getCustomerAuthAdapter(): CustomerAuthAdapter {
  const provider = process.env.CUSTOMER_AUTH_PROVIDER ?? "mock";
  if (provider === "firebase") return firebaseCustomerAuthAdapter;
  return mockCustomerAuthAdapter;
}

export * from "./types";
