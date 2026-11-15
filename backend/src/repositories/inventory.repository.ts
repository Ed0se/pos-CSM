import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/database.js';
import { toIsoUtc } from '../utils/date.js';

export type StockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OK';
export type MovementKind = 'ENTRY' | 'EXIT' | 'ADJUSTMENT' | 'SALE';

export interface InventoryItemDto {
  variant_id: number;
  product_id: number;
  product_name: string;
  category: string;
  product_active: boolean;
  size_label: string;
  color: string;
  sku: string;
  unit_price_cents: number;
  stock: number;
  minimum_stock: number;
  variant_active: boolean;
  stock_status: StockStatus;
}

export interface StockMovementDto {
  id: number;
  variant_id: number;
  sale_id: number | null;
  sale_folio: string | null;
  product_name: string;
  size_label: string;
  color: string;
  sku: string;
  kind: MovementKind;
  quantity_delta: number;
  stock_after: number;
  reason: string;
  created_at: string;
}

interface InventoryRow extends RowDataPacket {
  variant_id: number;
  product_id: number;
  product_name: string;
  category: string;
  product_active: number;
  size_label: string;
  color: string;
  sku: string;
  unit_price_cents: number;
  stock: number;
  minimum_stock: number;
  variant_active: number;
}

interface MovementRow extends RowDataPacket {
  id: number;
  variant_id: number;
  sale_id: number | null;
  sale_folio: string | null;
  product_name: string;
  size_label: string;
  color: string;
  sku: string;
  kind: MovementKind;
  quantity_delta: number;
  stock_after: number;
  reason: string;
  created_at: string;
}

interface VariantLockRow extends RowDataPacket {
  id: number;
  sku: string;
  stock: number;
  minimum_stock: number;
  active: number;
}

interface CountRow extends RowDataPacket {
  total: number;
}

function computeStockStatus(stock: number, minimumStock: number): StockStatus {
  if (stock === 0) return 'OUT_OF_STOCK';
  if (stock <= minimumStock) return 'LOW_STOCK';
  return 'OK';
}

function mapInventoryRow(row: InventoryRow): InventoryItemDto {
  const stock = Number(row.stock);
  const minimumStock = Number(row.minimum_stock);
  return {
    variant_id: Number(row.variant_id),
    product_id: Number(row.product_id),
    product_name: row.product_name,
    category: row.category,
    product_active: Boolean(row.product_active),
    size_label: row.size_label,
    color: row.color,
    sku: row.sku,
    unit_price_cents: Number(row.unit_price_cents),
    stock,
    minimum_stock: minimumStock,
    variant_active: Boolean(row.variant_active),
    stock_status: computeStockStatus(stock, minimumStock)
  };
}

function mapMovementRow(row: MovementRow): StockMovementDto {
  return {
    id: Number(row.id),
    variant_id: Number(row.variant_id),
    sale_id: row.sale_id !== null ? Number(row.sale_id) : null,
    sale_folio: row.sale_folio,
    product_name: row.product_name,
    size_label: row.size_label,
    color: row.color,
    sku: row.sku,
    kind: row.kind,
    quantity_delta: Number(row.quantity_delta),
    stock_after: Number(row.stock_after),
    reason: row.reason,
    created_at: toIsoUtc(row.created_at)
  };
}

