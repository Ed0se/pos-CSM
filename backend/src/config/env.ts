import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Load .env from current directory or parent directory (workspace root)
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().default(3000),
  FRONTEND_ORIGIN: z.string().default('http://localhost:4200'),
  MYSQL_HOST: z.string().default('127.0.0.1'),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_DATABASE: z.string().default('colegio_san_miguel_pos'),
  MYSQL_USER: z.string().default('pos_app'),
  MYSQL_PASSWORD: z.string().default(''),
  APP_TIMEZONE: z.string().default('America/Hermosillo'),
  TICKET_SCHOOL_NAME: z.string().default('Colegio San Miguel'),
  TICKET_SCHOOL_ADDRESS: z.string().default(''),
  TICKET_SCHOOL_PHONE: z.string().default(''),
  TICKET_FOOTER: z.string().default('Gracias por su compra')
});

export const env = envSchema.parse(process.env);
