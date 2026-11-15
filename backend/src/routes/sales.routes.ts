import { Router } from 'express';
import {
  createSale,
  getSale,
  getSalesReport,
  getSalesReportPdf,
  listSales
} from '../controllers/sales.controller.js';

export const salesRouter = Router();

salesRouter.post('/sales', createSale);
salesRouter.get('/sales', listSales);
salesRouter.get('/sales/:id', getSale);
salesRouter.get('/reports/sales', getSalesReport);
salesRouter.get('/reports/sales/pdf', getSalesReportPdf);
