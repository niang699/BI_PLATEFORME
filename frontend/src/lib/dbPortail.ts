/**
 * Connexion PostgreSQL — Base Portail_DATA
 * Gestion des utilisateurs, sessions et logs d'accès
 */
import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var _pgPortailPool: Pool | undefined
}

function createPool(): Pool {
  return new Pool({
    host:     process.env.DB_PORTAIL_HOST     ?? '10.106.99.138',
    port:     parseInt(process.env.DB_PORTAIL_PORT ?? '5432', 10),
    database: process.env.DB_PORTAIL_NAME     ?? 'Portail_DATA',
    user:     process.env.DB_PORTAIL_USER     ?? 'postgres',
    password: process.env.DB_PORTAIL_PASSWORD ?? 'mysecretpassword',
    max: 5,
    idleTimeoutMillis:      30_000,
    connectionTimeoutMillis: 8_000,
  })
}

const pool: Pool =
  process.env.NODE_ENV === 'development'
    ? (globalThis._pgPortailPool ?? (globalThis._pgPortailPool = createPool()))
    : createPool()

export default pool
