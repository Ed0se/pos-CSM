import mysql, { Pool } from 'mysql2/promise';
import { env } from './env.js';

export const pool: Pool = mysql.createPool({
  host: env.MYSQL_HOST,
  port: env.MYSQL_PORT,
  user: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  database: env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00', // UTC obligatorio
  dateStrings: true,
  decimalNumbers: true
});

export async function checkDatabaseConnection(): Promise<{ ok: boolean; message?: string }> {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.query('SELECT 1');
      return { ok: true };
    } finally {
      connection.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al conectar con MySQL';
    return { ok: false, message };
  }
}
