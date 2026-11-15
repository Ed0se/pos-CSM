import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { apiV1Router } from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { NotFoundError } from './utils/errors.js';

export const app = express();

app.use(cors({
  origin: env.FRONTEND_ORIGIN,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Montar versión 1 de la API
app.use('/api/v1', apiV1Router);

// Ruta no encontrada
app.use((_req, _res, next) => {
  next(new NotFoundError('Ruta no encontrada'));
});

// Manejador centralizado de errores
app.use(errorHandler);
