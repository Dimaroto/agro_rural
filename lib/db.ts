import { applyNeonEnv } from "@/lib/neon-env";
import { OrderStatus, PrismaClient } from "@prisma/client";

applyNeonEnv();

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function isPrismaClientStale(client: PrismaClient): boolean {
  if (!("product" in client)) return true;
  if (!OrderStatus.DELIVERED) return true;
  return false;
}

function getPrismaClient() {
  const cached = globalForPrisma.prisma;
  if (cached && !isPrismaClientStale(cached)) return cached;

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

export const prisma = getPrismaClient();
