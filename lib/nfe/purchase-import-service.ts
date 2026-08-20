import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PublicApiError } from "@/lib/public-api-error";
import {
  barcodeFromPurchaseItem,
  skuFromPurchaseItem,
  type ParsedPurchaseNfe,
  type PurchaseItem,
} from "@/lib/nfe/purchase-xml-parser";
import { createLedgerEntry, ensureDefaultFinanceCategories } from "@/lib/finance-ledger";

export type ConfirmItemOverride = {
  index: number;
  priceCents: number;
  productId?: string | null;
  skipStock?: boolean;
};

export type PurchasePreview = {
  alreadyImported: boolean;
  existingInvoiceId: string | null;
  nota: ParsedPurchaseNfe;
  supplier: {
    existing: boolean;
    id: string | null;
    name: string;
    document: string;
    ie: string | null;
    city: string | null;
    state: string | null;
  };
  items: Array<{
    index: number;
    item: PurchaseItem;
    match: {
      productId: string;
      name: string;
      code: number;
      quantity: number;
      priceCents: number;
      custoCents: number | null;
    } | null;
    suggestedPriceCents: number;
    barcode: string | null;
    sku: string | null;
  }>;
  charges: ParsedPurchaseNfe["charges"];
};

function qtyInt(q: number): number {
  const n = Math.round(q);
  return n > 0 ? n : Math.max(1, Math.floor(q));
}

export async function previewPurchaseImport(
  storeId: string,
  nota: ParsedPurchaseNfe
): Promise<PurchasePreview> {
  const existing = await prisma.purchaseInvoice.findUnique({
    where: { storeId_accessKey: { storeId, accessKey: nota.accessKey } },
  });

  let supplierExisting = null as Awaited<
    ReturnType<typeof prisma.supplier.findFirst>
  >;
  if (nota.emitenteDoc) {
    supplierExisting = await prisma.supplier.findUnique({
      where: {
        storeId_document: { storeId, document: nota.emitenteDoc },
      },
    });
  }

  const items = [];
  for (let i = 0; i < nota.items.length; i++) {
    const item = nota.items[i]!;
    const sku = skuFromPurchaseItem(item);
    const barcode = barcodeFromPurchaseItem(item);
    let match = null as PurchasePreview["items"][0]["match"];

    if (sku) {
      const codeNum = Number(sku);
      if (Number.isFinite(codeNum) && codeNum > 0) {
        const byCode = await prisma.product.findFirst({
          where: { storeId, code: codeNum },
        });
        if (byCode) {
          match = {
            productId: byCode.id,
            name: byCode.name,
            code: byCode.code,
            quantity: byCode.quantity,
            priceCents: byCode.priceCents,
            custoCents: byCode.custoCents,
          };
        }
      }
    }
    if (!match && barcode) {
      const byBar = await prisma.product.findFirst({
        where: { storeId, barcode },
      });
      if (byBar) {
        match = {
          productId: byBar.id,
          name: byBar.name,
          code: byBar.code,
          quantity: byBar.quantity,
          priceCents: byBar.priceCents,
          custoCents: byBar.custoCents,
        };
      }
    }

    items.push({
      index: i,
      item,
      match,
      suggestedPriceCents: match?.priceCents ?? item.unitCostCents,
      barcode,
      sku,
    });
  }

  return {
    alreadyImported: !!existing,
    existingInvoiceId: existing?.id ?? null,
    nota,
    supplier: {
      existing: !!supplierExisting,
      id: supplierExisting?.id ?? null,
      name: supplierExisting?.name ?? nota.emitenteName,
      document: supplierExisting?.document ?? nota.emitenteDoc,
      ie: supplierExisting?.ie ?? nota.emitenteIe,
      city: supplierExisting?.city ?? nota.emitenteCity,
      state: supplierExisting?.state ?? nota.emitenteUf,
    },
    items,
    charges: nota.charges,
  };
}

