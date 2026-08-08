import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const { Pool } = pg;

declare global {
  var _activePool: pg.Pool | undefined;
}

export const createPool = (): pg.Pool => {
  if (!global._activePool) {
    let connectionString = process.env.DATABASE_URL?.trim();
    if (connectionString) {
      connectionString = connectionString.replace(/^["'<]+|["'>]+$/g, '').trim();
    }

    let host = process.env.SQL_HOST?.trim();
    if (host) {
      host = host.replace(/^["'<]+|["'>]+$/g, '').trim();
    }

    if (connectionString) {
      global._activePool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    } else if (host) {
      global._activePool = new Pool({
        host,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    } else {
      global._activePool = {
        query: async () => {
          throw new Error("DATABASE_URL belum disetting di Environment Variables.");
        },
        on: () => {},
        connect: async () => {
          throw new Error("DATABASE_URL belum disetting di Environment Variables.");
        },
        end: async () => {}
      } as unknown as pg.Pool;
    }
  }
  return global._activePool;
};

export const getDb = () => {
  const pool = createPool();
  return drizzle(pool, { schema });
};

export const db = new Proxy({} as any, {
  get: (_target, prop) => {
    const instance = getDb();
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  }
});




