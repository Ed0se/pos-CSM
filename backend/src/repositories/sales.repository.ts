import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { toIsoUtc } from '../utils/date.js';
import { PaymentMethod } from '../validators/sales.validator.js';

export interface SaleItemDto {
  variant_id: number;
  sku: string;
  name: string;
  size_label: string;
  color: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

export interface SchoolTicketInfoDto {
  name: string;
  address: string;
  phone: string;
  footer: string;
}

export interface SaleDetailDto {
  id: number;
  folio: string;
  created_at: string;
  items: SaleItemDto[];
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  payment_method: PaymentMethod;
  amount_received_cents: number;
  change_cents: number;
  school: SchoolTicketInfoDto;
}

export interface SaleSummaryDto {
  id: number;
  folio: string;
  created_at: string;
  items_count: number;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  payment_method: PaymentMethod;
  amount_received_cents: number;
  change_cents: number;
}

export interface SalesReportDto {
  from: string;
  to: string;
  sales_count: number;
  units_sold: number;
  revenue_cents: number;
  by_payment_method: Array<{
    method: PaymentMethod;
    sales_count: number;
    revenue_cents: number;
  }>;
  top_items: Array<{
    sku: string;
    name: string;
    size_label: string;
    color: string;
    units: number;
    revenue_cents: number;
  }>;
}

interface IdempotencyRow extends RowDataPacket {
  id: number;
  request_fingerprint: string;
}

export interface LockedVariantRow extends RowDataPacket {
  id: number;
  product_id: number;
  size_label: string;
  color: string;
  sku: string;
  unit_price_cents: number;
  stock: number;
  variant_active: number;
  product_name: string;
  product_active: number;
}

interface SaleHeaderRow extends RowDataPacket {
  id: number;
  folio: string;
  created_at: string;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  payment_method: PaymentMethod;
  amount_received_cents: number;
  change_cents: number;
}

interface SaleSummaryRow extends SaleHeaderRow {
  items_count: number;
}

interface SaleItemRow extends RowDataPacket {
  variant_id: number;
  sku_snapshot: string;
  product_name_snapshot: string;
  size_snapshot: string;
  color_snapshot: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface ReportSummaryRow extends RowDataPacket {
  sales_count: number;
  revenue_cents: string | number;
}

interface ReportUnitsRow extends RowDataPacket {
  units_sold: string | number;
}

interface ReportMethodRow extends RowDataPacket {
  method: PaymentMethod;
  sales_count: number;
  revenue_cents: string | number;
}

interface ReportTopItemRow extends RowDataPacket {
  sku: string;
  name: string;
  size_label: string;
  color: string;
  units: string | number;
  revenue_cents: string | number;
}

function getSchoolTicketInfo(): SchoolTicketInfoDto {
  return {
    name: env.TICKET_SCHOOL_NAME,
    address: env.TICKET_SCHOOL_ADDRESS,
    phone: env.TICKET_SCHOOL_PHONE,
    footer: env.TICKET_FOOTER
  };
}

export async function findByIdempotencyKeyForUpdate(
  conn: PoolConnection,
  idempotencyKey: string
): Promise<IdempotencyRow | null> {
  const [rows] = await conn.query<IdempotencyRow[]>(
    `SELECT id, request_fingerprint
     FROM sales
     WHERE idempotency_key = ?
     FOR UPDATE`,
    [idempotencyKey]
  );
  return rows[0] ?? null;
}

export async function findByIdempotencyKey(idempotencyKey: string): Promise<IdempotencyRow | null> {
  const [rows] = await pool.query<IdempotencyRow[]>(
    `SELECT id, request_fingerprint
     FROM sales
     WHERE idempotency_key = ?`,
    [idempotencyKey]
  );
  return rows[0] ?? null;
}

export async function lockVariantsOrderedById(
  conn: PoolConnection,
  variantIds: number[]
): Promise<LockedVariantRow[]> {
  const sortedIds = [...variantIds].sort((a, b) => a - b);
  const placeholders = sortedIds.map(() => '?').join(', ');

  const [rows] = await conn.query<LockedVariantRow[]>(
    `SELECT pv.id,
            pv.product_id,
            pv.size_label,
            pv.color,
            pv.sku,
            pv.unit_price_cents,
            pv.stock,
            pv.active AS variant_active,
            p.name AS product_name,
            p.active AS product_active
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id
     WHERE pv.id IN (${placeholders})
     ORDER BY pv.id ASC
     FOR UPDATE`,
    sortedIds
  );

  return rows;
}

export async function insertSaleHeader(
  conn: PoolConnection,
  params: {
    idempotencyKey: string;
    requestFingerprint: string;
    subtotalCents: number;
    discountCents: number;
    totalCents: number;
    paymentMethod: PaymentMethod;
    amountReceivedCents: number;
    changeCents: number;
  }
): Promise<{ saleId: number; folio: string }> {
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO sales (
       folio,
       idempotency_key,
       request_fingerprint,
       subtotal_cents,
       discount_cents,
       total_cents,
       payment_method,
       amount_received_cents,
       change_cents
     ) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.idempotencyKey,
      params.requestFingerprint,
      params.subtotalCents,
      params.discountCents,
      params.totalCents,
      params.paymentMethod,
      params.amountReceivedCents,
      params.changeCents
    ]
  );

