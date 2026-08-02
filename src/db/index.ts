import { Pool as NeonPool } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool as PgPool } from 'pg';
import * as schema from './schema';

declare global {
  var _activePool: any;
}

export const createPool = () => {
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
      try {
        global._activePool = new NeonPool({
          connectionString,
          max: 3,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 5000,
        });
      } catch (err: any) {
        console.error("Failed to initialize Neon Pool:", err);
      }
    } else if (host) {
      global._activePool = new PgPool({
        host,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432,
        ssl: { rejectUnauthorized: false },
        max: 3,
        connectionTimeoutMillis: 5000,
      });
    } else {
      global._activePool = {
        query: async () => {
          throw new Error("DATABASE_URL belum disetting di Environment Variables Vercel.");
        },
        on: () => {},
        connect: async () => {
          throw new Error("DATABASE_URL belum disetting di Environment Variables Vercel.");
        },
        end: async () => {}
      };
    }
  }
  return global._activePool;
};

export const getDb = () => {
  const pool = createPool();
  let connectionString = process.env.DATABASE_URL?.trim();
  if (connectionString) {
    return drizzleNeon(pool, { schema });
  }
  return drizzlePg(pool, { schema });
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




