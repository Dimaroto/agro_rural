export type CustomerAuthProfile = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  zipCode: string | null;
};

export type RegisterInput = {
  email: string;
  password: string;
  name: string;
  phone?: string;
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  zipCode?: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export interface CustomerAuthAdapter {
  register(input: RegisterInput): Promise<CustomerAuthProfile>;
  login(input: LoginInput): Promise<CustomerAuthProfile>;
  logout(): Promise<void>;
  getSession(): Promise<CustomerAuthProfile | null>;
}
