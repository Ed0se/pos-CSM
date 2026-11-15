import crypto from 'crypto';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import * as inventoryRepo from '../repositories/inventory.repository.js';
import * as salesRepo from '../repositories/sales.repository.js';
import { resolveHermosilloDateRange } from '../utils/date.js';
import { ConflictError, NotFoundError, UnprocessableError } from '../utils/errors.js';
import { buildSalesReportPdf } from '../utils/pdf-report.js';
import { CreateSaleInput, PaymentMethod } from '../validators/sales.validator.js';

interface NormalizedSaleItem {
  variant_id: number;
  quantity: number;
}

interface MysqlErrorLike {
  code?: string;
  errno?: number;
  sqlMessage?: string;
}

function isDuplicateKeyError(err: unknown): err is MysqlErrorLike {
  if (!err || typeof err !== 'object') return false;
  const e = err as MysqlErrorLike;
  return e.code === 'ER_DUP_ENTRY' || e.errno === 1062;
}

function normalizeAndCombineItems(items: CreateSaleInput['items']): NormalizedSaleItem[] {
  const byVariant = new Map<number, number>();
  for (const item of items) {
    byVariant.set(item.variant_id, (byVariant.get(item.variant_id) ?? 0) + item.quantity);
  }
  return Array.from(byVariant.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([variant_id, quantity]) => ({ variant_id, quantity }));
}

