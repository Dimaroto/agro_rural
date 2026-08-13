"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { MP_MIN_AMOUNT_CENTS } from "@/lib/payments/mp-amount";

type CardType = "credit" | "debit";

type CardPaymentPayload = {
  token: string;
  paymentMethodId: string;
  installments: number;
  issuerId?: string;
  payerEmail?: string;
  identificationType?: string;
  identificationNumber?: string;
};

type CartCardPaymentProps = {
  amountCents: number;
  publicKey?: string;
  loading?: boolean;
  error?: string;
  onSubmit: (cardPayment: CardPaymentPayload) => Promise<void> | void;
};

type MpField = {
  mount: (id: string) => MpField;
  unmount?: () => void;
  update?: (settings: Record<string, unknown>) => void;
  on: (
    event: string,
    handler: (data: unknown) => void | Promise<void>
  ) => void;
};

type MpPaymentMethod = {
  id: string;
  payment_type_id?: string;
  issuer?: { id?: number | string; name?: string };
  additional_info_needed?: string[];
  settings?: Array<{
    card_number?: Record<string, unknown>;
    security_code?: Record<string, unknown>;
  }>;
};

type MpCardToken = {
  id: string;
  first_six_digits?: string;
  payment_method_id?: string;
  payment_method?: { id?: string };
};

type MpInstance = {
  fields: {
    create: (name: string, options?: Record<string, unknown>) => MpField;
    createCardToken: (params: {
      cardholderName: string;
      identificationType: string;
      identificationNumber: string;
    }) => Promise<MpCardToken>;
  };
  getPaymentMethods: (params: {
    bin: string;
  }) => Promise<{
    results?: MpPaymentMethod[];
  }>;
  getIssuers: (params: {
    paymentMethodId: string;
    bin: string;
  }) => Promise<Array<{ id?: number | string; name?: string }>>;
};

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options?: { locale?: string }
    ) => MpInstance;
  }
}

function loadMpSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.MercadoPago) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-mp-sdk="v2"]'
    );
    if (existing) {
      if (window.MercadoPago) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Falha ao carregar SDK Mercado Pago")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.dataset.mpSdk = "v2";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Falha ao carregar SDK Mercado Pago"));
    document.body.appendChild(script);
  });
}

/**
 * Public Key ≠ Access Token.
 * Access Token: APP_USR-{16 dígitos}-{6 dígitos}-{32 hex}-{userId}
 * Public Key: APP_USR-{uuid} ou TEST-{uuid}
 */
function isAccessTokenShape(key: string) {
  return /^APP_USR-\d{10,}-/.test(key.trim()) || /^TEST-\d{10,}-/.test(key.trim());
}

function isLikelyMpPublicKey(key: string) {
  const k = key.trim();
  if (!/^(APP_USR-|TEST-)/.test(k)) return false;
  // Se parece Access Token, não serve no frontend
  if (isAccessTokenShape(k)) return false;
  return true;
}

function mapPaymentMethodId(methodId: string, cardType: CardType): string {
  const id = methodId.toLowerCase().trim();
  if (cardType === "debit") {
    const debitMap: Record<string, string> = {
      visa: "debvisa",
      master: "debmaster",
      mastercard: "debmaster",
      debvisa: "debvisa",
      debmaster: "debmaster",
      elo: "elo",
      elo_debit: "elo",
      hipercard: "hipercard",
      amex: "amex",
    };
    return debitMap[id] ?? id;
  }
  if (id === "debvisa") return "visa";
  if (id === "debmaster") return "master";
  return id;
}

function pickPaymentMethod(
  results: MpPaymentMethod[] | undefined,
  cardType: CardType
): MpPaymentMethod | null {
  if (!results?.length) return null;
  const wanted = cardType === "debit" ? "debit_card" : "credit_card";
  return results.find((r) => r.payment_type_id === wanted) || results[0] || null;
}

