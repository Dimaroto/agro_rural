export type ProductFieldType = "TEXT" | "SELECT";

export type ProductFieldOptionInput = {
  id?: string;
  label: string;
  sortOrder?: number;
};

export type ProductFieldInput = {
  id?: string;
  label: string;
  type: ProductFieldType;
  required?: boolean;
  sortOrder?: number;
  options?: ProductFieldOptionInput[];
};

export type ProductFieldOptionView = {
  id: string;
  label: string;
  sortOrder: number;
};

export type ProductFieldView = {
  id: string;
  label: string;
  type: ProductFieldType;
  required: boolean;
  sortOrder: number;
  options: ProductFieldOptionView[];
};

export type PartyFavorFieldAnswer = {
  fieldId: string;
  fieldLabel: string;
  type: ProductFieldType;
  optionId?: string;
  value: string;
};

import { z } from "zod";

export const productFieldOptionSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Informe a opção"),
  sortOrder: z.number().int().optional(),
});

export const productFieldSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().min(1, "Informe o nome do campo"),
    type: z.enum(["TEXT", "SELECT"]),
    required: z.boolean().optional().default(true),
    sortOrder: z.number().int().optional(),
    options: z.array(productFieldOptionSchema).optional().default([]),
  })
  .superRefine((field, ctx) => {
    if (field.type === "SELECT") {
      const options = (field.options ?? []).filter((o) => o.label.trim());
      if (options.length < 1) {
        ctx.addIssue({
          code: "custom",
          message: `O campo "${field.label}" precisa de ao menos uma opção`,
          path: ["options"],
        });
      }
    }
  });

export const productFieldsSchema = z.array(productFieldSchema).max(20);

export const partyFavorFieldAnswerSchema = z.object({
  fieldId: z.string().min(1),
  fieldLabel: z.string().min(1),
  type: z.enum(["TEXT", "SELECT"]),
  optionId: z.string().optional(),
  value: z.string(),
});

export function normalizeProductFields(
  fields: ProductFieldInput[] | undefined
): ProductFieldInput[] {
  return (fields ?? [])
    .map((field, index) => ({
      ...field,
      label: field.label.trim(),
      sortOrder: field.sortOrder ?? index,
      required: field.required ?? true,
      options:
        field.type === "SELECT"
          ? (field.options ?? [])
              .map((option, optionIndex) => ({
                ...option,
                label: option.label.trim(),
                sortOrder: option.sortOrder ?? optionIndex,
              }))
              .filter((option) => option.label.length > 0)
          : [],
    }))
    .filter((field) => field.label.length > 0);
}

export function mapProductFieldsToView(
  fields: Array<{
    id: string;
    label: string;
    type: ProductFieldType;
    required: boolean;
    sortOrder: number;
    options: Array<{ id: string; label: string; sortOrder: number }>;
  }>
): ProductFieldView[] {
  return fields
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      required: field.required,
      sortOrder: field.sortOrder,
      options: field.options
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
        .map((option) => ({
          id: option.id,
          label: option.label,
          sortOrder: option.sortOrder,
        })),
    }));
}
