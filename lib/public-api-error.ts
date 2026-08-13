import { NextResponse } from "next/server";
import { InventoryError } from "@/lib/inventory";

/** Erro de regra de negócio seguro para exibir na API. */
export class PublicApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicApiError";
  }
}

export function isPublicApiError(error: unknown): error is Error {
  return error instanceof PublicApiError || error instanceof InventoryError;
}

export function resolvePublicErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (isPublicApiError(error)) return error.message;
  return fallback;
}

export function logRouteError(scope: string, error: unknown): void {
  console.error(`[${scope}]`, error);
}

export function publicErrorJson(
  scope: string,
  error: unknown,
  fallback: string,
  status = 400
) {
  logRouteError(scope, error);
  return NextResponse.json(
    { error: resolvePublicErrorMessage(error, fallback) },
    { status }
  );
}
