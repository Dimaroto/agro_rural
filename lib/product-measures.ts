import type { Prisma, ProductMeasureUnit } from "@prisma/client";
import { z } from "zod";

export const PRODUCT_MEASURE_UNITS = ["G", "KG", "ML", "CM"] as const;
export type ProductMeasureUnitCode = (typeof PRODUCT_MEASURE_UNITS)[number];

export const productMeasureUnitLabels: Record<ProductMeasureUnitCode, string> =
  {
    G: "g",
    KG: "kg",
    ML: "ml",
    CM: "cm",
  };

export type ProductMeasureInput = {
  unit: ProductMeasureUnitCode;
  value?: number | null;
  width?: number | null;
  length?: number | null;
  height?: number | null;
  sortOrder?: number;
};

export type ProductMeasureView = {
  id?: string;
  unit: ProductMeasureUnitCode;
  value: number | null;
  width: number | null;
  length: number | null;
  height: number | null;
  sortOrder: number;
  label: string;
};

function isPositiveNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9) {
    return String(Math.round(value));
  }
  return String(Number(value.toFixed(2)));
}

export const productMeasureSchema = z
  .object({
    unit: z.enum(PRODUCT_MEASURE_UNITS),
    value: z.number().positive().nullable().optional(),
    width: z.number().positive().nullable().optional(),
    length: z.number().positive().nullable().optional(),
    height: z.number().positive().nullable().optional(),
    sortOrder: z.number().int().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.unit === "CM") {
      if (!isPositiveNumber(data.width)) {
        ctx.addIssue({
          code: "custom",
          path: ["width"],
          message: "Informe a largura em cm",
        });
      }
      if (!isPositiveNumber(data.length)) {
        ctx.addIssue({
          code: "custom",
          path: ["length"],
          message: "Informe o comprimento em cm",
        });
      }
      if (
        data.height != null &&
        data.height !== undefined &&
        !isPositiveNumber(data.height)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["height"],
          message: "Altura inválida",
        });
      }
      return;
    }
    if (!isPositiveNumber(data.value)) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Informe um valor maior que zero",
      });
    }
  });

export const productMeasuresSchema = z.array(productMeasureSchema);

/** Formata medida para chip (ex.: 90g, 1kg, 250ml, 10×20cm). */
export function formatMeasureLabel(measure: {
  unit: ProductMeasureUnitCode | ProductMeasureUnit;
  value?: number | null;
  width?: number | null;
  length?: number | null;
  height?: number | null;
}): string {
  const unit = measure.unit as ProductMeasureUnitCode;
  const suffix = productMeasureUnitLabels[unit] ?? unit;

  if (unit === "CM") {
    const parts = [measure.width, measure.length]
      .filter(isPositiveNumber)
      .map(formatNumber);
    if (isPositiveNumber(measure.height)) {
      parts.push(formatNumber(measure.height));
    }
    if (parts.length >= 2) return `${parts.join("×")}${suffix}`;
    if (parts.length === 1) return `${parts[0]}${suffix}`;
    // legado: cm com um único value
    if (isPositiveNumber(measure.value)) {
      return `${formatNumber(measure.value)}${suffix}`;
    }
    return suffix;
  }

  if (!isPositiveNumber(measure.value)) return suffix;
  return `${formatNumber(measure.value)}${suffix}`;
}

export function normalizeProductMeasures(
  input: ProductMeasureInput[] | undefined
): Array<{
  unit: ProductMeasureUnitCode;
  value: number | null;
  width: number | null;
  length: number | null;
  height: number | null;
  sortOrder: number;
}> {
  if (!input?.length) return [];

  const normalized: Array<{
    unit: ProductMeasureUnitCode;
    value: number | null;
    width: number | null;
    length: number | null;
    height: number | null;
    sortOrder: number;
  }> = [];

  for (const [index, item] of input.entries()) {
    if (!PRODUCT_MEASURE_UNITS.includes(item.unit)) continue;

    if (item.unit === "CM") {
      const width = Number(item.width);
      const length = Number(item.length);
      const heightRaw = item.height;
      const height =
        heightRaw == null || heightRaw === undefined
          ? null
          : Number(heightRaw);
      if (!isPositiveNumber(width) || !isPositiveNumber(length)) continue;
      if (height != null && !isPositiveNumber(height)) continue;
      normalized.push({
        unit: "CM",
        value: null,
        width,
        length,
        height: isPositiveNumber(height) ? height : null,
        sortOrder: item.sortOrder ?? index,
      });
      continue;
    }

    const value = Number(item.value);
    if (!isPositiveNumber(value)) continue;
    normalized.push({
      unit: item.unit,
      value,
      width: null,
      length: null,
      height: null,
      sortOrder: item.sortOrder ?? index,
    });
  }

  return normalized.map((item, index) => ({ ...item, sortOrder: index }));
}

export function mapProductMeasuresToView(
  measures:
    | Array<{
        id?: string;
        unit: ProductMeasureUnitCode | ProductMeasureUnit;
        value?: number | null;
        width?: number | null;
        length?: number | null;
        height?: number | null;
        sortOrder: number;
      }>
    | undefined
): ProductMeasureView[] {
  if (!measures?.length) return [];
  return [...measures]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => ({
      id: m.id,
      unit: m.unit as ProductMeasureUnitCode,
      value: m.value ?? null,
      width: m.width ?? null,
      length: m.length ?? null,
      height: m.height ?? null,
      sortOrder: m.sortOrder,
      label: formatMeasureLabel(m),
    }));
}

type Tx = Prisma.TransactionClient;

export async function replaceProductMeasures(
  tx: Tx,
  productId: string,
  measuresInput: ProductMeasureInput[] | undefined
) {
  const measures = normalizeProductMeasures(measuresInput);
  await tx.productMeasure.deleteMany({ where: { productId } });
  if (!measures.length) return;

  await tx.productMeasure.createMany({
    data: measures.map((m, index) => ({
      productId,
      unit: m.unit,
      value: m.value,
      width: m.width,
      length: m.length,
      height: m.height,
      sortOrder: m.sortOrder ?? index,
    })),
  });
}
