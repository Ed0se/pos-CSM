import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.API_PORT, env.API_HOST, () => {
  console.log(`[POS Server] Corriendo en http://${env.API_HOST}:${env.API_PORT}`);
  console.log(`[POS Server] Entorno: ${env.NODE_ENV}`);
  console.log(`[POS Server] Endpoint de salud: http://${env.API_HOST}:${env.API_PORT}/api/v1/health`);
});

process.on('SIGTERM', () => {
  console.log('[POS Server] Recibida señal SIGTERM, cerrando servidor...');
  server.close(() => {
    console.log('[POS Server] Servidor detenido.');
    process.exit(0);
  });
});
