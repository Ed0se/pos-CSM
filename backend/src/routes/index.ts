import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { productsRouter } from './products.routes.js';
import { inventoryRouter } from './inventory.routes.js';
import { salesRouter } from './sales.routes.js';

export const apiV1Router = Router();

apiV1Router.use('/', healthRouter);
apiV1Router.use('/', productsRouter);
apiV1Router.use('/', inventoryRouter);
apiV1Router.use('/', salesRouter);
