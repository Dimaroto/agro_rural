"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatApiError } from "@/lib/apiError";
type DeleteProductButtonProps = {
  productId: string;
  productName: string;
  redirectTo?: string;
  className?: string;
  compact?: boolean;
};

export function DeleteProductButton({
  productId,
  productName,
  redirectTo = "/admin/produtos",
  className = "",
  compact = false,
}: DeleteProductButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");

    const res = await fetch(`/api/admin/products/${productId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(formatApiError(data.error, "Erro ao excluir"));
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={loading}
        onClick={handleDelete}
        aria-label={`Excluir ${productName}`}
        className={
          compact
            ? "rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50"
            : "w-full rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50"
        }
      >
        {loading ? "Excluindo..." : compact ? "Excluir" : "Excluir produto"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
