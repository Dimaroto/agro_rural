import { PrismaClient, OrderStatus, PaymentStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.findUnique({ where: { slug: "minha-loja" } });
  if (!store) throw new Error("Loja minha-loja não encontrada. Rode: npm run db:seed");

  const products = await prisma.product.findMany({
    where: { storeId: store.id, active: true },
    take: 3,
    orderBy: { name: "asc" },
  });
  if (products.length < 2) throw new Error("Produtos insuficientes. Rode: npm run db:seed");

  const pendingItems = [
    { product: products[0], quantity: 2 },
    { product: products[1], quantity: 1 },
  ];
  const pendingTotal = pendingItems.reduce(
    (sum, { product, quantity }) => sum + product.priceCents * quantity,
    0
  );
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const pendingOrder = await prisma.order.create({
    data: {
      storeId: store.id,
      status: OrderStatus.AWAITING_PIX,
      customerName: "João Silva",
      customerPhone: "5511987654321",
      totalCents: pendingTotal,
      pixExpiresAt: expiresAt,
      items: {
        create: pendingItems.map(({ product, quantity }) => ({
          productId: product.id,
          productName: product.name,
          quantity,
          unitPriceCents: product.priceCents,
        })),
      },
      payment: {
        create: {
          provider: "mock",
          externalId: `mock-${Date.now()}-pending`,
          status: PaymentStatus.PENDING,
          pixCopyPaste: `00020126580014BR.GOV.BCB.PIX0136MOCK-DEMO-PENDING520400005303986540${(pendingTotal / 100).toFixed(2)}5802BR5925Catalogo Demo6009SAO PAULO62070503***6304ABCD`,
        },
      },
    },
  });

  const paidItems = [{ product: products[2] ?? products[0], quantity: 1 }];
  const paidTotal = paidItems.reduce(
    (sum, { product, quantity }) => sum + product.priceCents * quantity,
    0
  );

  const paidOrder = await prisma.order.create({
    data: {
      storeId: store.id,
      status: OrderStatus.PAID,
      customerName: "Maria Santos",
      customerPhone: "5511912345678",
      totalCents: paidTotal,
      items: {
        create: paidItems.map(({ product, quantity }) => ({
          productId: product.id,
          productName: product.name,
          quantity,
          unitPriceCents: product.priceCents,
        })),
      },
      payment: {
        create: {
          provider: "mock",
          externalId: `mock-${Date.now()}-paid`,
          status: PaymentStatus.APPROVED,
          paidAt: new Date(),
          pixCopyPaste: `00020126580014BR.GOV.BCB.PIX0136MOCK-DEMO-PAID520400005303986540${(paidTotal / 100).toFixed(2)}5802BR5925Catalogo Demo6009SAO PAULO62070503***6304ABCD`,
        },
      },
    },
  });

  console.log(JSON.stringify({
    pending: {
      id: pendingOrder.id,
      url: `http://localhost:3000/pedido/${pendingOrder.id}`,
    },
    paid: {
      id: paidOrder.id,
      url: `http://localhost:3000/pedido/${paidOrder.id}`,
    },
    admin: "http://localhost:3000/admin/pedidos",
  }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
