import { Request, Response, NextFunction } from 'express';
import * as productsService from '../services/products.service.js';
import { parsePagination } from '../utils/pagination.js';
import {
  createProductSchema,
  createVariantSchema,
  idParamSchema,
  updateProductSchema,
  updateVariantSchema
} from '../validators/products.validator.js';

export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
    let active: boolean | undefined;
    if (req.query['active'] === 'true') active = true;
    if (req.query['active'] === 'false') active = false;

    const result = await productsService.listProducts({
      q,
      active,
      ...pagination
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params['id']);
    const product = await productsService.getProductById(id);
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = createProductSchema.parse(req.body);
    const product = await productsService.createProduct(payload);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params['id']);
    const payload = updateProductSchema.parse(req.body);
    const product = await productsService.updateProduct(id, payload);
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function createVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = idParamSchema.parse(req.params['id']);
    const parsed = createVariantSchema.parse(req.body);
    const { stock: _ignoredStock, ...payload } = parsed;
    const variant = await productsService.addVariantToProduct(productId, payload);
    res.status(201).json(variant);
  } catch (err) {
    next(err);
  }
}

export async function updateVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const variantId = idParamSchema.parse(req.params['id']);
    const parsed = updateVariantSchema.parse(req.body);
    const { stock: _ignoredStock, ...payload } = parsed;
    const variant = await productsService.updateVariant(variantId, payload);
    res.json(variant);
  } catch (err) {
    next(err);
  }
}
