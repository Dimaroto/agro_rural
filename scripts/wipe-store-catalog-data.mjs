/**
 * Apaga dados de teste da loja (produtos, categorias, pedidos, vendas, financeiro).
 * Mantém: store, usuários admin e FinancialSettings.
 *
 * Uso: DATABASE_URL=... node scripts/wipe-store-catalog-data.mjs [storeSlug]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const storeSlug = process.argv[2] || "saboart";

async function main() {
  const store = await prisma.store.findFirst({ where: { slug: storeSlug } });
  if (!store) {
    throw new Error(`Loja "${storeSlug}" não encontrada`);
  }

  const storeId = store.id;
  console.log(`Limpando loja ${store.name} (${storeId})…`);

  const orderIds = (
    await prisma.order.findMany({
      where: { storeId },
      select: { id: true },
    })
  ).map((o) => o.id);

  if (orderIds.length > 0) {
    const payments = await prisma.payment.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    console.log(`Pagamentos: ${payments.count}`);
    const items = await prisma.orderItem.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    console.log(`Itens de pedido: ${items.count}`);
  }

  const orders = await prisma.order.deleteMany({ where: { storeId } });
  console.log(`Pedidos: ${orders.count}`);

  const movements = await prisma.inventoryMovement.deleteMany({
    where: { storeId },
  });
  console.log(`Movimentos de estoque: ${movements.count}`);

  const productIds = (
    await prisma.product.findMany({
      where: { storeId },
      select: { id: true },
    })
  ).map((p) => p.id);

  if (productIds.length > 0) {
    const fieldIds = (
      await prisma.productCustomizationField.findMany({
        where: { productId: { in: productIds } },
        select: { id: true },
      })
    ).map((f) => f.id);

    if (fieldIds.length > 0) {
      const opts = await prisma.productCustomizationFieldOption.deleteMany({
        where: { fieldId: { in: fieldIds } },
      });
      console.log(`Opções de campos: ${opts.count}`);
    }

    const fields = await prisma.productCustomizationField.deleteMany({
      where: { productId: { in: productIds } },
    });
    console.log(`Campos personalizados: ${fields.count}`);

    const links = await prisma.productCategory.deleteMany({
      where: { productId: { in: productIds } },
    });
    console.log(`Vínculos produto-categoria: ${links.count}`);
  }

  const products = await prisma.product.deleteMany({ where: { storeId } });
  console.log(`Produtos: ${products.count}`);

  const categories = await prisma.category.deleteMany({ where: { storeId } });
  console.log(`Categorias: ${categories.count}`);

  const customers = await prisma.customer.deleteMany({ where: {} });
  console.log(`Clientes: ${customers.count}`);

  const entries = await prisma.financialEntry.deleteMany({ where: { storeId } });
  console.log(`Lançamentos financeiros: ${entries.count}`);

  const payables = await prisma.payableAccount.deleteMany({
    where: { storeId },
  });
  console.log(`Contas a pagar: ${payables.count}`);

  const expenseCats = await prisma.expenseCategory.deleteMany({
    where: { storeId },
  });
  console.log(`Categorias de despesa: ${expenseCats.count}`);

  const subs = await prisma.subscription.deleteMany({ where: { storeId } });
  console.log(`Assinaturas: ${subs.count}`);

  const taxes = await prisma.taxRecord.deleteMany({ where: { storeId } });
  console.log(`Registros fiscais: ${taxes.count}`);

  const webhooks = await prisma.processedWebhookEvent.deleteMany({});
  console.log(`Webhooks processados: ${webhooks.count}`);

  await prisma.store.update({
    where: { id: storeId },
    data: {
      nextOrderNumber: 1,
      nextProductCode: 1,
    },
  });

  await prisma.financialSettings.upsert({
    where: { storeId },
    create: {
      storeId,
      openingBalanceCents: 0,
      defaultCurrency: "BRL",
      notes: null,
    },
    update: {
      openingBalanceCents: 0,
      notes: null,
    },
  });

  console.log("Contadores da loja reiniciados (pedidos/produtos em 1).");
  console.log("Concluído. Store e usuários admin preservados.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