/** Fallback local se a API de bandeiras falhar (BIN conhecido). */
function guessBrandFromBin(bin: string): string | null {
  const digits = bin.replace(/\D/g, "");
  if (digits.length < 4) return null;
  if (/^3[47]/.test(digits)) return "amex";
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "master";
  if (/^(636368|438935|504175|451416|636297|5067|4576|4011|506699)/.test(digits)) {
    return "elo";
  }
  if (/^(606282|3841)/.test(digits)) return "hipercard";
  return null;
}

function extractBinFromEvent(data: unknown): string {
  if (typeof data === "string") return data.replace(/\D/g, "");
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const raw = obj.bin ?? obj.BIN ?? obj.cardBin;
    if (typeof raw === "string" || typeof raw === "number") {
      return String(raw).replace(/\D/g, "");
    }
  }
  return "";
}

function formatMpError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as {
      message?: string;
      cause?: Array<{ description?: string; message?: string }>;
    };
    const cause = obj.cause
      ?.map((c) => c.description || c.message)
      .filter(Boolean)
      .join("; ");
    if (cause) return cause;
    if (obj.message) return obj.message;
  }
  return "Não foi possível validar o cartão. Confira os dados.";
}

const inputClass =
  "mt-1 box-border h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm leading-none text-brand-dark outline-none focus:border-brand";

const secureFieldClass =
  "mp-secure-field mt-1 box-border h-11 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white px-1";

