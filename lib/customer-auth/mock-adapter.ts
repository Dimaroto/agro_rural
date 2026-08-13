import type {
  CustomerAuthAdapter,
  CustomerAuthProfile,
  LoginInput,
  RegisterInput,
} from "./types";

/** Adapter mock — delega para APIs REST com cookie httpOnly. */
export const mockCustomerAuthAdapter: CustomerAuthAdapter = {
  async register(input: RegisterInput): Promise<CustomerAuthProfile> {
    const res = await fetch("/api/customer/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Erro ao cadastrar");
    return data.customer;
  },

  async login(input: LoginInput): Promise<CustomerAuthProfile> {
    const res = await fetch("/api/customer/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Erro ao entrar");
    return data.customer;
  },

  async logout(): Promise<void> {
    await fetch("/api/customer/logout", { method: "POST" });
  },

  async getSession(): Promise<CustomerAuthProfile | null> {
    const res = await fetch("/api/customer/me");
    if (!res.ok) return null;
    const data = await res.json();
    return data.customer ?? null;
  },
};
