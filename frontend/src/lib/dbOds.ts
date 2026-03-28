/**
 * Connexion PostgreSQL — Base sen_ods (Production SEN'EAU)
 * Vues matérialisées : mv_ca, mv_reglement_aging, mv_recouvrement
 *
 * Singleton Pool pour Next.js (évite la multiplication des connexions en dev)
 */
import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var _pgOdsPool: Pool | undefined
}

function createPool(): Pool {
  return new Pool({
    host:     process.env.DB_ODS_HOST     ?? '10.106.99.138',
    port:     parseInt(process.env.DB_ODS_PORT ?? '5432', 10),
    database: process.env.DB_ODS_NAME     ?? 'sen_ods',
    user:     process.env.DB_ODS_USER     ?? 'postgres',
    password: process.env.DB_ODS_PASSWORD ?? 'mysecretpassword',
    max: 5,
    idleTimeoutMillis:     30_000,
    connectionTimeoutMillis: 8_000,
    statement_timeout:     120_000, // 120 s — requêtes analytiques lourdes
  })
}

// En développement, réutilise l'instance globale pour éviter "too many clients"
const pool: Pool =
  process.env.NODE_ENV === 'development'
    ? (globalThis._pgOdsPool ?? (globalThis._pgOdsPool = createPool()))
    : createPool()

export default pool
