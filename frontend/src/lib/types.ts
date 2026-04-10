/**
 * types.ts — Types partagés client + serveur
 * Aucune dépendance Node.js — importable depuis n'importe quel contexte
 */

export type Role = 'super_admin' | 'admin_metier' | 'analyste' | 'lecteur_dt' | 'dt'

export interface User {
  id:     string
  name:   string
  email:  string
  role:   Role
  dt?:    string
  avatar: string
}