export async function confirmPurchaseImport(
  storeId: string,
  nota: ParsedPurchaseNfe,
  opts: {
    categoryLabel?: string;
    itemOverrides?: ConfirmItemOverride[];
    chargeDueDates?: Record<string, string | null>;
  } = {}
) {
  const existing = await prisma.purchaseInvoice.findUnique({
    where: { storeId_accessKey: { storeId, accessKey: nota.accessKey } },
  });
  if (existing) {
    return {
      ok: false as const,
      message: `Esta NF-e já foi importada (nº ${existing.number}).`,
    };
  }

  const overrideMap = new Map(
    (opts.itemOverrides ?? []).map((o) => [o.index, o])
  );

  return prisma.$transaction(async (tx) => {
    await ensureDefaultFinanceCategories(storeId, tx);

    let supplier = nota.emitenteDoc
      ? await tx.supplier.findUnique({
          where: {
            storeId_document: { storeId, document: nota.emitenteDoc },
          },
        })
      : null;

    let supplierCreated = false;
    if (!supplier && nota.emitenteDoc) {
      supplier = await tx.supplier.create({
        data: {
          storeId,
          name: nota.emitenteName,
          document: nota.emitenteDoc,
          ie: nota.emitenteIe,
          phone: nota.emitentePhone,
          street: nota.emitenteStreet,
          number: nota.emitenteNumber,
          complement: nota.emitenteComplement,
          district: nota.emitenteDistrict,
          city: nota.emitenteCity,
          state: nota.emitenteUf,
          zipCode: nota.emitenteZip,
          cityCode: nota.emitenteCityCode,
        },
      });
      supplierCreated = true;
    }

    const invoice = await tx.purchaseInvoice.create({
      data: {
        storeId,
        supplierId: supplier?.id ?? null,
        accessKey: nota.accessKey,
        number: nota.number,
        series: nota.series,
        model: nota.model,
        issuedAt: new Date(nota.issuedAt),
        totalCents: nota.totalCents,
        bcIcmsCents: nota.bcIcmsCents,
        icmsCents: nota.icmsCents,
        pisCents: nota.pisCents,
        cofinsCents: nota.cofinsCents,
        paymentMethod: nota.paymentMethod,
        invoiceNumber: nota.invoiceNumber,
        xmlContent: nota.xmlContent,
        emitenteName: nota.emitenteName,
        emitenteDoc: nota.emitenteDoc,
      },
    });

    let itemsCreated = 0;
    let itemsUpdated = 0;
    const defaultCategory = await tx.category.findFirst({
      where: { storeId },
      orderBy: { name: "asc" },
    });
    if (!defaultCategory) {
      throw new PublicApiError(
        "Cadastre ao menos uma categoria de produto antes de importar."
      );
    }

    for (let i = 0; i < nota.items.length; i++) {
      const item = nota.items[i]!;
      const ov = overrideMap.get(i);
      if (ov?.skipStock) {
        await tx.purchaseInvoiceItem.create({
          data: {
            purchaseInvoiceId: invoice.id,
            productId: ov.productId ?? null,
            lineNumber: i + 1,
            supplierCode: item.supplierCode || null,
            barcode: barcodeFromPurchaseItem(item),
            name: item.name,
            ncm: item.ncm,
            cfop: item.cfop,
            unit: item.unit,
            quantity: item.quantity,
            unitCostCents: item.unitCostCents,
            totalCents: item.totalCents,
            origin: item.origin,
            csosn: item.csosn,
          },
        });
        continue;
      }

      const barcode = barcodeFromPurchaseItem(item);
      const skuHint = skuFromPurchaseItem(item);
      let product =
        (ov?.productId
          ? await tx.product.findFirst({
              where: { id: ov.productId, storeId },
            })
          : null) ??
        (barcode
          ? await tx.product.findFirst({ where: { storeId, barcode } })
          : null);

      if (!product && skuHint) {
        const codeNum = Number(skuHint);
        if (Number.isFinite(codeNum) && codeNum > 0) {
          product = await tx.product.findFirst({
            where: { storeId, code: codeNum },
          });
        }
      }

      const addQty = qtyInt(item.quantity);
      const priceCents = ov?.priceCents ?? product?.priceCents ?? item.unitCostCents;

      if (product) {
        const newQty = product.quantity + addQty;
        await tx.product.update({
          where: { id: product.id },
          data: {
            quantity: newQty,
            custoCents: item.unitCostCents,
            priceCents,
            ncm: item.ncm ?? product.ncm,
            cfopDefault: item.cfop ?? product.cfopDefault,
            csosn: item.csosn ?? product.csosn,
            origemMercadoria: item.origin ?? product.origemMercadoria,
            unidadeComercial: item.unit || product.unidadeComercial,
            barcode: product.barcode ?? barcode,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            storeId,
            productId: product.id,
            type: "NFE_PURCHASE",
            quantity: addQty,
            balanceAfter: newQty,
            note: `NF-e ${nota.number} chave ${nota.accessKey}`,
          },
        });
        itemsUpdated++;
      } else {
        const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
        const code = store.nextProductCode;
        await tx.store.update({
          where: { id: storeId },
          data: { nextProductCode: code + 1 },
        });
        product = await tx.product.create({
          data: {
            storeId,
            categoryId: defaultCategory.id,
            name: item.name,
            code,
            barcode: barcode ?? undefined,
            priceCents,
            custoCents: item.unitCostCents,
            quantity: addQty,
            ncm: item.ncm,
            cfopDefault: item.cfop ?? "5102",
            csosn: item.csosn ?? "102",
            origemMercadoria: item.origin ?? "0",
            unidadeComercial: item.unit || "UN",
            categoryLinks: {
              create: { categoryId: defaultCategory.id },
            },
          },
        });
        await tx.inventoryMovement.create({
          data: {
            storeId,
            productId: product.id,
            type: "NFE_PURCHASE",
            quantity: addQty,
            balanceAfter: addQty,
            note: `NF-e ${nota.number} (novo produto)`,
          },
        });
        itemsCreated++;
      }

      await tx.purchaseInvoiceItem.create({
        data: {
          purchaseInvoiceId: invoice.id,
          productId: product.id,
          lineNumber: i + 1,
          supplierCode: item.supplierCode || null,
          barcode,
          name: item.name,
          ncm: item.ncm,
          cfop: item.cfop,
          unit: item.unit,
          quantity: item.quantity,
          unitCostCents: item.unitCostCents,
          totalCents: item.totalCents,
          origin: item.origin,
          csosn: item.csosn,
        },
      });
    }

    let lancamentosCriados = 0;
    let lancamentosIgnorados = 0;
    const categoryLabel = opts.categoryLabel ?? "Compras / Fornecedores";

    for (let i = 0; i < nota.charges.length; i++) {
      const charge = nota.charges[i]!;
      const dueOverride = opts.chargeDueDates?.[charge.number];
      const due = dueOverride !== undefined ? dueOverride : charge.dueDate;
      if (!due) {
        lancamentosIgnorados++;
        continue;
      }
      const dupKey =
        charge.number.trim() || String(i + 1).padStart(3, "0");
      const dedupeKey = `nfe_${nota.accessKey}_${dupKey}`;
      try {
        await createLedgerEntry(
          storeId,
          {
            type: "EXPENSE",
            status: "PENDING",
            description: `NF-e ${nota.number} parc. ${dupKey} — ${nota.emitenteName}`,
            amountCents: charge.amountCents,
            entryDate: due,
            categoryLabel,
            paymentMethod: charge.paymentMethod,
            supplierId: supplier?.id,
            supplierName: supplier?.name ?? nota.emitenteName,
            purchaseInvoiceId: invoice.id,
            nfeKey: nota.accessKey,
            installmentNo: dupKey,
            dedupeKey,
          },
          tx
        );
        lancamentosCriados++;
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          lancamentosIgnorados++;
          continue;
        }
        throw e;
      }
    }

    return {
      ok: true as const,
      invoiceId: invoice.id,
      supplierId: supplier?.id ?? null,
      supplierCreated,
      itemsCreated,
      itemsUpdated,
      lancamentosCriados,
      lancamentosIgnorados,
    };
  });
}
