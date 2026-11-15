import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from './app.js';
import * as dbModule from './config/database.js';
import * as salesRepo from './repositories/sales.repository.js';
import { buildSalesReportPdf, encodePdfText } from './utils/pdf-report.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('API v1 Base Tests', () => {
  it('GET /api/v1/health responde 200 cuando la base de datos está conectada', async () => {
    vi.spyOn(dbModule, 'checkDatabaseConnection').mockResolvedValue({ ok: true });

    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body.services).toEqual({
      api: 'up',
      database: 'connected'
    });
  });

  it('GET /api/v1/health responde 503 cuando la base de datos no está disponible', async () => {
    vi.spyOn(dbModule, 'checkDatabaseConnection').mockResolvedValue({
      ok: false,
      message: 'Connection refused'
    });

    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty('status', 'degraded');
    expect(response.body.services.database).toBe('disconnected');
    expect(response.body.database_error).toBe('Connection refused');
  });

  it('GET /api/v1/ruta-inexistente responde 404 con formato de error estándar', async () => {
    const response = await request(app).get('/api/v1/ruta-inexistente');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Ruta no encontrada',
      details: {}
    });
  });

  it('encodePdfText codifica caracteres españoles y escapa paréntesis/barras', () => {
    const encoded = encodePdfText('Año (Escolar) \\ 100% — Español');
    expect(encoded).toBe('A\\361o \\(Escolar\\) \\\\ 100% \\227 Espa\\361ol');
  });

  it('buildSalesReportPdf genera PDF 1.4 válido y paginación multipágina', () => {
    const manySales = Array.from({ length: 45 }, (_, idx) => ({
      id: idx + 1,
      folio: `CSM-000000${String(idx + 1).padStart(2, '0')}`,
      created_at: '2026-11-15T18:00:00.000Z',
      items_count: 2,
      subtotal_cents: 56000,
      discount_cents: 0,
      total_cents: 56000,
      payment_method: 'CASH' as const,
      amount_received_cents: 60000,
      change_cents: 4000
    }));

    const buffer = buildSalesReportPdf({
      report: {
        from: '2026-11-15',
        to: '2026-11-16',
        sales_count: 45,
        units_sold: 90,
        revenue_cents: 2520000,
        by_payment_method: [{ method: 'CASH', sales_count: 45, revenue_cents: 2520000 }],
        top_items: [
          {
            sku: 'CSM-POLO-BLA-10',
            name: 'Playera polo escolar',
            size_label: '10',
            color: 'Blanco',
            units: 90,
            revenue_cents: 2520000
          }
        ]
      },
      sales: manySales,
      salesTotal: 45,
      schoolName: 'Colegio San Miguel',
      folioFilter: 'CSM-0000'
    });

    const content = buffer.toString('latin1');
    expect(content.startsWith('%PDF-1.4')).toBe(true);
    expect(content.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(content).toContain('REPORTE DE VENTAS E INGRESOS');
    expect(content).toContain('CSM-00000001');
    expect(content).toContain('CSM-00000045');
    expect(content).toContain('P\\341gina 1 de 2');
    expect(content).toContain('P\\341gina 2 de 2');
  });

  it('GET /api/v1/reports/sales/pdf responde PDF descargable con encabezados correctos', async () => {
    vi.spyOn(salesRepo, 'getSalesReportData').mockResolvedValue({
      from: '2026-11-15',
      to: '2026-11-16',
      sales_count: 1,
      units_sold: 2,
      revenue_cents: 56000,
      by_payment_method: [{ method: 'CARD', sales_count: 1, revenue_cents: 56000 }],
      top_items: [
        {
          sku: 'CSM-POLO-BLA-10',
          name: 'Playera polo escolar',
          size_label: '10',
          color: 'Blanco',
          units: 2,
          revenue_cents: 56000
        }
      ]
    });
    vi.spyOn(salesRepo, 'findSales').mockResolvedValue({
      data: [
        {
          id: 1,
          folio: 'CSM-00000099',
          created_at: '2026-11-15T18:00:00.000Z',
          items_count: 2,
          subtotal_cents: 56000,
          discount_cents: 0,
          total_cents: 56000,
          payment_method: 'CARD',
          amount_received_cents: 56000,
          change_cents: 0
        }
      ],
      total: 1
    });

    const response = await request(app)
      .get('/api/v1/reports/sales/pdf?from=2026-11-15&to=2026-11-16')
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

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="reporte-ventas-csm-2026-11-15_a_2026-11-16.pdf"'
    );

    const buffer = response.body as Buffer;
    const content = buffer.toString('latin1');
    expect(content.startsWith('%PDF-1.4')).toBe(true);
    expect(content.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(content).toContain('CSM-00000099');
  });
});
