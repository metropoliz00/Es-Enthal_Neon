import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString = process.env.DATABASE_URL;
    const host = process.env.SQL_HOST;

    const isLocalhost = (str?: string) => {
      if (!str) return true;
      return str.includes('localhost') || str.includes('127.0.0.1');
    };

    if (connectionString) {
      const needsSsl = !isLocalhost(connectionString);
      global._postgresPool = new Pool({
        connectionString,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    } else if (host) {
      const needsSsl = !isLocalhost(host);
      global._postgresPool = new Pool({
        host,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    } else {
      // Dummy pool if no env set - fail quickly if queried
      global._postgresPool = new Pool({
        host: '127.0.0.1',
        port: 5432,
        max: 1,
        connectionTimeoutMillis: 1000,
      });
    }

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance.
const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });


