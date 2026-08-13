"use client";

import { useEffect, useState } from "react";

type PixQrCodeProps = {
  amountCents: number;
  pixKey: string;
};

export function PixQrCode({ amountCents, pixKey }: PixQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [payload, setPayload] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setPayload(null);
    setError("");

    const params = new URLSearchParams({
      amountCents: String(amountCents),
      pixKey,
    });

    fetch(`/api/pix-qr?${params}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao gerar QR Code.");
        if (!cancelled) {
          setDataUrl(data.dataUrl);
          setPayload(data.payload);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [amountCents, pixKey]);

  async function copyPayload() {
    if (!payload) return;
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (error) {
    return <p className="cart-checkout__pix-error text-xs text-red-600">{error}</p>;
  }

  if (!dataUrl) {
    return (
      <p className="cart-checkout__pix-loading text-xs text-[#6B7280]">
        Gerando QR Code PIX…
      </p>
    );
  }

  return (
    <div className="cart-checkout__pix space-y-2">
      <img
        src={dataUrl}
        alt="QR Code PIX"
        width={220}
        height={220}
        className="mx-auto rounded-xl border border-brand/15 bg-white p-2"
      />
      <p className="text-center text-[11px] text-[#6B7280]">
        Escaneie para pagar o valor do pedido.
      </p>
      {payload && (
        <button
          type="button"
          onClick={copyPayload}
          className="w-full rounded-xl border border-brand/20 bg-white/80 px-3 py-2 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-light/30"
        >
          {copied ? "Código copiado!" : "Copiar PIX copia e cola"}
        </button>
      )}
    </div>
  );
}