export function CartCardPayment({
  amountCents,
  publicKey: publicKeyProp = "",
  loading,
  error,
  onSubmit,
}: CartCardPaymentProps) {
  const uid = useId().replace(/:/g, "");
  const ids = {
    cardNumber: `mp-num-${uid}`,
    expirationDate: `mp-exp-${uid}`,
    securityCode: `mp-cvv-${uid}`,
    cardholderName: `mp-name-${uid}`,
    identificationNumber: `mp-cpf-${uid}`,
    cardholderEmail: `mp-email-${uid}`,
  };

  const onSubmitRef = useRef(onSubmit);
  const mpRef = useRef<MpInstance | null>(null);
  const fieldsRef = useRef<{
    cardNumber?: MpField;
    expirationDate?: MpField;
    securityCode?: MpField;
  }>({});
  const paymentMethodIdRef = useRef("");
  const issuerIdRef = useRef("");
  const lastBinRef = useRef("");
  const cardTypeRef = useRef<CardType>("credit");
  const submittingRef = useRef(false);

  const [cardType, setCardType] = useState<CardType>("credit");
  const [bootError, setBootError] = useState("");
  const [brandHint, setBrandHint] = useState("");
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const publicKey = publicKeyProp.trim();
  const canUseMp = Boolean(publicKey) && isLikelyMpPublicKey(publicKey);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    cardTypeRef.current = cardType;
  }, [cardType]);

  useEffect(() => {
    if (!canUseMp) {
      setMounted(false);
      setBootError(
        publicKey
          ? isAccessTokenShape(publicKey)
            ? "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY está com o Access Token. No painel do Mercado Pago (Credenciais de produção), copie a Public Key (não o Access Token) e atualize a variável na Vercel."
            : "Public Key inválida. Use a chave APP_USR-… ou TEST-… do painel Mercado Pago (Credenciais → Public Key)."
          : "Falta NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY na Vercel (Public Key do Mercado Pago)."
      );
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setBootError("");
        setMounted(false);
        setBrandHint("");
        paymentMethodIdRef.current = "";
        issuerIdRef.current = "";

        await loadMpSdk();
        if (cancelled || !window.MercadoPago) return;

        await new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r()))
        );
        if (cancelled) return;

        // Limpa containers (evita iframe duplicado em remount)
        for (const id of [
          ids.cardNumber,
          ids.expirationDate,
          ids.securityCode,
        ]) {
          const el = document.getElementById(id);
          if (!el) {
            throw new Error("Campos do cartão ainda não estão no DOM.");
          }
          el.innerHTML = "";
        }

        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        mpRef.current = mp;

        const cardNumber = mp.fields
          .create("cardNumber", { placeholder: "Número do cartão" })
          .mount(ids.cardNumber);
        const expirationDate = mp.fields
          .create("expirationDate", { placeholder: "MM/AA" })
          .mount(ids.expirationDate);
        const securityCode = mp.fields
          .create("securityCode", { placeholder: "CVV" })
          .mount(ids.securityCode);

        fieldsRef.current = { cardNumber, expirationDate, securityCode };

        async function resolveBin(bin: string) {
          const { results } = await mp.getPaymentMethods({ bin });
          const method = pickPaymentMethod(results, cardTypeRef.current);
          if (!method) {
            paymentMethodIdRef.current = "";
            issuerIdRef.current = "";
            setBrandHint("");
            return;
          }

          // Guarda o id cru da API; crédito/débito é mapeado só no pagamento
          paymentMethodIdRef.current = method.id;
          setBrandHint(
            mapPaymentMethodId(method.id, cardTypeRef.current).toUpperCase()
          );

          const settings = method.settings?.[0];
          if (settings?.card_number) {
            cardNumber.update?.({ settings: settings.card_number });
          }
          if (settings?.security_code) {
            securityCode.update?.({ settings: settings.security_code });
          }

          let issuerId =
            method.issuer?.id != null ? String(method.issuer.id) : "";
          if (method.additional_info_needed?.includes("issuer_id")) {
            const issuers = await mp.getIssuers({
              paymentMethodId: method.id,
              bin,
            });
            if (issuers?.[0]?.id != null) {
              issuerId = String(issuers[0].id);
            }
          }
          issuerIdRef.current = issuerId;
        }

        cardNumber.on("binChange", async (data) => {
          if (cancelled) return;
          const bin = extractBinFromEvent(data);
          if (!bin || bin.length < 6) {
            lastBinRef.current = "";
            paymentMethodIdRef.current = "";
            issuerIdRef.current = "";
            setBrandHint("");
            return;
          }

          lastBinRef.current = bin.slice(0, 8);
          try {
            await resolveBin(lastBinRef.current);
          } catch {
            const guessed = guessBrandFromBin(bin);
            if (guessed) {
              paymentMethodIdRef.current = guessed;
              setBrandHint(
                mapPaymentMethodId(guessed, cardTypeRef.current).toUpperCase()
              );
            }
          }
        });

        if (!cancelled) {
          setMounted(true);
          setBootError("");
        }
      } catch (err) {
        if (!cancelled) {
          setBootError(formatMpError(err));
          setMounted(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      const fields = fieldsRef.current;
      try {
        fields.cardNumber?.unmount?.();
        fields.expirationDate?.unmount?.();
        fields.securityCode?.unmount?.();
      } catch {
        /* ignore */
      }
      fieldsRef.current = {};
      mpRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseMp, publicKey, ids.cardNumber, ids.expirationDate, ids.securityCode]);

  // Ao trocar crédito/débito, reconsulta o método pelo BIN já digitado
  useEffect(() => {
    const mp = mpRef.current;
    const bin = lastBinRef.current;
    if (!mp || !bin) {
      if (paymentMethodIdRef.current) {
        setBrandHint(
          mapPaymentMethodId(paymentMethodIdRef.current, cardType).toUpperCase()
        );
      }
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { results } = await mp.getPaymentMethods({ bin });
        if (cancelled) return;
        const method = pickPaymentMethod(results, cardType);
        if (!method) return;
        paymentMethodIdRef.current = method.id;
        setBrandHint(mapPaymentMethodId(method.id, cardType).toUpperCase());
        let issuerId =
          method.issuer?.id != null ? String(method.issuer.id) : "";
        if (method.additional_info_needed?.includes("issuer_id")) {
          const issuers = await mp.getIssuers({
            paymentMethodId: method.id,
            bin,
          });
          if (issuers?.[0]?.id != null) issuerId = String(issuers[0].id);
        }
        issuerIdRef.current = issuerId;
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cardType]);

  async function resolvePaymentMethodId(
    mp: MpInstance,
    token: MpCardToken
  ): Promise<{ paymentMethodId: string; issuerId?: string }> {
    const cardType = cardTypeRef.current;
    const bin =
      token.first_six_digits?.replace(/\D/g, "") ||
      lastBinRef.current ||
      "";

    // 1) Já detectado no digitação
    if (paymentMethodIdRef.current) {
      return {
        paymentMethodId: mapPaymentMethodId(
          paymentMethodIdRef.current,
          cardType
        ),
        issuerId: issuerIdRef.current || undefined,
      };
    }

    // 2) Vem no próprio token
    const fromToken =
      token.payment_method_id ||
      token.payment_method?.id ||
      "";
    if (fromToken) {
      paymentMethodIdRef.current = fromToken;
      return {
        paymentMethodId: mapPaymentMethodId(fromToken, cardType),
        issuerId: issuerIdRef.current || undefined,
      };
    }

    // 3) Consulta API pelo BIN do token
    if (bin.length >= 6) {
      try {
        const { results } = await mp.getPaymentMethods({ bin: bin.slice(0, 8) });
        const method = pickPaymentMethod(results, cardType);
        if (method?.id) {
          paymentMethodIdRef.current = method.id;
          let issuerId =
            method.issuer?.id != null ? String(method.issuer.id) : "";
          if (method.additional_info_needed?.includes("issuer_id")) {
            const issuers = await mp.getIssuers({
              paymentMethodId: method.id,
              bin: bin.slice(0, 8),
            });
            if (issuers?.[0]?.id != null) issuerId = String(issuers[0].id);
          }
          issuerIdRef.current = issuerId;
          return {
            paymentMethodId: mapPaymentMethodId(method.id, cardType),
            issuerId: issuerId || undefined,
          };
        }
      } catch {
        /* cai no fallback local */
      }

      const guessed = guessBrandFromBin(bin);
      if (guessed) {
        paymentMethodIdRef.current = guessed;
        return {
          paymentMethodId: mapPaymentMethodId(guessed, cardType),
          issuerId: issuerIdRef.current || undefined,
        };
      }
    }

    throw new Error(
      "Não foi possível identificar a bandeira do cartão. Confira o número e tente novamente."
    );
  }

  async function handlePayClick() {
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    setSubmitting(true);
    setBootError("");

    try {
      if (amountCents < MP_MIN_AMOUNT_CENTS) {
        throw new Error(
          `Valor mínimo para cartão é ${formatPrice(MP_MIN_AMOUNT_CENTS)}. Este pedido está em ${formatPrice(amountCents)}.`
        );
      }

      const mp = mpRef.current;
      if (!mp) {
        throw new Error(
          "Formulário do cartão ainda carregando. Aguarde e tente novamente."
        );
      }

      const name = (
        document.getElementById(ids.cardholderName) as HTMLInputElement | null
      )?.value?.trim();
      const email = (
        document.getElementById(ids.cardholderEmail) as HTMLInputElement | null
      )?.value?.trim();
      const cpf = (
        document.getElementById(
          ids.identificationNumber
        ) as HTMLInputElement | null
      )?.value?.replace(/\D/g, "");

      if (!name) throw new Error("Informe o nome impresso no cartão.");
      if (!cpf || cpf.length < 11) throw new Error("Informe um CPF válido.");
      if (!email || !email.includes("@")) {
        throw new Error("Informe um e-mail válido.");
      }

      // Token primeiro — não depende da bandeira já detectada
      const tokenResult = await mp.fields.createCardToken({
        cardholderName: name,
        identificationType: "CPF",
        identificationNumber: cpf,
      });

      if (!tokenResult?.id) {
        throw new Error(
          "Não foi possível gerar o token do cartão. Confira número, validade e CVV."
        );
      }

      if (tokenResult.first_six_digits) {
        lastBinRef.current = tokenResult.first_six_digits.replace(/\D/g, "");
      }

      const { paymentMethodId, issuerId } = await resolvePaymentMethodId(
        mp,
        tokenResult
      );
      setBrandHint(paymentMethodId.toUpperCase());

      await onSubmitRef.current({
        token: tokenResult.id,
        paymentMethodId,
        installments: 1,
        issuerId,
        payerEmail: email,
        identificationType: "CPF",
        identificationNumber: cpf,
      });
    } catch (err) {
      setBootError(formatMpError(err));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const busy = Boolean(loading || submitting);

  return (
    <div className="relative z-20 space-y-3 rounded-xl border border-brand/15 bg-white px-4 py-4 shadow-sm">
      <p className="text-sm font-semibold text-brand-dark">Pagar com cartão</p>
      <p className="text-sm text-[#3d7a62]">
        Total:{" "}
        <span className="font-bold text-brand-dark">
          {formatPrice(amountCents)}
        </span>
        <span className="text-[#6B7280]"> · à vista (1x)</span>
      </p>

      {amountCents > 0 && amountCents < MP_MIN_AMOUNT_CENTS ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Valor mínimo para cartão no Mercado Pago é{" "}
          {formatPrice(MP_MIN_AMOUNT_CENTS)}. Ajuste o pedido ou use PIX/dinheiro.
        </p>
      ) : null}

      {!canUseMp ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {bootError ||
            "Configure NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY na Vercel e faça redeploy."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCardType("credit")}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                cardType === "credit"
                  ? "border-brand bg-brand/10 text-brand-dark"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
              }`}
            >
              Crédito
            </button>
            <button
              type="button"
              onClick={() => setCardType("debit")}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                cardType === "debit"
                  ? "border-brand bg-brand/10 text-brand-dark"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
              }`}
            >
              Débito
            </button>
          </div>

          <div className="space-y-3">
            <style>{`
              .mp-secure-field {
                display: flex;
                align-items: center;
                position: relative;
                z-index: 1;
              }
              .mp-secure-field iframe {
                width: 100% !important;
                height: 40px !important;
                max-height: 40px !important;
                min-height: 0 !important;
                border: 0 !important;
              }
            `}</style>

            {!mounted && !bootError && (
              <p className="text-xs text-[#6B7280]">
                Preparando campos seguros…
              </p>
            )}

            <div>
              <label className="text-xs font-medium text-zinc-700">
                Número do cartão
                {brandHint ? (
                  <span className="ml-1 font-normal text-[#6B7280]">
                    ({brandHint})
                  </span>
                ) : null}
              </label>
              <div id={ids.cardNumber} className={secureFieldClass} />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700">
                Nome no cartão
              </label>
              <input
                id={ids.cardholderName}
                className={inputClass}
                autoComplete="cc-name"
                placeholder="Nome impresso no cartão"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-zinc-700">
                  Validade
                </label>
                <div id={ids.expirationDate} className={secureFieldClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">CVV</label>
                <div id={ids.securityCode} className={secureFieldClass} />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700">CPF</label>
              <input
                id={ids.identificationNumber}
                className={inputClass}
                inputMode="numeric"
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700">E-mail</label>
              <input
                id={ids.cardholderEmail}
                type="email"
                className={inputClass}
                autoComplete="email"
                placeholder="seu@email.com"
              />
            </div>

            <button
              type="button"
              onClick={() => void handlePayClick()}
              className="relative z-30 w-full cursor-pointer rounded-2xl bg-brand-dark py-3 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(15,35,28,0.18)] transition-opacity hover:opacity-95 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
              disabled={busy || !mounted || amountCents < MP_MIN_AMOUNT_CENTS}
            >
              {busy
                ? "Processando…"
                : !mounted
                  ? "Carregando…"
                  : cardType === "debit"
                    ? "Pagar no débito"
                    : "Pagar no crédito"}
            </button>
          </div>
        </>
      )}

      {(bootError || error) && canUseMp && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error || bootError}
        </p>
      )}
    </div>
  );
}
