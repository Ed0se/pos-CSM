import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/database.js';
import { toIsoUtc } from '../utils/date.js';
import {
  CreateProductInput,
  CreateVariantInput,
  UpdateProductInput,
  UpdateVariantInput
} from '../validators/products.validator.js';

export interface ProductVariantDto {
  id: number;
  product_id: number;
  size_label: string;
  color: string;
  sku: string;
  unit_price_cents: number;
  stock: number;
  minimum_stock: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductDto {
  id: number;
  name: string;
  category: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  variants: ProductVariantDto[];
}

interface ProductRow extends RowDataPacket {
  id: number;
  name: string;
  category: string;
  description: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

interface VariantRow extends RowDataPacket {
  id: number;
  product_id: number;
  size_label: string;
  color: string;
  sku: string;
  unit_price_cents: number;
  stock: number;
  minimum_stock: number;
  active: number;
  created_at: string;
  updated_at: string;
}

interface CountRow extends RowDataPacket {
  total: number;
}

function mapVariantRow(row: VariantRow): ProductVariantDto {
  return {
    id: Number(row.id),
    product_id: Number(row.product_id),
    size_label: row.size_label,
    color: row.color,
    sku: row.sku,
    unit_price_cents: Number(row.unit_price_cents),
    stock: Number(row.stock),
    minimum_stock: Number(row.minimum_stock),
    active: Boolean(row.active),
    created_at: toIsoUtc(row.created_at),
    updated_at: toIsoUtc(row.updated_at)
  };
}

function mapProductRow(row: ProductRow, variants: ProductVariantDto[] = []): ProductDto {
  return {
    id: Number(row.id),
    name: row.name,
    category: row.category,
    description: row.description,
    active: Boolean(row.active),
    created_at: toIsoUtc(row.created_at),
    updated_at: toIsoUtc(row.updated_at),
    variants
  };
}

export async function findProducts(params: {
  q?: string;
  active?: boolean;
  limit: number;
  offset: number;
}): Promise<{ data: ProductDto[]; total: number }> {
  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (params.q && params.q.trim().length > 0) {
    const term = `%${params.q.trim()}%`;
    conditions.push(`(
      p.name LIKE ? OR
      p.category LIKE ? OR
      EXISTS (
        SELECT 1 FROM product_variants pv_search
        WHERE pv_search.product_id = p.id
          AND (pv_search.sku LIKE ? OR pv_search.size_label LIKE ? OR pv_search.color LIKE ?)
      )
    )`);
    queryParams.push(term, term, term, term, term);
  }

  if (params.active !== undefined) {
    conditions.push('p.active = ?');
    queryParams.push(params.active ? 1 : 0);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS total FROM products p ${whereClause}`,
    queryParams
  );
  const total = Number(countRows[0]?.total ?? 0);

  if (total === 0) {
    return { data: [], total: 0 };
  }

  const [productRows] = await pool.query<ProductRow[]>(
    `SELECT p.id, p.name, p.category, p.description, p.active, p.created_at, p.updated_at
     FROM products p
     ${whereClause}
     ORDER BY p.name ASC, p.id ASC
     LIMIT ? OFFSET ?`,
    [...queryParams, params.limit, params.offset]
  );

  if (productRows.length === 0) {
    return { data: [], total };
  }

  const productIds = productRows.map((p) => Number(p.id));
  const placeholders = productIds.map(() => '?').join(', ');

  const [variantRows] = await pool.query<VariantRow[]>(
    `SELECT id, product_id, size_label, color, sku, unit_price_cents, stock, minimum_stock, active, created_at, updated_at
     FROM product_variants
     WHERE product_id IN (${placeholders})
     ORDER BY id ASC`,
    productIds
  );

  const variantsByProduct = new Map<number, ProductVariantDto[]>();
  for (const vRow of variantRows) {
    const mapped = mapVariantRow(vRow);
    const list = variantsByProduct.get(mapped.product_id) ?? [];
    list.push(mapped);
    variantsByProduct.set(mapped.product_id, list);
  }

  const data = productRows.map((pRow) =>
    mapProductRow(pRow, variantsByProduct.get(Number(pRow.id)) ?? [])
  );

  return { data, total };
}

export async function findProductById(id: number): Promise<ProductDto | null> {
  const [productRows] = await pool.query<ProductRow[]>(
    `SELECT id, name, category, description, active, created_at, updated_at
     FROM products
     WHERE id = ?`,
    [id]
  );

  const productRow = productRows[0];
  if (!productRow) {
    return null;
  }

  const [variantRows] = await pool.query<VariantRow[]>(
    `SELECT id, product_id, size_label, color, sku, unit_price_cents, stock, minimum_stock, active, created_at, updated_at
     FROM product_variants
     WHERE product_id = ?
     ORDER BY id ASC`,
    [id]
  );

  return mapProductRow(productRow, variantRows.map(mapVariantRow));
}

export async function insertProduct(input: CreateProductInput): Promise<ProductDto> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO products (name, category, description, active)
     VALUES (?, ?, ?, ?)`,
    [input.name, input.category, input.description ?? null, input.active ? 1 : 0]
  );

  const created = await findProductById(result.insertId);
  if (!created) {
    throw new Error('No se pudo recuperar el producto creado');
  }
  return created;
}

export async function updateProduct(id: number, input: UpdateProductInput): Promise<ProductDto | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    fields.push('name = ?');
    values.push(input.name);
  }
  if (input.category !== undefined) {
    fields.push('category = ?');
    values.push(input.category);
  }
  if (input.description !== undefined) {
    fields.push('description = ?');
    values.push(input.description);
  }
  if (input.active !== undefined) {
    fields.push('active = ?');
    values.push(input.active ? 1 : 0);
  }

