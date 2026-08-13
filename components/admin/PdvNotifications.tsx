"use client";

/**
 * Banner específico do PDV removido do fluxo principal —
 * o checker global `AdminDeviceNotifications` cobre o admin inteiro.
 * Mantido como no-op para não quebrar imports antigos.
 */
export function PdvNotifications() {
  return null;
}
