/**
 * Repara produtos ainda negativos em pedidos já DELIVERED (encomenda).
 * Uso: node scripts/repair-delivered-backorders.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseOptions(optionsJson) {
  if (!optionsJson) return null;
  try {
    return JSON.parse(optionsJson);
  } catch {
    return null;
  }
}

async function main() {
  const orders = await prisma.order.findMany({
    where: { status: "DELIVERED" },
    include: { items: true },
  });

  let fixed = 0;
  let skipped = 0;

  for (const order of orders) {
    for (const item of order.items) {
      const options = parseOptions(item.optionsJson);
      if (!options?.isEncomenda) {
        skipped += 1;
        continue;
      }

      const product = await prisma.product.findFirst({
        where: { id: item.productId, storeId: order.storeId },
      });
      if (!product) continue;

      if (product.quantity >= 0) {
        skipped += 1;
        continue;
      }

      const backorder = -product.quantity;
      const addQty = Math.min(item.quantity, backorder);
      if (addQty <= 0) {
        skipped += 1;
        continue;
      }

      const newQty = product.quantity + addQty;
      await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: product.id },
          data: { quantity: newQty },
        });
        await tx.inventoryMovement.create({
          data: {
            storeId: order.storeId,
            productId: item.productId,
            type: "MANUAL_IN",
            quantity: addQty,
            balanceAfter: newQty,
            orderId: order.id,
            note: `Confecção entregue pedido ${order.id} (reparo)`,
          },
        });
      });

      console.log(
        `OK pedido ${order.orderNumber ?? order.id}: ${product.name} ${product.quantity} → ${newQty}`
      );
      fixed += 1;
    }
  }

  console.log(`Concluído: ${fixed} reparos, ${skipped} ignorados.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