  if (fields.length === 0) {
    return findProductById(id);
  }

  values.push(id);
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE products SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findProductById(id);
}

export async function findVariantById(id: number): Promise<ProductVariantDto | null> {
  const [rows] = await pool.query<VariantRow[]>(
    `SELECT id, product_id, size_label, color, sku, unit_price_cents, stock, minimum_stock, active, created_at, updated_at
     FROM product_variants
     WHERE id = ?`,
    [id]
  );

  const row = rows[0];
  return row ? mapVariantRow(row) : null;
}

export async function insertVariant(
  productId: number,
  input: CreateVariantInput
): Promise<ProductVariantDto> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO product_variants (product_id, size_label, color, sku, unit_price_cents, stock, minimum_stock, active)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      productId,
      input.size_label,
      input.color,
      input.sku,
      input.unit_price_cents,
      input.minimum_stock,
      input.active ? 1 : 0
    ]
  );

  const created = await findVariantById(result.insertId);
  if (!created) {
    throw new Error('No se pudo recuperar la variante creada');
  }
  return created;
}

export async function updateVariant(
  id: number,
  input: UpdateVariantInput
): Promise<ProductVariantDto | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.size_label !== undefined) {
    fields.push('size_label = ?');
    values.push(input.size_label);
  }
  if (input.color !== undefined) {
    fields.push('color = ?');
    values.push(input.color);
  }
  if (input.sku !== undefined) {
    fields.push('sku = ?');
    values.push(input.sku);
  }
  if (input.unit_price_cents !== undefined) {
    fields.push('unit_price_cents = ?');
    values.push(input.unit_price_cents);
  }
  if (input.minimum_stock !== undefined) {
    fields.push('minimum_stock = ?');
    values.push(input.minimum_stock);
  }
  if (input.active !== undefined) {
    fields.push('active = ?');
    values.push(input.active ? 1 : 0);
  }

  if (fields.length === 0) {
    return findVariantById(id);
  }

  values.push(id);
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE product_variants SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findVariantById(id);
}
