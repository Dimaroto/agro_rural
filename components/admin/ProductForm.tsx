"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatApiError } from "@/lib/apiError";
import { formatProductCode } from "@/lib/product-code";
import { CurrencyInput } from "@/components/admin/CurrencyInput";
import { ProductImageUpload } from "@/components/admin/ProductImageUpload";
import type { ImageSlotChange } from "@/components/admin/ProductImageUpload";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";
import type {
  ProductFieldInput,
  ProductFieldType,
  ProductFieldView,
} from "@/lib/party-favor-fields";
import type {
  ProductMeasureUnitCode,
  ProductMeasureView,
} from "@/lib/product-measures";
import {
  PRODUCT_MEASURE_UNITS,
  productMeasureUnitLabels,
} from "@/lib/product-measures";

type Category = { id: string; name: string };

type DraftOption = { key: string; label: string };
type DraftField = {
  key: string;
  label: string;
  type: ProductFieldType;
  required: boolean;
  options: DraftOption[];
};
type DraftMeasure = {
  key: string;
  value: string;
  width: string;
  length: string;
  height: string;
  unit: ProductMeasureUnitCode;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

const inputClass = "admin-input w-full px-3 py-2.5 text-sm";

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDraftFields(fields?: ProductFieldView[]): DraftField[] {
  if (!fields?.length) return [];
  return fields.map((field) => ({
    key: field.id,
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options.map((option) => ({
      key: option.id,
      label: option.label,
    })),
  }));
}

function toDraftMeasures(measures?: ProductMeasureView[]): DraftMeasure[] {
  if (!measures?.length) return [];
  return measures.map((m) => ({
    key: m.id ?? newKey(),
    value: m.value != null ? String(m.value) : "",
    width:
      m.width != null
        ? String(m.width)
        : m.unit === "CM" && m.value != null
          ? String(m.value)
          : "",
    length: m.length != null ? String(m.length) : "",
    height: m.height != null ? String(m.height) : "",
    unit: m.unit,
  }));
}

function parsePositive(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function draftsToPayload(fields: DraftField[]): ProductFieldInput[] {
  return fields.map((field, index) => ({
    label: field.label.trim(),
    type: field.type,
    required: field.required,
    sortOrder: index,
    options:
      field.type === "SELECT"
        ? field.options
            .map((option, optionIndex) => ({
              label: option.label.trim(),
              sortOrder: optionIndex,
            }))
            .filter((option) => option.label.length > 0)
        : [],
  }));
}

export function ProductForm({
  categories,
  product,
  onPriceCentsChange,
}: {
  categories: Category[];
  product?: {
    id: string;
    name: string;
    code?: number;
    barcode?: string | null;
    description: string | null;
    priceCents: number;
    quantity?: number;
    reservedQuantity?: number;
    categoryId: string;
    categoryIds?: string[];
    imageUrl: string | null;
    extraImageUrls?: string[];
    active: boolean;
    ncm?: string | null;
    cfopDefault?: string | null;
    csosn?: string | null;
    origemMercadoria?: string | null;
    unidadeComercial?: string | null;
    customizationFields?: ProductFieldView[];
    measures?: ProductMeasureView[];
  };
  onPriceCentsChange?: (cents: number) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [priceCents, setPriceCents] = useState(product?.priceCents ?? 0);

  useEffect(() => {
    if (product?.priceCents != null) {
      setPriceCents(product.priceCents);
    }
  }, [product?.priceCents]);

  useEffect(() => {
    if (!error) return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  function handlePriceCentsChange(cents: number) {
    setPriceCents(cents);
    onPriceCentsChange?.(cents);
  }

  useEffect(() => {
    onPriceCentsChange?.(priceCents);
  }, [priceCents, onPriceCentsChange]);

  const [coverChange, setCoverChange] = useState<ImageSlotChange>({
    file: null,
    remove: false,
  });
  const [extraChanges, setExtraChanges] = useState<
    [ImageSlotChange, ImageSlotChange]
  >([
    { file: null, remove: false },
    { file: null, remove: false },
  ]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    () => {
      if (product?.categoryIds?.length) return product.categoryIds;
      if (product?.categoryId) return [product.categoryId];
      return categories[0] ? [categories[0].id] : [];
    }
  );
  const [fields, setFields] = useState<DraftField[]>(() =>
    toDraftFields(product?.customizationFields)
  );
  const [quantity, setQuantity] = useState(product?.quantity ?? 0);
  const [measures, setMeasures] = useState<DraftMeasure[]>(() =>
    toDraftMeasures(product?.measures)
  );

  function updateMeasure(key: string, patch: Partial<DraftMeasure>) {
    setMeasures((prev) =>
      prev.map((m) => (m.key === key ? { ...m, ...patch } : m))
    );
  }

  function addMeasure() {
    setMeasures((prev) => [
      ...prev,
      {
        key: newKey(),
        value: "",
        width: "",
        length: "",
        height: "",
        unit: "G",
      },
    ]);
  }

  function removeMeasure(key: string) {
    setMeasures((prev) => prev.filter((m) => m.key !== key));
  }

  function updateField(key: string, patch: Partial<DraftField>) {
    setFields((prev) =>
      prev.map((field) => (field.key === key ? { ...field, ...patch } : field))
    );
  }

  function addField() {
    setFields((prev) => [
      ...prev,
      {
        key: newKey(),
        label: "",
        type: "TEXT",
        required: true,
        options: [{ key: newKey(), label: "" }],
      },
    ]);
  }

  function removeField(key: string) {
    setFields((prev) => prev.filter((field) => field.key !== key));
  }

  function addOption(fieldKey: string) {
    setFields((prev) =>
      prev.map((field) =>
        field.key === fieldKey
          ? {
              ...field,
              options: [...field.options, { key: newKey(), label: "" }],
            }
          : field
      )
    );
  }

  function updateOption(fieldKey: string, optionKey: string, label: string) {
    setFields((prev) =>
      prev.map((field) =>
        field.key === fieldKey
          ? {
              ...field,
              options: field.options.map((option) =>
                option.key === optionKey ? { ...option, label } : option
              ),
            }
          : field
      )
    );
  }

  function removeOption(fieldKey: string, optionKey: string) {
    setFields((prev) =>
      prev.map((field) =>
        field.key === fieldKey
          ? {
              ...field,
              options: field.options.filter((option) => option.key !== optionKey),
            }
          : field
      )
    );
  }

  async function resolveImageSlot(
    change: ImageSlotChange,
    currentUrl: string | null
  ): Promise<string | null | undefined> {
    if (change.remove) return null;
    if (change.file) {
      const uploadFd = new FormData();
      uploadFd.append("file", change.file);
      const up = await fetch("/api/admin/upload", {
        method: "POST",
        body: uploadFd,
      });
      if (!up.ok) {
        const data = await up.json().catch(() => ({}));
        throw new Error(formatApiError(data.error, "Erro ao enviar a foto"));
      }
      const { url } = await up.json();
      return url as string;
    }
    return currentUrl;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      setLoading(false);
      setError("Preencha o nome do produto.");
      return;
    }

    const payloadFields = draftsToPayload(fields);
    for (const field of payloadFields) {
      if (!field.label) {
        setLoading(false);
        setError("Preencha o nome de todos os campos personalizados.");
        return;
      }
      if (field.type === "SELECT" && (field.options?.length ?? 0) < 1) {
        setLoading(false);
        setError(`O campo "${field.label}" precisa de ao menos uma opção.`);
        return;
      }
    }

    const measurePayload = measures
      .map((m, index) => {
        if (m.unit === "CM") {
          const width = parsePositive(m.width);
          const length = parsePositive(m.length);
          const height = parsePositive(m.height);
          if (width == null && length == null && !m.height.trim()) {
            return null;
          }
          return {
            unit: m.unit,
            width,
            length,
            height,
            sortOrder: index,
          };
        }
        const value = parsePositive(m.value);
        if (value == null && !m.value.trim()) return null;
        return {
          unit: m.unit,
          value,
          sortOrder: index,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m != null);

    const invalidMeasure = measures.find((m) => {
      if (m.unit === "CM") {
        const hasAny =
          m.width.trim() || m.length.trim() || m.height.trim();
        if (!hasAny) return false;
        if (parsePositive(m.width) == null) return true;
        if (parsePositive(m.length) == null) return true;
        if (m.height.trim() && parsePositive(m.height) == null) return true;
        return false;
      }
      if (!m.value.trim()) return false;
      return parsePositive(m.value) == null;
    });
    if (invalidMeasure) {
      setLoading(false);
      setError(
        invalidMeasure.unit === "CM"
          ? "Em cm, informe largura e comprimento (altura opcional)."
          : "Informe um valor válido maior que zero em cada medida."
      );
      return;
    }

    let imageUrl: string | null | undefined;
    let extraImageUrls: string[];
    try {
      imageUrl = await resolveImageSlot(
        coverChange,
        product?.imageUrl ?? null
      );
      const existingExtras = product?.extraImageUrls ?? [];
      const resolvedExtras = await Promise.all([
        resolveImageSlot(extraChanges[0], existingExtras[0] ?? null),
        resolveImageSlot(extraChanges[1], existingExtras[1] ?? null),
      ]);
      extraImageUrls = resolvedExtras
        .filter((url): url is string => Boolean(url))
        .slice(0, 2);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Erro ao enviar a foto");
      return;
    }

    if (selectedCategoryIds.length === 0) {
      setLoading(false);
      setError("Selecione ao menos uma categoria.");
      return;
    }

    const payload = {
      name,
      description: (fd.get("description") as string) || undefined,
      barcode: ((fd.get("barcode") as string) || "").trim() || null,
      priceCents,
      quantity: Math.max(0, Math.floor(Number(quantity) || 0)),
      categoryIds: selectedCategoryIds,
      imageUrl: imageUrl === null ? null : (imageUrl ?? undefined),
      extraImageUrls,
      active: product ? fd.get("active") === "on" : true,
      ncm: ((fd.get("ncm") as string) || "").replace(/\D/g, "") || null,
      cfopDefault:
        ((fd.get("cfopDefault") as string) || "").replace(/\D/g, "") || "5102",
      csosn: ((fd.get("csosn") as string) || "").replace(/\D/g, "") || "102",
      origemMercadoria:
        ((fd.get("origemMercadoria") as string) || "").replace(/\D/g, "") ||
        "0",
      unidadeComercial:
        ((fd.get("unidadeComercial") as string) || "").trim().toUpperCase() ||
        "UN",
      customizationFields: payloadFields,
      measures: measurePayload,
    };

    const url = product
      ? `/api/admin/products/${product.id}`
      : "/api/admin/products";
    const method = product ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(formatApiError(data.error, "Erro ao salvar"));
      return;
    }

    router.push("/admin/produtos");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="admin-card max-w-2xl space-y-6 p-4 sm:p-6"
    >
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Informações
        </h2>
        {product?.code != null && (
          <Field label="Código">
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-sm font-semibold text-emerald-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-emerald-400">
              {formatProductCode(product.code)}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Código sequencial gerado automaticamente
            </p>
          </Field>
        )}
        <Field label="Código de barras">
          <input
            name="barcode"
            inputMode="numeric"
            defaultValue={product?.barcode ?? ""}
            className={inputClass}
            placeholder="EAN / UPC (8 a 14 dígitos)"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-zinc-400">
            Opcional. Usado na busca do PDV (leitor ou digitação).
          </p>
        </Field>
        <Field label="Nome">
          <input
            name="name"
            required
            defaultValue={product?.name}
            className={inputClass}
            placeholder="Ex: Sabonete artesanal"
          />
        </Field>
        <Field label="Descrição">
          <textarea
            name="description"
            defaultValue={product?.description ?? ""}
            className={inputClass}
            rows={3}
            placeholder="Texto principal no topo do produto no catálogo"
          />
        </Field>

        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Fiscal (NF-e)
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="NCM (8 dígitos)">
              <input
                name="ncm"
                inputMode="numeric"
                defaultValue={product?.ncm ?? ""}
                className={inputClass}
                placeholder="01012100"
                maxLength={8}
              />
            </Field>
            <Field label="CFOP">
              <input
                name="cfopDefault"
                inputMode="numeric"
                defaultValue={product?.cfopDefault ?? "5102"}
                className={inputClass}
              />
            </Field>
            <Field label="CSOSN">
              <input
                name="csosn"
                inputMode="numeric"
                defaultValue={product?.csosn ?? "102"}
                className={inputClass}
              />
            </Field>
            <Field label="Origem">
              <input
                name="origemMercadoria"
                inputMode="numeric"
                defaultValue={product?.origemMercadoria ?? "0"}
                className={inputClass}
              />
            </Field>
            <Field label="Unidade">
              <input
                name="unidadeComercial"
                defaultValue={product?.unidadeComercial ?? "UN"}
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Medidas
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Opcional. Em g, kg ou ml informe o valor; em cm, largura e
                comprimento (altura opcional). Ex.: 90g, 1kg, 10×20cm.
              </p>
            </div>
            <button
              type="button"
              onClick={addMeasure}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              + Adicionar
            </button>
          </div>
          {measures.length === 0 ? (
            <p className="text-sm text-zinc-400">Nenhuma medida cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {measures.map((measure) => (
                <div
                  key={measure.key}
                  className="flex flex-wrap items-end gap-2"
                >
                  {measure.unit === "CM" ? (
                    <>
                      <div className="min-w-[5.5rem] flex-1 sm:flex-none">
                        <label className="mb-1 block text-[11px] font-medium text-zinc-500">
                          Largura *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={measure.width}
                          onChange={(e) =>
                            updateMeasure(measure.key, {
                              width: e.target.value,
                            })
                          }
                          className={inputClass}
                          placeholder="Ex.: 10"
                          aria-label="Largura em cm"
                          required
                        />
                      </div>
                      <div className="min-w-[5.5rem] flex-1 sm:flex-none">
                        <label className="mb-1 block text-[11px] font-medium text-zinc-500">
                          Comprimento *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={measure.length}
                          onChange={(e) =>
                            updateMeasure(measure.key, {
                              length: e.target.value,
                            })
                          }
                          className={inputClass}
                          placeholder="Ex.: 20"
                          aria-label="Comprimento em cm"
                          required
                        />
                      </div>
                      <div className="min-w-[5.5rem] flex-1 sm:flex-none">
                        <label className="mb-1 block text-[11px] font-medium text-zinc-500">
                          Altura
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={measure.height}
                          onChange={(e) =>
                            updateMeasure(measure.key, {
                              height: e.target.value,
                            })
                          }
                          className={inputClass}
                          placeholder="Opcional"
                          aria-label="Altura em cm (opcional)"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="min-w-[6rem] flex-1 sm:max-w-[8rem] sm:flex-none">
                      <label className="mb-1 block text-[11px] font-medium text-zinc-500">
                        Valor
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        value={measure.value}
                        onChange={(e) =>
                          updateMeasure(measure.key, {
                            value: e.target.value,
                          })
                        }
                        className={inputClass}
                        placeholder="Ex.: 90"
                        aria-label="Valor da medida"
                      />
                    </div>
                  )}
                  <div className="min-w-[5rem]">
                    <label className="mb-1 block text-[11px] font-medium text-zinc-500">
                      Unidade
                    </label>
                    <select
                      value={measure.unit}
                      onChange={(e) =>
                        updateMeasure(measure.key, {
                          unit: e.target.value as ProductMeasureUnitCode,
                        })
                      }
                      className={`${inputClass} max-w-[6.5rem]`}
                      aria-label="Unidade da medida"
                    >
                      {PRODUCT_MEASURE_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {productMeasureUnitLabels[unit]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMeasure(measure.key)}
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preço (R$)">
            <CurrencyInput
              valueCents={priceCents}
              onChange={handlePriceCentsChange}
              className={inputClass}
              aria-label="Preço em reais"
            />
            <p className="mt-1 text-xs text-zinc-400">
              Digite só os números; a vírgula entra sozinha
            </p>
          </Field>
          <Field label="Estoque">
            <input
              type="number"
              min={0}
              step={1}
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.max(0, Math.floor(Number(e.target.value) || 0)))
              }
              className={inputClass}
              aria-label="Estoque"
            />
            {product?.reservedQuantity ? (
              <p className="mt-1 text-xs text-zinc-400">
                Reservado em pedidos: {product.reservedQuantity} un.
              </p>
            ) : (
              <p className="mt-1 text-xs text-zinc-400">
                Unidades disponíveis para venda
              </p>
            )}
          </Field>
          <Field label="Categorias">
            <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950">
              {categories.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Nenhuma categoria cadastrada.
                </p>
              ) : (
                categories.map((category) => {
                  const checked = selectedCategoryIds.includes(category.id);
                  return (
                    <label
                      key={category.id}
                      className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedCategoryIds((prev) => {
                            if (e.target.checked) {
                              return prev.includes(category.id)
                                ? prev
                                : [...prev, category.id];
                            }
                            return prev.filter((id) => id !== category.id);
                          });
                        }}
                        className="h-4 w-4 rounded border-zinc-300 text-emerald-600"
                      />
                      <span>{category.name}</span>
                    </label>
                  );
                })
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Selecione uma ou mais categorias para o produto.
            </p>
          </Field>
        </div>
      </section>

      <section className="space-y-4 border-t border-zinc-100 pt-6 dark:border-zinc-800">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Fotos
        </h2>
        <ProductImageUpload
          coverUrl={product?.imageUrl ?? null}
          extraUrls={product?.extraImageUrls ?? []}
          onCoverChange={setCoverChange}
          onExtraChange={(index, value) =>
            setExtraChanges((prev) => {
              const next: [ImageSlotChange, ImageSlotChange] = [...prev];
              next[index] = value;
              return next;
            })
          }
        />
      </section>

      <section className="space-y-4 border-t border-zinc-100 pt-6 dark:border-zinc-800">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Campos personalizados
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Adicione campos de texto ou seleção para qualquer produto. Cada campo
          pode ser obrigatório ou opcional.
        </p>
        <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.key}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                    Campo {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeField(field.key)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nome do campo">
                    <input
                      value={field.label}
                      onChange={(e) =>
                        updateField(field.key, { label: e.target.value })
                      }
                      className={inputClass}
                      placeholder="Ex: Nome no rótulo, formato, acabamento"
                    />
                  </Field>
                  <Field label="Tipo">
                    <select
                      value={field.type}
                      onChange={(e) =>
                        updateField(field.key, {
                          type: e.target.value as ProductFieldType,
                          options:
                            e.target.value === "SELECT" &&
                            field.options.length === 0
                              ? [{ key: newKey(), label: "" }]
                              : field.options,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="TEXT">Digitação livre</option>
                      <option value="SELECT">Seleção de opções</option>
                    </select>
                  </Field>
                </div>

                <label className="mt-3 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) =>
                      updateField(field.key, { required: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600"
                  />
                  Obrigatório
                </label>

                {field.type === "SELECT" && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Opções
                    </p>
                    {field.options.map((option) => (
                      <div key={option.key} className="flex gap-2">
                        <input
                          value={option.label}
                          onChange={(e) =>
                            updateOption(field.key, option.key, e.target.value)
                          }
                          className={inputClass}
                          placeholder="Ex: Lavanda"
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(field.key, option.key)}
                          className="shrink-0 rounded-lg border border-zinc-200 px-3 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addOption(field.key)}
                      className="text-xs font-medium text-emerald-700 hover:underline"
                    >
                      + Adicionar opção
                    </button>
                  </div>
                )}

                {field.type === "TEXT" && (
                  <p className="mt-3 text-xs text-zinc-500">
                    O cliente digitará o conteúdo deste campo no catálogo.
                  </p>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addField}
              className="rounded-xl border border-dashed border-emerald-300 px-4 py-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              + Adicionar campo
            </button>
        </div>
      </section>

      {product && (
        <section className="border-t border-zinc-100 pt-6 dark:border-zinc-800">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950">
            <input
              name="active"
              type="checkbox"
              defaultChecked={product.active}
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600"
            />
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Produto ativo
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Produtos inativos não aparecem no catálogo
              </p>
            </div>
          </label>
        </section>
      )}

      {product && (
        <section className="border-t border-zinc-100 pt-6 dark:border-zinc-800">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-red-500">
            Zona de perigo
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Excluir apaga o produto permanentemente. O histórico de pedidos
            mantém o nome do item.
          </p>
          <DeleteProductButton
            productId={product.id}
            productName={product.name}
            className="mt-3"
          />
        </section>
      )}

      {error && (
        <p
          ref={errorRef}
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3 border-t border-zinc-100 pt-6 dark:border-zinc-800">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Salvar produto"}
        </button>
        <Link
          href="/admin/produtos"
          className="rounded-xl border border-zinc-200 px-6 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
