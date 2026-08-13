"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";

type OrderRow = {
  id: string;
  code?: string;
  status: string;
  statusLabel: string;
  totalCents: number;
  totalFormatted: string;
  itemCount: number;
  createdAt: string;
};

export default function MeusPedidosPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/customer/orders")
      .then(async (res) => {
        if (res.status === 401) {
          setError("unauthorized");
          return null;
        }
        if (!res.ok) throw new Error("Erro ao carregar pedidos");
        return res.json();
      })
      .then((data) => {
        if (data?.orders) setOrders(data.orders);
      })
      .catch(() => setError("Erro ao carregar pedidos"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="catalog-page-content flex flex-1 items-center justify-center p-8">
        <p className="text-zinc-600">Carregando pedidos…</p>
      </div>
    );
  }

  if (error === "unauthorized") {
    return (
      <div className="catalog-page-content mx-auto w-full max-w-lg flex-1 px-4 py-10 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-brand-dark">Meus pedidos</h1>
        <p className="mt-3 text-zinc-600">
          Entre na sua conta para ver o histórico de pedidos e endereços salvos.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/conta/login?callbackUrl=%2Fmeus-pedidos"
            className="rounded-xl bg-brand px-6 py-3 font-semibold text-white"
          >
            Entrar
          </Link>
          <Link
            href="/conta/cadastro"
            className="rounded-xl border border-brand px-6 py-3 font-semibold text-brand"
          >
            Criar conta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="catalog-page-content mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold text-brand-dark sm:text-3xl">Meus pedidos</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Acompanhe seus pedidos realizados com login.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-brand/10 bg-white/80 p-8 text-center">
          <p className="text-zinc-600">Você ainda não tem pedidos vinculados à conta.</p>
          <Link href="/" className="mt-4 inline-block text-brand font-medium">
            Ir ao catálogo
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/pedido/${order.id}`}
                className="block rounded-2xl border border-brand/10 bg-white p-4 shadow-sm transition hover:border-brand/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-dark">
                      Pedido {order.code ?? `#${order.id.slice(-8)}`}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {new Date(order.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                      {order.itemCount} {order.itemCount === 1 ? "item" : "itens"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand">
                      {order.totalFormatted ?? formatPrice(order.totalCents)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-zinc-500">
                      {order.statusLabel}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
