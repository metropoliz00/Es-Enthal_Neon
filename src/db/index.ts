import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    try {
      let connectionString = process.env.DATABASE_URL?.trim();
      let host = process.env.SQL_HOST?.trim();

      // Remove surrounding quotes, spaces, angle brackets
      if (connectionString) {
        connectionString = connectionString.replace(/^["'<]+|["'>]+$/g, '').trim();
      }
      if (host) {
        host = host.replace(/^["'<]+|["'>]+$/g, '').trim();
      }

      const isLocalhost = (str?: string) => {
        if (!str) return true;
        return str.includes('localhost') || str.includes('127.0.0.1');
      };

      if (connectionString) {
        const needsSsl = !isLocalhost(connectionString);
        global._postgresPool = new Pool({
          connectionString,
          ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
          max: 2,
          idleTimeoutMillis: 10000,
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
          max: 2,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 5000,
        });
      } else {
        // Safe mock pool if env missing - returns error on query without TCP socket attempt
        const dummyPool = {
          query: async () => {
            throw new Error("DATABASE_URL belum diisi pada Environment Variables Vercel.");
          },
          on: () => {},
          connect: async () => {
            throw new Error("DATABASE_URL belum diisi pada Environment Variables Vercel.");
          },
          end: async () => {}
        } as unknown as Pool;
        
        global._postgresPool = dummyPool;
      }

      if (global._postgresPool && typeof global._postgresPool.on === 'function') {
        global._postgresPool.on('error', (err: any) => {
          console.error('Unexpected error on idle SQL pool client:', err?.message || err);
        });
      }
    } catch (err: any) {
      console.error("Failed to initialize PostgreSQL pool:", err?.message || err);
      global._postgresPool = {
        query: async () => {
          throw new Error("Gagal menginisialisasi Pool Database: " + (err?.message || "Format DATABASE_URL salah"));
        },
        on: () => {},
        connect: async () => {
          throw new Error("Gagal menginisialisasi Pool Database");
        },
        end: async () => {}
      } as unknown as Pool;
    }
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance.
const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });


