import { Router } from 'express';
import {
  createMovement,
  listInventory,
  listMovements
} from '../controllers/inventory.controller.js';

export const inventoryRouter = Router();

inventoryRouter.get('/inventory', listInventory);
inventoryRouter.post('/inventory/movements', createMovement);
inventoryRouter.get('/inventory/movements', listMovements);
