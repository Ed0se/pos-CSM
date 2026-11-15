import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_DB_NAME = 'colegio_san_miguel_pos_test';

vi.hoisted(() => {
  process.env['MYSQL_DATABASE'] = 'colegio_san_miguel_pos_test';
});

import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/database.js';

async function setupTestDatabase(): Promise<void> {
  const adminConn = await mysql.createConnection({
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    multipleStatements: true
  });

  try {
    await adminConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${TEST_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`
    );

    const schemaPath = path.resolve(process.cwd(), '..', 'database', '001_schema.sql');
    const fallbackSchemaPath = path.resolve(process.cwd(), 'database', '001_schema.sql');
    const resolvedSchemaPath = fs.existsSync(schemaPath) ? schemaPath : fallbackSchemaPath;
    const rawSchema = fs.readFileSync(resolvedSchemaPath, 'utf8');

    const testSchemaSql = rawSchema
      .replace(/CREATE DATABASE IF NOT EXISTS[\s\S]*?;/i, '')
      .replace(/USE\s+colegio_san_miguel_pos\s*;/i, `USE \`${TEST_DB_NAME}\`;`);

    await adminConn.query(testSchemaSql);
  } finally {
    await adminConn.end();
  }
}

async function resetTestTables(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE stock_movements');
    await conn.query('TRUNCATE TABLE sale_items');
    await conn.query('TRUNCATE TABLE sales');
    await conn.query('TRUNCATE TABLE product_variants');
    await conn.query('TRUNCATE TABLE products');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
}

async function createSampleProductAndVariants() {
  const prodRes = await request(app).post('/api/v1/products').send({
    name: 'Playera polo escolar',
    category: 'Uniforme diario',
    description: 'Uniforme oficial'
  });
  expect(prodRes.status).toBe(201);
  const productId = prodRes.body.id as number;

  const varARes = await request(app).post(`/api/v1/products/${productId}/variants`).send({
    size_label: '8',
    color: 'Blanco',
    sku: 'CSM-POLO-BLA-8',
    unit_price_cents: 25000,
    minimum_stock: 3
  });
  expect(varARes.status).toBe(201);

  const varBRes = await request(app).post(`/api/v1/products/${productId}/variants`).send({
    size_label: '10',
    color: 'Blanco',
    sku: 'CSM-POLO-BLA-10',
    unit_price_cents: 28000,
    minimum_stock: 3
  });
  expect(varBRes.status).toBe(201);

  return {
    productId,
    variantA: varARes.body as { id: number; sku: string; unit_price_cents: number },
    variantB: varBRes.body as { id: number; sku: string; unit_price_cents: number }
  };
}

