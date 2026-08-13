"use client";

import type { ReactNode } from "react";
import { CategorySlugIcon } from "@/components/icons/UiIcons";

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M40 8C26 24 14 34 10 48c-3 10 2 22 16 26 8 2 18 2 26-2 14-6 20-18 16-28-4-12-14-22-28-36z"
        fill="#2D4C1E"
      />
      <path
        d="M40 18c-6 8-12 14-14 22 6-2 12-6 16-12 2-4 0-8-2-10z"
        fill="#009d71"
      />
    </svg>
  );
}

function LavenderIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M32 8c-2 8-6 14-6 22 0 4 2 8 6 10 4-2 6-6 6-10 0-8-4-14-6-22z"
        fill="#009d71"
        opacity="0.35"
      />
      <circle cx="32" cy="42" r="4" fill="#2D4C1E" opacity="0.2" />
      <path
        d="M32 46v12M28 50l4-2 4 2M26 54l6-1 6 1"
        stroke="#2D4C1E"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.25"
      />
    </svg>
  );
}

type CatalogCategorySectionProps = {
  name: string;
  slug: string;
  productCount: number;
  animationIndex?: number;
  children: ReactNode;
};

export function CatalogCategorySection({
  name,
  slug,
  productCount,
  animationIndex = 0,
  children,
}: CatalogCategorySectionProps) {
  const countLabel =
    productCount === 1 ? "1 produto" : `${productCount} produtos`;

  return (
    <section
      className={`catalog-section relative overflow-hidden rounded-3xl border border-[#d8cfc0]/65 opacity-0 shadow-[0_8px_24px_rgba(20,83,45,0.06),0_22px_58px_rgba(14,159,110,0.085)] animate-fade-in-up motion-reduce:animate-none motion-reduce:opacity-100 ${
        animationIndex % 2 === 0 ? "catalog-section--warm" : "catalog-section--sage"
      }`}
      style={{
        animationDelay: `${200 + animationIndex * 120}ms`,
        background: "var(--section-surface)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-brand/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-8 left-8 h-28 w-28 rounded-full bg-brand-light/80 blur-2xl"
        aria-hidden
      />

      <div
        className="relative overflow-hidden border-b border-brand/10"
        style={{ background: "var(--section-header)" }}
      >
        <LeafIcon className="pointer-events-none absolute -right-1 top-0 h-16 w-16 rotate-[15deg] opacity-[0.11]" />
        <LeafIcon className="pointer-events-none absolute -bottom-3 left-2 h-12 w-12 -scale-x-100 rotate-[-25deg] opacity-[0.07]" />
        <LavenderIcon className="pointer-events-none absolute right-16 top-2 h-10 w-10 opacity-60" />

        <div className="pointer-events-none absolute inset-0 bg-brand-light/20" />

        <div className="relative z-10 flex items-center gap-3 px-4 py-3.5 bg-brand-cream/90 sm:px-5 sm:py-4">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/15 bg-[#F7F4EC]/90 text-xl shadow-[0_4px_16px_rgba(74,103,65,0.1)] backdrop-blur-sm"
            aria-hidden
          >
            <CategorySlugIcon slug={slug} className="h-6 w-6" />
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold tracking-[-0.02em] text-brand-dark sm:text-xl">
              {name}
            </h2>
          </div>

          <span className="shrink-0 rounded-full border border-brand/15 bg-brand-cream/85 px-3 py-1 text-[11px] font-semibold tracking-wide text-brand-dark shadow-sm backdrop-blur-sm sm:text-xs">
            {countLabel}
          </span>
        </div>
      </div>

      <div
        className="relative p-3 sm:p-4 lg:p-5"
        style={{ background: "var(--section-body)" }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-brand/20"
          aria-hidden
        />
        {children}
      </div>
    </section>
  );
}

export function CatalogProductsShell({ children }: { children: ReactNode }) {
  return (
    <div className="catalog-section catalog-section--warm relative overflow-hidden rounded-3xl border border-[#d8cfc0]/65 p-3 shadow-[0_8px_24px_rgba(20,83,45,0.06),0_22px_58px_rgba(14,159,110,0.085)] sm:p-4 lg:p-5" style={{ background: "var(--section-surface)" }}>
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/8 blur-3xl"
        aria-hidden
      />
      <div className="relative">{children}</div>
    </div>
  );
}
