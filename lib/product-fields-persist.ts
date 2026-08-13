import type { Prisma } from "@prisma/client";
import {
  mapProductFieldsToView,
  normalizeProductFields,
  type ProductFieldInput,
  type ProductFieldView,
} from "./party-favor-fields";

export const productFieldsInclude = {
  customizationFields: {
    include: {
      options: {
        orderBy: [{ sortOrder: "asc" as const }, { label: "asc" as const }],
      },
    },
    orderBy: [{ sortOrder: "asc" as const }, { label: "asc" as const }],
  },
} satisfies Prisma.ProductInclude;

type Tx = Prisma.TransactionClient;

export async function replaceProductCustomizationFields(
  tx: Tx,
  productId: string,
  fieldsInput: ProductFieldInput[] | undefined
) {
  const fields = normalizeProductFields(fieldsInput);

  await tx.productCustomizationFieldOption.deleteMany({
    where: { field: { productId } },
  });
  await tx.productCustomizationField.deleteMany({
    where: { productId },
  });

  for (const [index, field] of fields.entries()) {
    await tx.productCustomizationField.create({
      data: {
        productId,
        label: field.label,
        type: field.type,
        required: field.required ?? true,
        sortOrder: field.sortOrder ?? index,
        options:
          field.type === "SELECT"
            ? {
                create: (field.options ?? []).map((option, optionIndex) => ({
                  label: option.label,
                  sortOrder: option.sortOrder ?? optionIndex,
                })),
              }
            : undefined,
      },
    });
  }
}

export function projectProductFields(
  fields:
    | Array<{
        id: string;
        label: string;
        type: "TEXT" | "SELECT";
        required: boolean;
        sortOrder: number;
        options: Array<{ id: string; label: string; sortOrder: number }>;
      }>
    | undefined
): ProductFieldView[] {
  if (!fields?.length) return [];
  return mapProductFieldsToView(fields);
}
