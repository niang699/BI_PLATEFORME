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
    // Pool agrandi : serveur partagé avec beaucoup de services, requêtes analytiques lourdes
    max:                     15,
    min:                      2,      // garder 2 connexions chaudes en permanence
    idleTimeoutMillis:       60_000,  // libère après 60s d'inactivité
    connectionTimeoutMillis: 20_000,  // 20s pour obtenir une connexion du pool
    statement_timeout:      120_000,  // 120s — requêtes analytiques lourdes (UNION ALL x5)
    // Keepalive : évite les déconnexions silencieuses par le firewall/NAT
    keepAlive:               true,
    keepAliveInitialDelayMillis: 10_000,
  })
}

// En développement, réutilise l'instance globale pour éviter "too many clients"
const pool: Pool =
  process.env.NODE_ENV === 'development'
    ? (globalThis._pgOdsPool ?? (globalThis._pgOdsPool = createPool()))
    : createPool()

export default pool