function computeFingerprint(
  normalizedItems: NormalizedSaleItem[],
  paymentMethod: PaymentMethod,
  amountReceivedCents?: number
): string {
  const canonical = JSON.stringify({
    items: normalizedItems,
    payment_method: paymentMethod,
    amount_received_cents: amountReceivedCents ?? null
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export async function createSale(
  idempotencyKey: string,
  input: CreateSaleInput
): Promise<{ sale: salesRepo.SaleDetailDto; replayed: boolean }> {
  const normalizedItems = normalizeAndCombineItems(input.items);
  const fingerprint = computeFingerprint(
    normalizedItems,
    input.payment_method,
    input.amount_received_cents
  );

  const conn = await pool.getConnection();
  let createdSaleId: number | null = null;
  let replayedSaleId: number | null = null;

  try {
    await conn.beginTransaction();

    // 1. Verificar idempotencia dentro de la transacción
    const existingByKey = await salesRepo.findByIdempotencyKeyForUpdate(conn, idempotencyKey);
    if (existingByKey) {
      if (existingByKey.request_fingerprint !== fingerprint) {
        await conn.rollback();
        throw new ConflictError(
          'IDEMPOTENCY_CONFLICT',
          'La clave de idempotencia ya fue utilizada con una solicitud diferente'
        );
      }
      await conn.commit();
      replayedSaleId = Number(existingByKey.id);
    } else {
      // 2. Bloquear variantes ordenadas por ID ascendente (SELECT ... FOR UPDATE)
      const requestedIds = normalizedItems.map((i) => i.variant_id);
      const lockedVariants = await salesRepo.lockVariantsOrderedById(conn, requestedIds);
      const variantMap = new Map(lockedVariants.map((v) => [Number(v.id), v]));

      const missingIds = requestedIds.filter((id) => !variantMap.has(id));
      if (missingIds.length > 0) {
        await conn.rollback();
        throw new NotFoundError('Una o más variantes solicitadas no existen', {
          missing_variant_ids: missingIds
        });
      }

      // 3. Validar estado activo, existencias y calcular importes desde la DB en centavos enteros
      let subtotalCents = 0;
      const linePlans: Array<{
        variant: salesRepo.LockedVariantRow;
        quantity: number;
        unitPriceCents: number;
        lineTotalCents: number;
        stockAfter: number;
      }> = [];

      for (const item of normalizedItems) {
        const variant = variantMap.get(item.variant_id)!;

        if (!variant.product_active || !variant.variant_active) {
          await conn.rollback();
          throw new ConflictError(
            'PRODUCT_INACTIVE',
            `La prenda ${variant.product_name} (${variant.sku}) está inactiva`,
            { variant_id: Number(variant.id), sku: variant.sku }
          );
        }

        const currentStock = Number(variant.stock);
        if (currentStock < item.quantity) {
          await conn.rollback();
          throw new ConflictError('STOCK_INSUFFICIENT', 'Existencias insuficientes', {
            variant_id: Number(variant.id),
            sku: variant.sku,
            name: variant.product_name,
            size_label: variant.size_label,
            available: currentStock,
            requested: item.quantity
          });
        }

        const unitPriceCents = Number(variant.unit_price_cents);
        const lineTotalCents = item.quantity * unitPriceCents;
        subtotalCents += lineTotalCents;

        linePlans.push({
          variant,
          quantity: item.quantity,
          unitPriceCents,
          lineTotalCents,
          stockAfter: currentStock - item.quantity
        });
      }

      const discountCents = 0;
      const totalCents = subtotalCents - discountCents;

      // Verificar si el precio cambió entre que se mostró el carrito y se confirmó el cobro
      if (input.expected_total_cents !== undefined && input.expected_total_cents !== totalCents) {
        await conn.rollback();
        throw new ConflictError(
          'PRICE_CHANGED',
          'El precio de uno o más artículos cambió antes de confirmar la venta',
          {
            expected_total_cents: input.expected_total_cents,
            actual_total_cents: totalCents
          }
        );
      }

      // 4. Validar pago y calcular cambio
      let amountReceivedCents = totalCents;
      let changeCents = 0;

      if (input.payment_method === 'CASH') {
        if (input.amount_received_cents === undefined) {
          await conn.rollback();
          throw new UnprocessableError(
            'PAYMENT_INSUFFICIENT',
            'El importe recibido en efectivo es obligatorio',
            { total_cents: totalCents }
          );
        }
        if (input.amount_received_cents < totalCents) {
          await conn.rollback();
          throw new UnprocessableError(
            'PAYMENT_INSUFFICIENT',
            'El importe recibido en efectivo es menor al total a pagar',
            {
              total_cents: totalCents,
              amount_received_cents: input.amount_received_cents
            }
          );
        }
        amountReceivedCents = input.amount_received_cents;
        changeCents = amountReceivedCents - totalCents;
      } else {
        if (
          input.amount_received_cents !== undefined &&
          input.amount_received_cents !== totalCents
        ) {
          await conn.rollback();
          throw new UnprocessableError(
            'PAYMENT_INSUFFICIENT',
            'En pagos con tarjeta o transferencia el importe recibido debe coincidir exactamente con el total',
            {
              total_cents: totalCents,
              amount_received_cents: input.amount_received_cents
            }
          );
        }
        amountReceivedCents = totalCents;
        changeCents = 0;
      }

      // 5. Insertar cabecera de venta y asignar folio CSM-00000001
      const { saleId, folio } = await salesRepo.insertSaleHeader(conn, {
        idempotencyKey,
        requestFingerprint: fingerprint,
        subtotalCents,
        discountCents,
        totalCents,
        paymentMethod: input.payment_method,
        amountReceivedCents,
        changeCents
      });

      // 6. Insertar líneas snapshot, descontar stock y registrar movimientos SALE
      for (const plan of linePlans) {
        const variantId = Number(plan.variant.id);
        await salesRepo.insertSaleItemSnapshot(conn, {
          saleId,
          variantId,
          productName: plan.variant.product_name,
          sizeLabel: plan.variant.size_label,
          color: plan.variant.color,
          sku: plan.variant.sku,
          quantity: plan.quantity,
          unitPriceCents: plan.unitPriceCents,
          lineTotalCents: plan.lineTotalCents
        });

        await salesRepo.decrementVariantStock(conn, variantId, plan.quantity);

        await inventoryRepo.insertStockMovement(conn, {
          variantId,
          saleId,
          kind: 'SALE',
          quantityDelta: -plan.quantity,
          stockAfter: plan.stockAfter,
          reason: `Venta ${folio}`
        });
      }

      await conn.commit();
      createdSaleId = saleId;
    }
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // Ignorar error de rollback si la transacción ya fue cerrada
    }

    // Manejar carrera concurrente sobre la misma Idempotency-Key en índice único
    if (isDuplicateKeyError(err) && (err.sqlMessage ?? '').includes('uq_sales_idempotency')) {
      const winner = await salesRepo.findByIdempotencyKey(idempotencyKey);
      if (winner) {
        if (winner.request_fingerprint !== fingerprint) {
          throw new ConflictError(
            'IDEMPOTENCY_CONFLICT',
            'La clave de idempotencia ya fue utilizada con una solicitud diferente'
          );
        }
        const replayedSale = await salesRepo.findSaleById(Number(winner.id));
        if (!replayedSale) {
          throw new Error('No se pudo recuperar la venta idempotente existente');
        }
        return { sale: replayedSale, replayed: true };
      }
    }

    throw err;
  } finally {
    conn.release();
  }

  const targetId = replayedSaleId ?? createdSaleId;
  if (targetId === null) {
    throw new Error('No se pudo determinar el identificador de la venta');
  }

  const sale = await salesRepo.findSaleById(targetId);
  if (!sale) {
    throw new Error('No se pudo recuperar la venta guardada');
  }

  return {
    sale,
    replayed: replayedSaleId !== null
  };
}

export async function getSaleById(id: number): Promise<salesRepo.SaleDetailDto> {
  const sale = await salesRepo.findSaleById(id);
  if (!sale) {
    throw new NotFoundError('Venta no encontrada');
  }
  return sale;
}

export async function listSales(params: {
  from?: string;
  to?: string;
  folio?: string;
  paymentMethod?: PaymentMethod;
  page: number;
  limit: number;
  offset: number;
}) {
  let fromUtcSql: string | undefined;
  let toUtcSql: string | undefined;

  if (params.from || params.to) {
    const range = resolveHermosilloDateRange(params.from, params.to);
    fromUtcSql = range.fromUtcSql;
    toUtcSql = range.toUtcSql;
  }

  const { data, total } = await salesRepo.findSales({
    fromUtcSql,
    toUtcSql,
    folio: params.folio,
    paymentMethod: params.paymentMethod,
    limit: params.limit,
    offset: params.offset
  });

  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total
    }
  };
}

export async function getSalesReport(params: { from?: string; to?: string }) {
  const range = resolveHermosilloDateRange(params.from, params.to);
  return salesRepo.getSalesReportData(range);
}

export async function generateSalesReportPdf(params: {
  from?: string;
  to?: string;
  folio?: string;
}): Promise<{ buffer: Buffer; filename: string }> {
  const range = resolveHermosilloDateRange(params.from, params.to);
  const [report, salesResult] = await Promise.all([
    salesRepo.getSalesReportData(range),
    salesRepo.findSales({
      fromUtcSql: range.fromUtcSql,
      toUtcSql: range.toUtcSql,
      folio: params.folio,
      limit: 1000,
      offset: 0
    })
  ]);

  const buffer = buildSalesReportPdf({
    report,
    sales: salesResult.data,
    salesTotal: salesResult.total,
    schoolName: env.TICKET_SCHOOL_NAME,
    folioFilter: params.folio
  });

  const filename = `reporte-ventas-csm-${range.from}_a_${range.to}.pdf`;
  return { buffer, filename };
}
