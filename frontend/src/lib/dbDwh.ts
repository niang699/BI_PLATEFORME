/**
 * Connexion PostgreSQL — Base sen_dwh (DWH SEN'EAU)
 * Tables : API_CLIENT, ...
 *
 * Singleton Pool pour Next.js (évite la multiplication des connexions en dev)
 */
import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var _pgDwhPool: Pool | undefined
}

function createPool(): Pool {
  return new Pool({
    host:     process.env.DB_DWH_HOST     ?? '10.106.99.138',
    port:     parseInt(process.env.DB_DWH_PORT ?? '5432', 10),
    database: process.env.DB_DWH_NAME     ?? 'sen_dwh',
    user:     process.env.DB_DWH_USER     ?? 'postgres',
    password: process.env.DB_DWH_PASSWORD ?? 'mysecretpassword',
    max: 5,
    idleTimeoutMillis:       30_000,
    connectionTimeoutMillis:  8_000,
    statement_timeout:       30_000,
  })
}

const pool: Pool =
  process.env.NODE_ENV === 'development'
    ? (globalThis._pgDwhPool ?? (globalThis._pgDwhPool = createPool()))
    : createPool()

export default pool