  const saleId = result.insertId;
  const folio = `CSM-${String(saleId).padStart(8, '0')}`;

  await conn.query(`UPDATE sales SET folio = ? WHERE id = ?`, [folio, saleId]);

  return { saleId, folio };
}

export async function insertSaleItemSnapshot(
  conn: PoolConnection,
  params: {
    saleId: number;
    variantId: number;
    productName: string;
    sizeLabel: string;
    color: string;
    sku: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }
): Promise<void> {
  await conn.query(
    `INSERT INTO sale_items (
       sale_id,
       variant_id,
       product_name_snapshot,
       size_snapshot,
       color_snapshot,
       sku_snapshot,
       quantity,
       unit_price_cents,
       line_total_cents
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.saleId,
      params.variantId,
      params.productName,
      params.sizeLabel,
      params.color,
      params.sku,
      params.quantity,
      params.unitPriceCents,
      params.lineTotalCents
    ]
  );
}

export async function decrementVariantStock(
  conn: PoolConnection,
  variantId: number,
  quantity: number
): Promise<void> {
  await conn.query(
    `UPDATE product_variants SET stock = stock - ? WHERE id = ?`,
    [quantity, variantId]
  );
}

export async function findSaleById(id: number): Promise<SaleDetailDto | null> {
  const [saleRows] = await pool.query<SaleHeaderRow[]>(
    `SELECT id,
            folio,
            created_at,
            subtotal_cents,
            discount_cents,
            total_cents,
            payment_method,
            amount_received_cents,
            change_cents
     FROM sales
     WHERE id = ?`,
    [id]
  );

  const saleRow = saleRows[0];
  if (!saleRow) {
    return null;
  }

  const [itemRows] = await pool.query<SaleItemRow[]>(
    `SELECT variant_id,
            sku_snapshot,
            product_name_snapshot,
            size_snapshot,
            color_snapshot,
            quantity,
            unit_price_cents,
            line_total_cents
     FROM sale_items
     WHERE sale_id = ?
     ORDER BY id ASC`,
    [id]
  );

  return {
    id: Number(saleRow.id),
    folio: saleRow.folio,
    created_at: toIsoUtc(saleRow.created_at),
    items: itemRows.map((row) => ({
      variant_id: Number(row.variant_id),
      sku: row.sku_snapshot,
      name: row.product_name_snapshot,
      size_label: row.size_snapshot,
      color: row.color_snapshot,
      quantity: Number(row.quantity),
      unit_price_cents: Number(row.unit_price_cents),
      line_total_cents: Number(row.line_total_cents)
    })),
    subtotal_cents: Number(saleRow.subtotal_cents),
    discount_cents: Number(saleRow.discount_cents),
    total_cents: Number(saleRow.total_cents),
    payment_method: saleRow.payment_method,
    amount_received_cents: Number(saleRow.amount_received_cents),
    change_cents: Number(saleRow.change_cents),
    school: getSchoolTicketInfo()
  };
}

export async function findSales(params: {
  fromUtcSql?: string;
  toUtcSql?: string;
  folio?: string;
  paymentMethod?: PaymentMethod;
  limit: number;
  offset: number;
}): Promise<{ data: SaleSummaryDto[]; total: number }> {
  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (params.fromUtcSql && params.toUtcSql) {
    conditions.push('s.created_at >= ? AND s.created_at < ?');
    queryParams.push(params.fromUtcSql, params.toUtcSql);
  }

  if (params.folio && params.folio.trim().length > 0) {
    conditions.push('s.folio LIKE ?');
    queryParams.push(`%${params.folio.trim()}%`);
  }

  if (params.paymentMethod) {
    conditions.push('s.payment_method = ?');
    queryParams.push(params.paymentMethod);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS total FROM sales s ${whereClause}`,
    queryParams
  );
  const total = Number(countRows[0]?.total ?? 0);

  if (total === 0) {
    return { data: [], total: 0 };
  }

  const [rows] = await pool.query<SaleSummaryRow[]>(
    `SELECT s.id,
            s.folio,
            s.created_at,
            s.subtotal_cents,
            s.discount_cents,
            s.total_cents,
            s.payment_method,
            s.amount_received_cents,
            s.change_cents,
            COALESCE((SELECT SUM(si.quantity) FROM sale_items si WHERE si.sale_id = s.id), 0) AS items_count
     FROM sales s
     ${whereClause}
     ORDER BY s.created_at DESC, s.id DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, params.limit, params.offset]
  );

  return {
    data: rows.map((row) => ({
      id: Number(row.id),
      folio: row.folio,
      created_at: toIsoUtc(row.created_at),
      items_count: Number(row.items_count),
      subtotal_cents: Number(row.subtotal_cents),
      discount_cents: Number(row.discount_cents),
      total_cents: Number(row.total_cents),
      payment_method: row.payment_method,
      amount_received_cents: Number(row.amount_received_cents),
      change_cents: Number(row.change_cents)
    })),
    total
  };
}

export async function getSalesReportData(params: {
  from: string;
  to: string;
  fromUtcSql: string;
  toUtcSql: string;
}): Promise<SalesReportDto> {
  const [summaryRows] = await pool.query<ReportSummaryRow[]>(
    `SELECT COUNT(*) AS sales_count,
            COALESCE(SUM(total_cents), 0) AS revenue_cents
     FROM sales
     WHERE created_at >= ? AND created_at < ?`,
    [params.fromUtcSql, params.toUtcSql]
  );

  const [unitsRows] = await pool.query<ReportUnitsRow[]>(
    `SELECT COALESCE(SUM(si.quantity), 0) AS units_sold
     FROM sale_items si
     INNER JOIN sales s ON s.id = si.sale_id
     WHERE s.created_at >= ? AND s.created_at < ?`,
    [params.fromUtcSql, params.toUtcSql]
  );

  const [methodRows] = await pool.query<ReportMethodRow[]>(
    `SELECT payment_method AS method,
            COUNT(*) AS sales_count,
            COALESCE(SUM(total_cents), 0) AS revenue_cents
     FROM sales
     WHERE created_at >= ? AND created_at < ?
     GROUP BY payment_method
     ORDER BY revenue_cents DESC`,
    [params.fromUtcSql, params.toUtcSql]
  );

  const [topRows] = await pool.query<ReportTopItemRow[]>(
    `SELECT si.sku_snapshot AS sku,
            MAX(si.product_name_snapshot) AS name,
            MAX(si.size_snapshot) AS size_label,
            MAX(si.color_snapshot) AS color,
            SUM(si.quantity) AS units,
            SUM(si.line_total_cents) AS revenue_cents
     FROM sale_items si
     INNER JOIN sales s ON s.id = si.sale_id
     WHERE s.created_at >= ? AND s.created_at < ?
     GROUP BY si.sku_snapshot
     ORDER BY units DESC, revenue_cents DESC
     LIMIT 10`,
    [params.fromUtcSql, params.toUtcSql]
  );

  return {
    from: params.from,
    to: params.to,
    sales_count: Number(summaryRows[0]?.sales_count ?? 0),
    units_sold: Number(unitsRows[0]?.units_sold ?? 0),
    revenue_cents: Number(summaryRows[0]?.revenue_cents ?? 0),
    by_payment_method: methodRows.map((row) => ({
      method: row.method,
      sales_count: Number(row.sales_count),
      revenue_cents: Number(row.revenue_cents)
    })),
    top_items: topRows.map((row) => ({
      sku: row.sku,
      name: row.name,
      size_label: row.size_label,
      color: row.color,
      units: Number(row.units),
      revenue_cents: Number(row.revenue_cents)
    }))
  };
}