export async function findInventory(params: {
  q?: string;
  lowStock?: boolean;
  stockStatus?: 'OUT' | 'LOW' | 'OK';
  active?: boolean;
  limit: number;
  offset: number;
}): Promise<{ data: InventoryItemDto[]; total: number }> {
  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (params.q && params.q.trim().length > 0) {
    const term = `%${params.q.trim()}%`;
    conditions.push('(p.name LIKE ? OR p.category LIKE ? OR pv.sku LIKE ? OR pv.size_label LIKE ? OR pv.color LIKE ?)');
    queryParams.push(term, term, term, term, term);
  }

  if (params.lowStock === true) {
    conditions.push('pv.stock <= pv.minimum_stock');
  }

  if (params.stockStatus === 'OUT') {
    conditions.push('pv.stock = 0');
  } else if (params.stockStatus === 'LOW') {
    conditions.push('pv.stock > 0 AND pv.stock <= pv.minimum_stock');
  } else if (params.stockStatus === 'OK') {
    conditions.push('pv.stock > pv.minimum_stock');
  }

  if (params.active !== undefined) {
    conditions.push('p.active = ? AND pv.active = ?');
    queryParams.push(params.active ? 1 : 0, params.active ? 1 : 0);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id
     ${whereClause}`,
    queryParams
  );
  const total = Number(countRows[0]?.total ?? 0);

  if (total === 0) {
    return { data: [], total: 0 };
  }

  const [rows] = await pool.query<InventoryRow[]>(
    `SELECT pv.id AS variant_id,
            p.id AS product_id,
            p.name AS product_name,
            p.category,
            p.active AS product_active,
            pv.size_label,
            pv.color,
            pv.sku,
            pv.unit_price_cents,
            pv.stock,
            pv.minimum_stock,
            pv.active AS variant_active
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id
     ${whereClause}
     ORDER BY p.name ASC, pv.id ASC
     LIMIT ? OFFSET ?`,
    [...queryParams, params.limit, params.offset]
  );

  return {
    data: rows.map(mapInventoryRow),
    total
  };
}

export async function lockVariantForMovement(
  conn: PoolConnection,
  variantId: number
): Promise<VariantLockRow | null> {
  const [rows] = await conn.query<VariantLockRow[]>(
    `SELECT id, sku, stock, minimum_stock, active
     FROM product_variants
     WHERE id = ?
     FOR UPDATE`,
    [variantId]
  );
  return rows[0] ?? null;
}

export async function updateVariantStock(
  conn: PoolConnection,
  variantId: number,
  newStock: number
): Promise<void> {
  await conn.query(
    `UPDATE product_variants SET stock = ? WHERE id = ?`,
    [newStock, variantId]
  );
}

export async function insertStockMovement(
  conn: PoolConnection,
  params: {
    variantId: number;
    saleId: number | null;
    kind: MovementKind;
    quantityDelta: number;
    stockAfter: number;
    reason: string;
  }
): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO stock_movements (variant_id, sale_id, kind, quantity_delta, stock_after, reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      params.variantId,
      params.saleId,
      params.kind,
      params.quantityDelta,
      params.stockAfter,
      params.reason
    ]
  );
  return result.insertId;
}

export async function findMovementById(id: number): Promise<StockMovementDto | null> {
  const [rows] = await pool.query<MovementRow[]>(
    `SELECT sm.id,
            sm.variant_id,
            sm.sale_id,
            s.folio AS sale_folio,
            p.name AS product_name,
            pv.size_label,
            pv.color,
            pv.sku,
            sm.kind,
            sm.quantity_delta,
            sm.stock_after,
            sm.reason,
            sm.created_at
     FROM stock_movements sm
     INNER JOIN product_variants pv ON pv.id = sm.variant_id
     INNER JOIN products p ON p.id = pv.product_id
     LEFT JOIN sales s ON s.id = sm.sale_id
     WHERE sm.id = ?`,
    [id]
  );

  const row = rows[0];
  return row ? mapMovementRow(row) : null;
}

export async function findMovements(params: {
  variantId?: number;
  kind?: MovementKind;
  limit: number;
  offset: number;
}): Promise<{ data: StockMovementDto[]; total: number }> {
  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (params.variantId !== undefined) {
    conditions.push('sm.variant_id = ?');
    queryParams.push(params.variantId);
  }

  if (params.kind !== undefined) {
    conditions.push('sm.kind = ?');
    queryParams.push(params.kind);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM stock_movements sm
     ${whereClause}`,
    queryParams
  );
  const total = Number(countRows[0]?.total ?? 0);

  if (total === 0) {
    return { data: [], total: 0 };
  }

  const [rows] = await pool.query<MovementRow[]>(
    `SELECT sm.id,
            sm.variant_id,
            sm.sale_id,
            s.folio AS sale_folio,
            p.name AS product_name,
            pv.size_label,
            pv.color,
            pv.sku,
            sm.kind,
            sm.quantity_delta,
            sm.stock_after,
            sm.reason,
            sm.created_at
     FROM stock_movements sm
     INNER JOIN product_variants pv ON pv.id = sm.variant_id
     INNER JOIN products p ON p.id = pv.product_id
     LEFT JOIN sales s ON s.id = sm.sale_id
     ${whereClause}
     ORDER BY sm.created_at DESC, sm.id DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, params.limit, params.offset]
  );

  return {
    data: rows.map(mapMovementRow),
    total
  };
}
