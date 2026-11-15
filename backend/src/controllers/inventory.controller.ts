import { Request, Response, NextFunction } from 'express';
import * as inventoryService from '../services/inventory.service.js';
import { MovementKind } from '../repositories/inventory.repository.js';
import { parsePagination } from '../utils/pagination.js';
import { createMovementSchema } from '../validators/inventory.validator.js';
import { idParamSchema } from '../validators/products.validator.js';

export async function listInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
    const lowStock = req.query['lowStock'] === 'true';

    let stockStatus: 'OUT' | 'LOW' | 'OK' | undefined;
    if (
      req.query['stockStatus'] === 'OUT' ||
      req.query['stockStatus'] === 'LOW' ||
      req.query['stockStatus'] === 'OK'
    ) {
      stockStatus = req.query['stockStatus'];
    }

    let active: boolean | undefined;
    if (req.query['active'] === 'true') active = true;
    if (req.query['active'] === 'false') active = false;

    const result = await inventoryService.getInventory({
      q,
      lowStock: lowStock || undefined,
      stockStatus,
      active,
      ...pagination
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createMovement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = createMovementSchema.parse(req.body);
    const movement = await inventoryService.createManualMovement(payload);
    res.status(201).json(movement);
  } catch (err) {
    next(err);
  }
}

export async function listMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    let variantId: number | undefined;
    if (req.query['variantId'] !== undefined && req.query['variantId'] !== '') {
      variantId = idParamSchema.parse(req.query['variantId']);
    }

    let kind: MovementKind | undefined;
    const rawKind = req.query['kind'];
    if (rawKind === 'ENTRY' || rawKind === 'EXIT' || rawKind === 'ADJUSTMENT' || rawKind === 'SALE') {
      kind = rawKind;
    }

    const result = await inventoryService.getMovements({
      variantId,
      kind,
      ...pagination
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}
