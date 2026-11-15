import { Request, Response, NextFunction } from 'express';
import * as salesService from '../services/sales.service.js';
import { ValidationError } from '../utils/errors.js';
import { parsePagination } from '../utils/pagination.js';
import { idParamSchema } from '../validators/products.validator.js';
import {
  createSaleSchema,
  dateStringSchema,
  idempotencyKeySchema,
  PaymentMethod,
  paymentMethodSchema
} from '../validators/sales.validator.js';

export async function createSale(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawKey = req.header('Idempotency-Key');
    const keyResult = idempotencyKeySchema.safeParse(rawKey);
    if (!keyResult.success) {
      throw new ValidationError(
        keyResult.error.issues[0]?.message ?? 'El encabezado Idempotency-Key es inválido',
        { header: 'Idempotency-Key' }
      );
    }

    const payload = createSaleSchema.parse(req.body);
    const { sale, replayed } = await salesService.createSale(keyResult.data, payload);

    res.status(replayed ? 200 : 201).json(sale);
  } catch (err) {
    next(err);
  }
}

function parseReportQueryParams(query: Request['query']): {
  from?: string;
  to?: string;
  folio?: string;
} {
  const rawFrom = typeof query['from'] === 'string' ? query['from'].trim() : '';
  const rawTo = typeof query['to'] === 'string' ? query['to'].trim() : '';
  const rawFolio = typeof query['folio'] === 'string' ? query['folio'].trim() : '';

  return {
    from: rawFrom.length > 0 ? dateStringSchema.parse(rawFrom) : undefined,
    to: rawTo.length > 0 ? dateStringSchema.parse(rawTo) : undefined,
    folio: rawFolio.length > 0 ? rawFolio : undefined
  };
}

export async function listSales(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const { from, to, folio } = parseReportQueryParams(req.query);

    let paymentMethod: PaymentMethod | undefined;
    if (typeof req.query['paymentMethod'] === 'string' && req.query['paymentMethod'].trim().length > 0) {
      paymentMethod = paymentMethodSchema.parse(req.query['paymentMethod'].trim());
    }

    const result = await salesService.listSales({
      from,
      to,
      folio,
      paymentMethod,
      ...pagination
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getSale(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params['id']);
    const sale = await salesService.getSaleById(id);
    res.json(sale);
  } catch (err) {
    next(err);
  }
}

export async function getSalesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { from, to } = parseReportQueryParams(req.query);
    const report = await salesService.getSalesReport({ from, to });
    res.json(report);
  } catch (err) {
    next(err);
  }
}

export async function getSalesReportPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { from, to, folio } = parseReportQueryParams(req.query);
    const { buffer, filename } = await salesService.generateSalesReportPdf({ from, to, folio });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.status(200).send(buffer);
  } catch (err) {
    next(err);
  }
}
