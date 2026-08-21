"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { formatPrice } from "@/lib/format";
import { parseProductDetails } from "@/lib/productDisplay";
import { StockBadge } from "@/components/StockBadge";
import type { CatalogProduct } from "@/components/ProductCard";
import { isPhotoImageUrl } from "@/lib/image-url";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
  ProductPlaceholder,
} from "@/components/icons/UiIcons";
import type { PartyFavorFieldAnswer } from "@/lib/party-favor-fields";
import {
  validateProductFieldAnswers,
  type CartCustomization,
} from "@/lib/customization";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import { QuantityStepper } from "@/components/catalog/QuantityStepper";
import {
  formatStockQty,
  formatWeightDigitsMask,
  gramsToKgLabel,
  lineTotalCentsFromGrams,
  parseWeightDigitsToGrams,
} from "@/lib/stock-unit";

const EXIT_MS = 280;

function getImageKind(imageUrl: string | null) {
  if (!imageUrl) return "none" as const;
  if (isPhotoImageUrl(imageUrl)) return "photo" as const;
  return "icon" as const;
}

function productGalleryUrls(product: CatalogProduct): string[] {
  const extras = (product.extraImageUrls ?? []).filter(Boolean).slice(0, 2);
  return [product.imageUrl, ...extras].filter(
    (url): url is string => Boolean(url)
  );
}

