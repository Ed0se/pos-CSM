import { pool } from '../config/database.js';
import * as inventoryRepo from '../repositories/inventory.repository.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { CreateMovementInput } from '../validators/inventory.validator.js';

export async function getInventory(params: {
  q?: string;
  lowStock?: boolean;
  stockStatus?: 'OUT' | 'LOW' | 'OK';
  active?: boolean;
  page: number;
  limit: number;
  offset: number;
}) {
  const { data, total } = await inventoryRepo.findInventory({
    q: params.q,
    lowStock: params.lowStock,
    stockStatus: params.stockStatus,
    active: params.active,
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

export async function createManualMovement(input: CreateMovementInput) {
  const conn = await pool.getConnection();
  let movementId: number;
  let stockBefore = 0;

  try {
    await conn.beginTransaction();

    const variant = await inventoryRepo.lockVariantForMovement(conn, input.variant_id);
    if (!variant) {
      await conn.rollback();
      throw new NotFoundError('Variante no encontrada');
    }

    stockBefore = Number(variant.stock);
    const stockAfter = stockBefore + input.quantity_delta;

    if (stockAfter < 0) {
      await conn.rollback();
      throw new ConflictError(
        'STOCK_INSUFFICIENT',
        'Existencias insuficientes para realizar el movimiento',
        {
          variant_id: input.variant_id,
          sku: variant.sku,
          current_stock: stockBefore,
          requested_delta: input.quantity_delta
        }
      );
    }

    await inventoryRepo.updateVariantStock(conn, input.variant_id, stockAfter);
    movementId = await inventoryRepo.insertStockMovement(conn, {
      variantId: input.variant_id,
      saleId: null,
      kind: input.kind,
      quantityDelta: input.quantity_delta,
      stockAfter,
      reason: input.reason
    });

    await conn.commit();
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // Ignorar si ya se había hecho rollback
    }
    throw err;
  } finally {
    conn.release();
  }

  const created = await inventoryRepo.findMovementById(movementId);
  if (!created) {
    throw new Error('No se pudo recuperar el movimiento creado');
  }

  return {
    ...created,
    stock_before: stockBefore
  };
}

export async function getMovements(params: {
  variantId?: number;
  kind?: inventoryRepo.MovementKind;
  page: number;
  limit: number;
  offset: number;
}) {
  const { data, total } = await inventoryRepo.findMovements({
    variantId: params.variantId,
    kind: params.kind,
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
