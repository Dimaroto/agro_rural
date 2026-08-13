import type {
  PartyFavorFieldAnswer,
  ProductFieldType,
} from "./party-favor-fields";

export type CartCustomization = {
  fieldAnswers?: PartyFavorFieldAnswer[];
  splitInstanceId?: string;
};

function stableFieldAnswersKey(answers?: PartyFavorFieldAnswer[]) {
  if (!answers?.length) return "_";
  return answers
    .slice()
    .sort((a, b) => a.fieldId.localeCompare(b.fieldId))
    .map((a) => `${a.fieldId}=${a.optionId ?? a.value}`)
    .join("|");
}

export function buildCartLineKey(
  productId: string,
  customization?: CartCustomization
) {
  const fieldsKey = stableFieldAnswersKey(customization?.fieldAnswers);
  if (customization?.splitInstanceId) {
    return `${productId}:split:${customization.splitInstanceId}:${fieldsKey}`;
  }
  return `${productId}:${fieldsKey}`;
}

export function splitCartLine<
  T extends {
    lineKey: string;
    quantity: number;
    product: { id: string };
    fieldAnswers?: PartyFavorFieldAnswer[];
    notes?: string;
    splitInstanceId?: string;
  },
>(cart: T[], lineKey: string): T[] {
  const index = cart.findIndex((item) => item.lineKey === lineKey);
  if (index < 0) return cart;
  const item = cart[index];
  if (item.quantity < 2) return cart;

  const splitInstanceId = `s${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const splitCustomization: CartCustomization = {
    fieldAnswers: undefined,
    splitInstanceId,
  };
  const newLineKey = buildCartLineKey(item.product.id, splitCustomization);

  const next = [...cart];
  next[index] = { ...item, quantity: item.quantity - 1 };
  next.splice(index + 1, 0, {
    ...item,
    quantity: 1,
    fieldAnswers: undefined,
    splitInstanceId,
    notes: undefined,
    lineKey: newLineKey,
  });
  return next;
}

export function parseOrderOptions(
  optionsJson: string | null | undefined
): CartCustomization | null {
  if (!optionsJson) return null;
  try {
    const parsed = JSON.parse(optionsJson) as CartCustomization & {
      kind?: string;
    };
    if (parsed.kind === "kit_packaging") return null;
    const hasFields = Boolean(parsed.fieldAnswers?.length);
    if (!hasFields) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function stockLinesFromOrderItems(
  items: Array<{
    productId: string | null;
    quantity: number;
    optionsJson?: string | null;
  }>
) {
  return items.flatMap((item) => {
    if (!item.productId) return [];
    const options = parseOrderOptions(item.optionsJson);
    if (
      options &&
      "kind" in options &&
      (options as { kind?: string }).kind === "kit_packaging"
    ) {
      return [];
    }
    return [
      {
        productId: item.productId,
        quantity: item.quantity,
      },
    ];
  });
}

export function formatFieldAnswersLabel(
  answers: PartyFavorFieldAnswer[] | undefined
) {
  if (!answers?.length) return "";
  return answers
    .map((answer) => `${answer.fieldLabel}: ${answer.value}`)
    .join(" · ");
}

export function formatOrderOptionsLabel(options: CartCustomization | null) {
  if (!options) return "";
  const fields = formatFieldAnswersLabel(options.fieldAnswers);
  return fields ? ` (${fields})` : "";
}

export function formatCartCustomizationSummary(
  customization: CartCustomization | undefined
) {
  if (!customization?.fieldAnswers?.length) return null;
  return formatFieldAnswersLabel(customization.fieldAnswers) || null;
}

export function validateProductFieldAnswers(
  fields: Array<{
    id: string;
    label: string;
    type: ProductFieldType;
    required: boolean;
    options: Array<{ id: string; label: string }>;
  }>,
  answers: PartyFavorFieldAnswer[] | undefined
): string | null {
  const byId = new Map((answers ?? []).map((a) => [a.fieldId, a]));

  for (const field of fields) {
    const answer = byId.get(field.id);
    const value = answer?.value?.trim() ?? "";

    if (field.required && !value) {
      return `Preencha o campo "${field.label}".`;
    }

    if (!value) continue;

    if (field.type === "SELECT") {
      const option = field.options.find(
        (o) => o.id === answer?.optionId || o.label === value
      );
      if (!option) {
        return `Opção inválida para "${field.label}".`;
      }
    }
  }

  return null;
}

export type CartItemCustomizationInput = {
  fieldAnswers?: PartyFavorFieldAnswer[];
  product: {
    name: string;
    customizationFields?: Array<{
      id: string;
      label: string;
      type: ProductFieldType;
      required: boolean;
      options: Array<{ id: string; label: string }>;
    }>;
  };
};

export function validateCartItemCustomization(
  item: CartItemCustomizationInput
): string | null {
  return validateProductFieldAnswers(
    item.product.customizationFields ?? [],
    item.fieldAnswers
  );
}

export function validateCartItemsCustomization(
  items: CartItemCustomizationInput[]
): string | null {
  for (const item of items) {
    const error = validateCartItemCustomization(item);
    if (error) return `${item.product.name}: ${error}`;
  }
  return null;
}
