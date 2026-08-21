import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      return "Tabela do banco ausente. Atualize o schema (db:setup:prod).";
    }
    if (error.code === "P2002") {
      return "Registro já existe.";
    }
    if (error.code === "P2003") {
      return "Referência inválida no banco.";
    }
  }
  if (error instanceof Error && error.message && !/prisma|invocation/i.test(error.message)) {
    // Mensagens curtas e legíveis (sem stack Prisma)
    if (error.message.length < 160) return error.message;
  }
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
