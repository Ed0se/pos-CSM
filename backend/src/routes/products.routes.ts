import { Router } from 'express';
import {
  createProduct,
  createVariant,
  getProduct,
  listProducts,
  updateProduct,
  updateVariant
} from '../controllers/products.controller.js';

export const productsRouter = Router();

productsRouter.get('/products', listProducts);
productsRouter.post('/products', createProduct);
productsRouter.get('/products/:id', getProduct);
productsRouter.patch('/products/:id', updateProduct);
productsRouter.post('/products/:id/variants', createVariant);
productsRouter.patch('/variants/:id', updateVariant);