function ProductDetailImage({
  product,
  imageUrls,
  activeIndex,
  onIndexChange,
}: {
  product: CatalogProduct;
  imageUrls: string[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
}) {
  const currentUrl = imageUrls[activeIndex] ?? null;
  const imageKind = getImageKind(currentUrl);
  const hasGallery = imageUrls.length > 1;

  function goPrev() {
    if (!hasGallery) return;
    onIndexChange((activeIndex - 1 + imageUrls.length) % imageUrls.length);
  }

  function goNext() {
    if (!hasGallery) return;
    onIndexChange((activeIndex + 1) % imageUrls.length);
  }

  return (
    <div className="relative flex h-full min-h-[200px] w-full items-center justify-start overflow-hidden bg-brand-light py-4 pl-3 pr-4 lg:min-h-0 lg:py-5 lg:pl-4 lg:pr-5">
      {imageKind === "photo" && currentUrl && (
        <div className="relative aspect-square w-full max-w-[280px] overflow-hidden rounded-2xl shadow-[0_8px_28px_rgba(14,159,110,0.15)] ring-1 ring-white/70 sm:max-w-[300px]">
          <Image
            src={currentUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 45vw, 320px"
            priority
          />
        </div>
      )}

      {imageKind === "icon" && currentUrl && (
        <div className="relative flex aspect-square w-full max-w-[220px] items-center justify-center rounded-2xl bg-white/60 ring-1 ring-brand/10 sm:max-w-[240px]">
          <Image
            src={currentUrl}
            alt=""
            width={112}
            height={112}
            className="opacity-70"
          />
        </div>
      )}

      {imageKind === "none" && (
        <div className="flex aspect-square w-full max-w-[200px] items-center justify-center rounded-2xl bg-white/50 text-brand/35 ring-1 ring-brand/10 sm:max-w-[220px]">
          <ProductPlaceholder className="h-12 w-12" />
        </div>
      )}

      {hasGallery && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-brand/15 bg-white/95 text-brand-dark shadow-md backdrop-blur-sm transition hover:bg-white touch-manipulation"
            aria-label="Foto anterior"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-brand/15 bg-white/95 text-brand-dark shadow-md backdrop-blur-sm transition hover:bg-white touch-manipulation"
            aria-label="Próxima foto"
          >
            <ArrowRightIcon className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {imageUrls.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onIndexChange(i)}
                className={`h-1.5 rounded-full transition ${
                  i === activeIndex
                    ? "w-4 bg-brand"
                    : "w-1.5 bg-brand-dark/25 hover:bg-brand-dark/40"
                }`}
                aria-label={`Ir para foto ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}

      <div className="absolute left-3 top-3 z-10">
        <StockBadge
          status={product.stockStatus}
          available={product.available}
          stockUnit={product.stockUnit}
          compact
          overlay
        />
      </div>
    </div>
  );
}

type ProductDetailModalProps = {
  product: CatalogProduct | null;
  qtyByProduct: Record<string, number>;
  onClose: () => void;
  onAdd: (
    product: CatalogProduct,
    customization: CartCustomization,
    quantity: number
  ) => void;
  onViewCart: () => void;
};

export function ProductDetailModal({
  product,
  qtyByProduct,
  onClose,
  onAdd,
  onViewCart,
}: ProductDetailModalProps) {
  const [displayProduct, setDisplayProduct] = useState<CatalogProduct | null>(
    product
  );
  const [isExiting, setIsExiting] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, PartyFavorFieldAnswer>>(
    {}
  );
  const [formError, setFormError] = useState("");
  const [qty, setQty] = useState(1);
  const [weightDigits, setWeightDigits] = useState("");
  const weightInputRef = useRef<HTMLInputElement>(null);

  const fields = useMemo(
    () => displayProduct?.customizationFields ?? [],
    [displayProduct]
  );

  useEffect(() => {
    if (product) {
      setIsExiting(false);
      setDisplayProduct(product);
      setGalleryIndex(0);
      setAnswers({});
      setFormError("");
      setQty(1);
      setWeightDigits("");
      return;
    }

    if (!displayProduct) return;

    setIsExiting(true);
    const timer = window.setTimeout(() => {
      setDisplayProduct(null);
      setIsExiting(false);
    }, EXIT_MS);

    return () => window.clearTimeout(timer);
  }, [product, displayProduct]);

  useEffect(() => {
    if (!displayProduct) return;
    lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [displayProduct, onClose]);

  useEffect(() => {
    if (!displayProduct || displayProduct.stockUnit !== "KG") return;
    const id = window.requestAnimationFrame(() => {
      weightInputRef.current?.focus();
      weightInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [displayProduct]);

  if (!displayProduct) return null;

  const currentProduct = displayProduct;
  const isKg = currentProduct.stockUnit === "KG";
  const galleryUrls = productGalleryUrls(currentProduct);
  const inCartQty = qtyByProduct[currentProduct.id] ?? 0;
  const { sizeLabel, detailsText } = parseProductDetails(
    currentProduct.description,
    currentProduct.name
  );
  const structuredMeasures = (currentProduct.measures ?? []).filter(Boolean);
  const measureChips =
    structuredMeasures.length > 0
      ? structuredMeasures
      : sizeLabel
        ? [sizeLabel]
        : [];
  const hasCustomFields = fields.length > 0;
  const showPersonalization = hasCustomFields;
  const remaining = Math.max(0, currentProduct.available - inCartQty);
  const outOfStock = remaining <= 0;
  const weightGrams = parseWeightDigitsToGrams(weightDigits);
  const addQty = isKg ? weightGrams : qty;
  const linePreviewCents = isKg
    ? lineTotalCentsFromGrams(currentProduct.priceCents, weightGrams)
    : currentProduct.priceCents * qty;

  const cardAnimation = isExiting
    ? "animate-product-modal-out motion-reduce:animate-none"
    : "animate-product-modal-in motion-reduce:animate-none";

  const backdropAnimation = isExiting
    ? "animate-product-modal-backdrop-out motion-reduce:animate-none"
    : "animate-product-modal-backdrop-in motion-reduce:animate-none";

  function setTextAnswer(fieldId: string, fieldLabel: string, value: string) {
    setAnswers((prev) => ({
      ...prev,
      [fieldId]: {
        fieldId,
        fieldLabel,
        type: "TEXT",
        value,
      },
    }));
  }

  function setSelectAnswer(
    fieldId: string,
    fieldLabel: string,
    optionId: string,
    value: string
  ) {
    setAnswers((prev) => ({
      ...prev,
      [fieldId]: {
        fieldId,
        fieldLabel,
        type: "SELECT",
        optionId,
        value,
      },
    }));
  }

  function handleAdd() {
    const fieldAnswers = fields.map((field) => {
      const existing = answers[field.id];
      return (
        existing ?? {
          fieldId: field.id,
          fieldLabel: field.label,
          type: field.type,
          value: "",
        }
      );
    });

    if (hasCustomFields) {
      const error = validateProductFieldAnswers(fields, fieldAnswers);
      if (error) {
        setFormError(error);
        return;
      }
    }

    if (outOfStock || remaining <= 0) return;

    if (isKg) {
      if (weightGrams <= 0) {
        setFormError("Informe a quantidade em kg.");
        weightInputRef.current?.focus();
        return;
      }
      if (weightGrams > remaining) {
        setFormError(`Máximo disponível: ${gramsToKgLabel(remaining)}`);
        weightInputRef.current?.focus();
        return;
      }
    }

    setFormError("");
    onAdd(
      currentProduct,
      {
        fieldAnswers: fieldAnswers.filter((answer) => answer.value.trim()),
      },
      Math.min(addQty, remaining)
    );
    setQty(1);
    setWeightDigits("");
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center overflow-hidden overscroll-none p-0 sm:items-center sm:p-3 lg:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-detail-title"
    >
      <button
        type="button"
        className={`absolute inset-0 touch-none bg-brand-dark/40 backdrop-blur-sm ${backdropAnimation}`}
        onClick={onClose}
        aria-label="Fechar detalhes do produto"
      />

      <div
        className={`pointer-events-auto relative flex h-[min(92dvh,100%)] max-h-[92dvh] w-full max-w-2xl min-h-0 flex-col overflow-hidden rounded-t-3xl border border-white/70 bg-brand-cream shadow-2xl transition-all duration-500 ease-out sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-3xl lg:max-h-[85vh] lg:flex-row ${cardAnimation}`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-brand/15 bg-white/95 text-brand-dark shadow-md backdrop-blur-sm transition-colors hover:bg-white touch-manipulation lg:right-3 lg:top-3 lg:h-9 lg:w-9"
          aria-label="Fechar"
        >
          <CloseIcon className="h-5 w-5" />
        </button>

        <div className="w-full shrink-0 border-b border-brand/10 lg:w-[50%] lg:max-w-[360px] lg:border-b-0 lg:border-r">
          <ProductDetailImage
            product={displayProduct}
            imageUrls={galleryUrls}
            activeIndex={Math.min(
              galleryIndex,
              Math.max(galleryUrls.length - 1, 0)
            )}
            onIndexChange={setGalleryIndex}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white/95">
          <div className="product-detail-modal__scroll min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain p-4 touch-pan-y sm:p-5">
            <div className="min-w-0 rounded-2xl border border-brand/10 bg-brand-cream/50 p-4 shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
                {displayProduct.categories?.length
                  ? displayProduct.categories.map((c) => c.name).join(" · ")
                  : displayProduct.categoryName}
              </p>
              <h2
                id="product-detail-title"
                className="mt-1 text-base font-bold leading-snug text-brand-dark sm:text-lg"
              >
                {displayProduct.name}
              </h2>

              {measureChips.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {measureChips.map((label, index) => (
                    <span
                      key={`${label}-${index}`}
                      className="inline-flex items-center rounded-full border border-brand/15 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-dark"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}

              {detailsText && (
                <p className="mt-2.5 break-words text-xs leading-relaxed text-[#6B7280] [overflow-wrap:anywhere] sm:text-sm">
                  {detailsText}
                </p>
              )}

              {showPersonalization && (
                <div className="mt-4 space-y-3 border-t border-brand-light/80 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand/80">
                    Personalização
                  </p>

                  {fields.map((field) => (
                    <div key={field.id}>
                      <label className="text-xs font-medium text-zinc-700">
                        {field.label}
                        {field.required ? " *" : ""}
                      </label>
                      {field.type === "TEXT" ? (
                        <input
                          value={answers[field.id]?.value ?? ""}
                          onChange={(e) =>
                            setTextAnswer(field.id, field.label, e.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-brand-dark outline-none placeholder:text-zinc-400 focus:border-brand"
                          placeholder={`Digite ${field.label.toLowerCase()}`}
                        />
                      ) : (
                        <select
                          value={answers[field.id]?.optionId ?? ""}
                          onChange={(e) => {
                            const option = field.options.find(
                              (o) => o.id === e.target.value
                            );
                            setSelectAnswer(
                              field.id,
                              field.label,
                              option?.id ?? "",
                              option?.label ?? ""
                            );
                          }}
                          className="catalog-select mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand"
                        >
                          <option value="">Selecione…</option>
                          {field.options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}

                  {formError && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                      {formError}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-end justify-between gap-2 border-t border-brand-light/80 pt-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand/80">
                    {isKg ? "Valor / kg" : "Valor"}
                  </p>
                  <p className="text-lg font-bold tabular-nums text-brand-dark sm:text-xl">
                    {formatPrice(
                      isKg ? currentProduct.priceCents : linePreviewCents
                    )}
                    {isKg ? (
                      <span className="text-sm font-semibold opacity-70">
                        {" "}
                        / kg
                      </span>
                    ) : null}
                  </p>
                  {isKg && weightGrams > 0 ? (
                    <p className="mt-1 text-sm font-semibold text-brand">
                      Total {formatPrice(linePreviewCents)}
                    </p>
                  ) : null}
                </div>
                {inCartQty > 0 && (
                  <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-dark">
                    {isKg
                      ? `${formatStockQty(inCartQty, "KG")} no carrinho`
                      : `${inCartQty} no carrinho`}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand/80">
                  {isKg ? "Quantidade (kg)" : "Quantidade"}
                </p>
                {isKg ? (
                  <div className="relative">
                    <input
                      ref={weightInputRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={formatWeightDigitsMask(weightDigits)}
                      onChange={(e) => {
                        setWeightDigits(e.target.value.replace(/\D/g, ""));
                        setFormError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAdd();
                        }
                      }}
                      disabled={outOfStock}
                      className="w-full rounded-xl border border-brand/20 bg-white px-3 py-3 pr-12 text-center text-xl font-bold tabular-nums text-brand-dark outline-none focus:border-brand disabled:opacity-50"
                      aria-label="Quantidade em quilos"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-brand/70">
                      kg
                    </span>
                  </div>
                ) : (
                  <QuantityStepper
                    value={qty}
                    min={1}
                    max={remaining}
                    onChange={setQty}
                    disabled={outOfStock}
                  />
                )}
                {outOfStock ? (
                  <p className="mt-2 text-xs text-zinc-500">Produto esgotado.</p>
                ) : (
                  <p className="mt-2 text-xs text-zinc-500">
                    {isKg
                      ? `${gramsToKgLabel(remaining)} disponível`
                      : `${remaining} disponível${remaining === 1 ? "" : "eis"}`}
                    {isKg
                      ? " — digite só números; a vírgula entra sozinha"
                      : ""}
                  </p>
                )}
                {formError ? (
                  <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    {formError}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div
            className="shrink-0 border-t border-brand/10 bg-brand-cream/60 p-3 backdrop-blur-sm sm:p-4"
            style={{
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAdd}
                disabled={outOfStock}
                className="min-h-[2.75rem] flex-1 rounded-xl bg-brand-dark py-3 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(15,35,28,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand active:scale-[0.98] touch-manipulation disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {outOfStock
                  ? "Esgotado"
                  : inCartQty > 0
                    ? isKg
                      ? "Adicionar mais"
                      : `Adicionar mais (${inCartQty})`
                    : "Adicionar ao carrinho"}
              </button>
              {inCartQty > 0 && (
                <button
                  type="button"
                  onClick={onViewCart}
                  className="inline-flex min-h-[2.75rem] shrink-0 items-center justify-center rounded-xl border border-brand/25 bg-white px-4 py-3 text-sm font-semibold text-brand-dark shadow-sm transition-colors hover:border-brand/40 hover:bg-brand-light/40 touch-manipulation"
                >
                  Ver carrinho
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
