import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export type RateLimitConfig = {
  maxAttempts: number;
  windowMs: number;
};

export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
};

export const REGISTER_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
};

export const ORDER_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000,
};

export const PIX_QR_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 30,
  windowMs: 15 * 60 * 1000,
};

export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Muitas tentativas. Aguarde e tente novamente.");
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function consumeBucket(
  bucketKey: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.windowMs);

  const existing = await prisma.authRateLimitBucket.findUnique({
    where: { bucketKey },
  });

  if (!existing || existing.expiresAt <= now) {
    await prisma.authRateLimitBucket.upsert({
      where: { bucketKey },
      create: { bucketKey, count: 1, expiresAt },
      update: { count: 1, expiresAt },
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= config.maxAttempts) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.expiresAt.getTime() - now.getTime()) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }

  await prisma.authRateLimitBucket.update({
    where: { bucketKey },
    data: { count: { increment: 1 } },
  });

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Verifica IP e e-mail (quando informado). Lança RateLimitError se exceder. */
export async function enforceAuthRateLimit(
  scope: string,
  keys: { ip: string; email?: string },
  config: RateLimitConfig = LOGIN_RATE_LIMIT
): Promise<void> {
  const ipResult = await consumeBucket(`${scope}:ip:${keys.ip}`, config);
  if (!ipResult.allowed) {
    throw new RateLimitError(ipResult.retryAfterSeconds);
  }

  if (keys.email) {
    const emailKey = keys.email.toLowerCase().trim();
    const emailResult = await consumeBucket(
      `${scope}:email:${emailKey}`,
      config
    );
    if (!emailResult.allowed) {
      throw new RateLimitError(emailResult.retryAfterSeconds);
    }
  }
}

export function rateLimitJsonResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Muitas tentativas. Aguarde e tente novamente." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}
