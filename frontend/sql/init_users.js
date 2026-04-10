/**
 * init_users.js — Initialisation des utilisateurs dans Portail_DATA
 * Génère les hash bcrypt et insère/met à jour les comptes
 *
 * Usage : node sql/init_users.js
 */
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')

const pool = new Pool({
  host:     '10.106.99.138',
  port:     5432,
  database: 'Portail_DATA',
  user:     'postgres',
  password: 'mysecretpassword',
})

const USERS = [
  { nom: 'Niang',   prenom: 'Asta',         email: 'asta.niang@seneau.sn',    password: 'admin2025',    role: 'super_admin',  dt: null },
  { nom: 'Sane',    prenom: 'Syaka',         email: 'syaka.sane@seneau.sn',    password: 'admin2025',    role: 'admin_metier', dt: 'Direction Regionale DAKAR 2' },
  { nom: 'Hachami', prenom: 'Younes',        email: 'younes.hachami@seneau.sn',password: 'analyste2025', role: 'analyste',     dt: null },
  { nom: 'Sarr',    prenom: 'Fatou',         email: 'f.sarr@seneau.sn',        password: 'lecteur2025',  role: 'lecteur_dt',   dt: 'Direction Regionale ZIGUINCHOR' },
  { nom: 'Diallo',  prenom: 'Ousmane',       email: 'o.diallo@seneau.sn',      password: 'rufisque2025', role: 'lecteur_dt',   dt: 'Direction Regionale RUFISQUE' },
]

async function main() {
  const client = await pool.connect()
  try {
    console.log('Connexion à Portail_DATA...\n')

    for (const u of USERS) {
      process.stdout.write(`  Génération hash pour ${u.email}... `)
      const hash = await bcrypt.hash(u.password, 12)

      const res = await client.query(
        `INSERT INTO portail_users (nom, prenom, email, password_hash, role, dt, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (email) DO UPDATE
           SET password_hash = EXCLUDED.password_hash,
               role          = EXCLUDED.role,
               dt            = EXCLUDED.dt,
               is_active     = true
         RETURNING id, email, role`,
        [u.nom, u.prenom, u.email, hash, u.role, u.dt]
      )
      console.log(`✓  id=${res.rows[0].id}  [${res.rows[0].role}]`)
    }

    const count = await client.query('SELECT COUNT(*) FROM portail_users')
    console.log(`\n✅ ${count.rows[0].count} utilisateur(s) dans Portail_DATA.`)
    console.log('\nVous pouvez maintenant vous connecter avec :')
    USERS.forEach(u => console.log(`   ${u.email}  /  ${u.password}`))

  } catch (err) {
    console.error('\n❌ Erreur :', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