describe('Integración MySQL — Reglas de negocio POS Colegio San Miguel', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await resetTestTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('1. Crea prenda y dos variantes con distinto SKU/talla y stock inicial 0 independiente', async () => {
    const { productId, variantA, variantB } = await createSampleProductAndVariants();

    const productRes = await request(app).get(`/api/v1/products/${productId}`);
    expect(productRes.status).toBe(200);
    expect(productRes.body.variants).toHaveLength(2);
    expect(productRes.body.variants[0].stock).toBe(0);
    expect(productRes.body.variants[1].stock).toBe(0);

    const invRes = await request(app).get('/api/v1/inventory');
    expect(invRes.status).toBe(200);
    expect(invRes.body.data).toHaveLength(2);
    expect(invRes.body.data.map((i: { variant_id: number }) => i.variant_id)).toEqual([
      variantA.id,
      variantB.id
    ]);
  });

  it('2. Rechaza SKU repetido incluidos equivalentes por mayúsculas/minúsculas (409 DUPLICATE_SKU)', async () => {
    const { productId } = await createSampleProductAndVariants();

    const dupRes = await request(app).post(`/api/v1/products/${productId}/variants`).send({
      size_label: '12',
      color: 'Blanco',
      sku: 'csm-polo-bla-8',
      unit_price_cents: 29000,
      minimum_stock: 2
    });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe('DUPLICATE_SKU');
  });

  it('3 & 4. Entrada de 10 incrementa stock a 10; salida de 3 deja 7; intentar sacar 8 falla sin cambios', async () => {
    const { variantA } = await createSampleProductAndVariants();

    const entryRes = await request(app).post('/api/v1/inventory/movements').send({
      variant_id: variantA.id,
      kind: 'ENTRY',
      quantity_delta: 10,
      reason: 'Inventario inicial'
    });
    expect(entryRes.status).toBe(201);
    expect(entryRes.body.stock_before).toBe(0);
    expect(entryRes.body.stock_after).toBe(10);

    const exitOkRes = await request(app).post('/api/v1/inventory/movements').send({
      variant_id: variantA.id,
      kind: 'EXIT',
      quantity_delta: -3,
      reason: 'Muestra dirección'
    });
    expect(exitOkRes.status).toBe(201);
    expect(exitOkRes.body.stock_after).toBe(7);

    const exitFailRes = await request(app).post('/api/v1/inventory/movements').send({
      variant_id: variantA.id,
      kind: 'EXIT',
      quantity_delta: -8,
      reason: 'Salida excesiva'
    });
    expect(exitFailRes.status).toBe(409);
    expect(exitFailRes.body.error.code).toBe('STOCK_INSUFFICIENT');

    const invRes = await request(app).get(`/api/v1/inventory?q=${variantA.sku}`);
    expect(invRes.status).toBe(200);
    expect(invRes.body.data[0].stock).toBe(7);

    const movRes = await request(app).get(`/api/v1/inventory/movements?variantId=${variantA.id}`);
    expect(movRes.status).toBe(200);
    expect(movRes.body.data).toHaveLength(2);
  });

  it('5. Venta de A x2 y B x1 crea 1 venta, 2 líneas snapshot, 2 movimientos SALE y descuenta existencias', async () => {
    const { variantA, variantB } = await createSampleProductAndVariants();

    await request(app).post('/api/v1/inventory/movements').send({
      variant_id: variantA.id,
      kind: 'ENTRY',
      quantity_delta: 5,
      reason: 'Carga A'
    });
    await request(app).post('/api/v1/inventory/movements').send({
      variant_id: variantB.id,
      kind: 'ENTRY',
      quantity_delta: 4,
      reason: 'Carga B'
    });

    const saleRes = await request(app)
      .post('/api/v1/sales')
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        items: [
          { variant_id: variantA.id, quantity: 2 },
          { variant_id: variantB.id, quantity: 1 }
        ],
        payment_method: 'CASH',
        amount_received_cents: 100000
      });

    expect(saleRes.status).toBe(201);
    expect(saleRes.body.folio).toMatch(/^CSM-\d{8}$/);
    expect(saleRes.body.items).toHaveLength(2);
    expect(saleRes.body.subtotal_cents).toBe(78000);
    expect(saleRes.body.total_cents).toBe(78000);
    expect(saleRes.body.change_cents).toBe(22000);

    const invRes = await request(app).get('/api/v1/inventory');
    const stockMap = new Map(
      invRes.body.data.map((i: { variant_id: number; stock: number }) => [i.variant_id, i.stock])
    );
    expect(stockMap.get(variantA.id)).toBe(3);
    expect(stockMap.get(variantB.id)).toBe(3);

    const movRes = await request(app).get('/api/v1/inventory/movements?kind=SALE');
    expect(movRes.status).toBe(200);
    expect(movRes.body.data).toHaveLength(2);
  });

  it('6. Si B no tiene stock suficiente, falla toda la venta (ROLLBACK) y A conserva su stock intacto', async () => {
    const { variantA, variantB } = await createSampleProductAndVariants();

    await request(app).post('/api/v1/inventory/movements').send({
      variant_id: variantA.id,
      kind: 'ENTRY',
      quantity_delta: 5,
      reason: 'Carga A'
    });
    // variantB queda con stock 0

    const failSaleRes = await request(app)
      .post('/api/v1/sales')
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        items: [
          { variant_id: variantA.id, quantity: 2 },
          { variant_id: variantB.id, quantity: 1 }
        ],
        payment_method: 'CARD'
      });

    expect(failSaleRes.status).toBe(409);
    expect(failSaleRes.body.error.code).toBe('STOCK_INSUFFICIENT');

    const invRes = await request(app).get('/api/v1/inventory');
    const stockA = invRes.body.data.find((i: { variant_id: number }) => i.variant_id === variantA.id).stock;
    expect(stockA).toBe(5);

    const salesRes = await request(app).get('/api/v1/sales');
    expect(salesRes.body.data).toHaveLength(0);
  });

  it('7. Dos ventas simultáneas por la última unidad: una gana (201) y otra falla (409 STOCK_INSUFFICIENT)', async () => {
    const { variantA } = await createSampleProductAndVariants();

    await request(app).post('/api/v1/inventory/movements').send({
      variant_id: variantA.id,
      kind: 'ENTRY',
      quantity_delta: 1,
      reason: 'Última pieza'
    });

    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/v1/sales')
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          items: [{ variant_id: variantA.id, quantity: 1 }],
          payment_method: 'CASH',
          amount_received_cents: 25000
        }),
      request(app)
        .post('/api/v1/sales')
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          items: [{ variant_id: variantA.id, quantity: 1 }],
          payment_method: 'CASH',
          amount_received_cents: 25000
        })
    ]);

    const statuses = [res1.status, res2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const loser = res1.status === 409 ? res1 : res2;
    expect(loser.body.error.code).toBe('STOCK_INSUFFICIENT');

    const invRes = await request(app).get(`/api/v1/inventory?q=${variantA.sku}`);
    expect(invRes.body.data[0].stock).toBe(0);
  });

  it('8 & 9. Idempotencia: mismo payload devuelve venta original; payload distinto responde 409 IDEMPOTENCY_CONFLICT', async () => {
    const { variantA, variantB } = await createSampleProductAndVariants();

    await request(app).post('/api/v1/inventory/movements').send({
      variant_id: variantA.id,
      kind: 'ENTRY',
      quantity_delta: 5,
      reason: 'Carga A'
    });
    await request(app).post('/api/v1/inventory/movements').send({
      variant_id: variantB.id,
      kind: 'ENTRY',
      quantity_delta: 5,
      reason: 'Carga B'
    });

    const idempKey = crypto.randomUUID();
    const payload = {
      items: [{ variant_id: variantA.id, quantity: 2 }],
      payment_method: 'CASH',
      amount_received_cents: 50000
    };

    const firstRes = await request(app)
      .post('/api/v1/sales')
      .set('Idempotency-Key', idempKey)
      .send(payload);
    expect(firstRes.status).toBe(201);

    const retryRes = await request(app)
      .post('/api/v1/sales')
      .set('Idempotency-Key', idempKey)
      .send(payload);
    expect(retryRes.status).toBe(200);
    expect(retryRes.body.id).toBe(firstRes.body.id);
    expect(retryRes.body.folio).toBe(firstRes.body.folio);

    // Stock solo se descontó una vez (5 - 2 = 3)
    const invRes = await request(app).get(`/api/v1/inventory?q=${variantA.sku}`);
    expect(invRes.body.data[0].stock).toBe(3);

    // Misma clave pero payload distinto -> 409 IDEMPOTENCY_CONFLICT
    const conflictRes = await request(app)
      .post('/api/v1/sales')
      .set('Idempotency-Key', idempKey)
      .send({
        items: [{ variant_id: variantB.id, quantity: 1 }],
        payment_method: 'TRANSFER'
      });
    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('10. Cambio de precio tras venta no modifica el ticket histórico y detecta PRICE_CHANGED si expected_total_cents difiere', async () => {
    const { variantA } = await createSampleProductAndVariants();

    await request(app).post('/api/v1/inventory/movements').send({
      variant_id: variantA.id,
      kind: 'ENTRY',
      quantity_delta: 5,
      reason: 'Carga inicial'
    });

    const saleRes = await request(app)
      .post('/api/v1/sales')
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        items: [{ variant_id: variantA.id, quantity: 2 }],
        payment_method: 'TRANSFER',
        expected_total_cents: 50000
      });
    expect(saleRes.status).toBe(201);
    expect(saleRes.body.total_cents).toBe(50000);

    // Actualizar precio de la variante a $310.00 (31000 centavos)
    const patchRes = await request(app).patch(`/api/v1/variants/${variantA.id}`).send({
      unit_price_cents: 31000
    });
    expect(patchRes.status).toBe(200);

    // El ticket histórico conserva el precio congelado de $250.00 y total $500.00
    const historicRes = await request(app).get(`/api/v1/sales/${saleRes.body.id}`);
    expect(historicRes.status).toBe(200);
    expect(historicRes.body.total_cents).toBe(50000);
    expect(historicRes.body.items[0].unit_price_cents).toBe(25000);

    // Si el cliente intenta cobrar con total esperado anterior, el servidor alerta PRICE_CHANGED
    const staleRes = await request(app)
      .post('/api/v1/sales')
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        items: [{ variant_id: variantA.id, quantity: 2 }],
        payment_method: 'CARD',
        expected_total_cents: 50000
      });
    expect(staleRes.status).toBe(409);
    expect(staleRes.body.error.code).toBe('PRICE_CHANGED');
  });

  it('11. Pago insuficiente en efectivo falla (422); pago mayor calcula cambio exacto', async () => {
    const { variantA } = await createSampleProductAndVariants();

    await request(app).post('/api/v1/inventory/movements').send({
      variant_id: variantA.id,
      kind: 'ENTRY',
      quantity_delta: 5,
      reason: 'Carga inicial'
    });

    const shortRes = await request(app)
      .post('/api/v1/sales')
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        items: [{ variant_id: variantA.id, quantity: 1 }],
        payment_method: 'CASH',
        amount_received_cents: 20000
      });
    expect(shortRes.status).toBe(422);
    expect(shortRes.body.error.code).toBe('PAYMENT_INSUFFICIENT');

    const okRes = await request(app)
      .post('/api/v1/sales')
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        items: [{ variant_id: variantA.id, quantity: 1 }],
        payment_method: 'CASH',
        amount_received_cents: 50000
      });
    expect(okRes.status).toBe(201);
    expect(okRes.body.total_cents).toBe(25000);
    expect(okRes.body.change_cents).toBe(25000);
  });

  it('12 & 14. Reporte de ventas coincide con ventas guardadas y persiste en consultas independientes', async () => {
    const { variantA, variantB } = await createSampleProductAndVariants();

    await request(app).post('/api/v1/inventory/movements').send({
      variant_id: variantA.id,
      kind: 'ENTRY',
      quantity_delta: 10,
      reason: 'Carga A'
    });
    await request(app).post('/api/v1/inventory/movements').send({
      variant_id: variantB.id,
      kind: 'ENTRY',
      quantity_delta: 10,
      reason: 'Carga B'
    });

    await request(app)
      .post('/api/v1/sales')
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        items: [{ variant_id: variantA.id, quantity: 2 }],
        payment_method: 'CASH',
        amount_received_cents: 50000
      });

    await request(app)
      .post('/api/v1/sales')
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        items: [{ variant_id: variantB.id, quantity: 1 }],
        payment_method: 'CARD'
      });

    const reportRes = await request(app).get('/api/v1/reports/sales');
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.sales_count).toBe(2);
    expect(reportRes.body.units_sold).toBe(3);
    expect(reportRes.body.revenue_cents).toBe(78000);
    expect(reportRes.body.by_payment_method).toHaveLength(2);
    expect(reportRes.body.top_items[0].sku).toBe(variantA.sku);
    expect(reportRes.body.top_items[0].units).toBe(2);

    // Verificar persistencia directamente desde otra conexión MySQL
    const verifyConn = await mysql.createConnection({
      host: env.MYSQL_HOST,
      port: env.MYSQL_PORT,
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: TEST_DB_NAME
    });
    try {
      const [rows] = await verifyConn.query<mysql.RowDataPacket[]>(
        'SELECT COUNT(*) AS count, SUM(total_cents) AS total FROM sales'
      );
      expect(Number(rows[0]?.['count'])).toBe(2);
      expect(Number(rows[0]?.['total'])).toBe(78000);
    } finally {
      await verifyConn.end();
    }
  });

  it('13. Rechaza cantidades inválidas, precios inválidos y modificación directa de stock en PATCH /variants/:id', async () => {
    const { productId, variantA } = await createSampleProductAndVariants();

    const badPriceRes = await request(app).post(`/api/v1/products/${productId}/variants`).send({
      size_label: '14',
      color: 'Blanco',
      sku: 'CSM-POLO-BLA-14',
      unit_price_cents: 0
    });
    expect(badPriceRes.status).toBe(400);
    expect(badPriceRes.body.error.code).toBe('VALIDATION_ERROR');

    const patchStockRes = await request(app).patch(`/api/v1/variants/${variantA.id}`).send({
      stock: 99
    });
    expect(patchStockRes.status).toBe(400);
    expect(patchStockRes.body.error.code).toBe('VALIDATION_ERROR');

    const badQtySaleRes = await request(app)
      .post('/api/v1/sales')
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        items: [{ variant_id: variantA.id, quantity: 1.5 }],
        payment_method: 'CASH',
        amount_received_cents: 50000
      });
    expect(badQtySaleRes.status).toBe(400);
    expect(badQtySaleRes.body.error.code).toBe('VALIDATION_ERROR');

    const zeroMovRes = await request(app).post('/api/v1/inventory/movements').send({
      variant_id: variantA.id,
      kind: 'ADJUSTMENT',
      quantity_delta: 0,
      reason: 'Inválido'
    });
    expect(zeroMovRes.status).toBe(400);
    expect(zeroMovRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('15. Genera el reporte de ventas en PDF válido (GET /api/v1/reports/sales/pdf)', async () => {
    const { variantA } = await createSampleProductAndVariants();

    const movRes = await request(app).post('/api/v1/inventory/movements').send({
      variant_id: variantA.id,
      kind: 'ADJUSTMENT',
      quantity_delta: 10,
      reason: 'Stock inicial para reporte PDF'
    });
    expect(movRes.status).toBe(201);

    const saleRes = await request(app)
      .post('/api/v1/sales')
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        items: [{ variant_id: variantA.id, quantity: 2 }],
        payment_method: 'CARD'
      });
    expect(saleRes.status).toBe(201);
    const folio = saleRes.body.folio as string;

    const pdfRes = await request(app)
      .get('/api/v1/reports/sales/pdf')
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        const stream = res as unknown as NodeJS.ReadableStream;
        stream.on('data', (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        stream.on('end', () => callback(null, Buffer.concat(chunks)));
        stream.on('error', (err) => callback(err, Buffer.alloc(0)));
      });

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(pdfRes.headers['content-disposition']).toContain('attachment;');
    expect(pdfRes.headers['content-disposition']).toContain('.pdf');

    const pdfBuffer = pdfRes.body as Buffer;
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    const pdfContent = pdfBuffer.toString('latin1');
    expect(pdfContent.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfContent.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdfContent).toContain('REPORTE DE VENTAS E INGRESOS');
    expect(pdfContent).toContain(folio);
  });
});
