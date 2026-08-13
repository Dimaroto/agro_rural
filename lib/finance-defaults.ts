export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Salários", slug: "salarios", sortOrder: 1 },
  { name: "Marketing", slug: "marketing", sortOrder: 2 },
  { name: "Servidores", slug: "servidores", sortOrder: 3 },
  { name: "Impostos", slug: "impostos", sortOrder: 4 },
  { name: "Aluguel", slug: "aluguel", sortOrder: 5 },
  { name: "Fornecedores", slug: "fornecedores", sortOrder: 6 },
  { name: "Outros", slug: "outros", sortOrder: 7 },
] as const;

export async function ensureExpenseCategories(storeId: string) {
  const { prisma } = await import("@/lib/db");
  for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { storeId_slug: { storeId, slug: cat.slug } },
      update: { name: cat.name, sortOrder: cat.sortOrder },
      create: { storeId, ...cat },
    });
  }
}

export async function ensureFinancialSettings(storeId: string) {
  const { prisma } = await import("@/lib/db");
  return prisma.financialSettings.upsert({
    where: { storeId },
    update: {},
    create: {
      storeId,
      openingBalanceCents: 0,
      defaultCurrency: "BRL",
    },
  });
}
