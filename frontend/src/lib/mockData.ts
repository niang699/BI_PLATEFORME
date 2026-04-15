// ─── Types ───────────────────────────────────────────────────────────────────

export type { Role, User } from './types'
import type { Role, User } from './types'
export type DataStatus = 'live' | 'recent' | 'stale'
export type Category = 'facturation' | 'production' | 'maintenance' | 'rh' | 'sig'

export interface Report {
  id: string
  title: string
  description: string
  category: Category
  url: string
  external: boolean  // true = iframe (Dash), false = internal page
  owner: string
  lastRefresh: string
  status: DataStatus
  pinned: boolean
  tags: string[]
  thumbnail?: string
  accessRoles: Role[]
  accessDT?: string[]
}

export interface Alert {
  id: string
  title: string
  message: string
  severity: 'critical' | 'warning' | 'info'
  timestamp: string
  read: boolean
  reportId?: string
}

// ─── Utilisateurs de test ────────────────────────────────────────────────────

export const USERS: User[] = [
  {
    id: '1',
    name: 'Asta Niang',
    email: 'asta.niang@seneau.sn',
    role: 'super_admin',
    avatar: 'AN',
  },
  {
    id: '2',
    name: 'Syaka Sane',
    email: 'syaka.sane@seneau.sn',
    role: 'admin_metier',
    dt: 'Direction Regionale DAKAR 2',
    avatar: 'SS',
  },
  {
    id: '8',
    name: 'Abdou Khadir Gaye',
    email: 'a.gaye@seneau.sn',
    role: 'analyste',
    dt: 'Direction Regionale DAKAR 2',
    avatar: 'AG',
  },
  {
    id: '3',
    name: 'Fatou Sarr',
    email: 'f.sarr@seneau.sn',
    role: 'lecteur_dt',
    dt: 'Direction Regionale ZIGUINCHOR',
    avatar: 'FS',
  },
  {
    id: '4',
    name: 'Younes Hachami',
    email: 'younes.hachami@seneau.sn',
    role: 'analyste',
    dt: 'Direction Regionale DAKAR 1',
    avatar: 'YH',
  },
  {
    id: '5',
    name: 'Mouhamed Dramé',
    email: 'm.drame@seneau.sn',
    role: 'analyste',
    dt: 'Direction Regionale THIES 2',
    avatar: 'MD',
  },
  {
    id: '6',
    name: 'Ibra Fall Wadji',
    email: 'i.wadji@seneau.sn',
    role: 'lecteur_dt',
    dt: 'Direction Regionale SAINT LOUIS',
    avatar: 'IW',
  },
  {
    id: '7',
    name: 'Mouhamed Rassoul Sarr',
    email: 'm.sarr@seneau.sn',
    role: 'dt',
    dt: 'Direction Regionale THIES 1',
    avatar: 'MS',
  },
  {
    id: '9',
    name: 'Ousmane Diallo',
    email: 'o.diallo@seneau.sn',
    role: 'lecteur_dt',
    dt: 'Direction Regionale RUFISQUE',
    avatar: 'OD',
  },
]

// ─── Base temporelle fixe (évite l'erreur d'hydratation SSR/client) ──────────
const _B = new Date('2026-03-15T08:00:00.000Z').getTime()
const _ago = (ms: number) => new Date(_B - ms).toISOString()

// ─── Rapports ────────────────────────────────────────────────────────────────

export const REPORTS: Report[] = [
  {
    id: 'facturation',
    title: 'Facturation & Recouvrement',
    description: 'Suivi CA, encaissements, impayés et taux de recouvrement par DT et secteur.',
    category: 'facturation',
    url: 'http://localhost:8050',
    external: false,
    owner: 'Direction Clientèle',
    lastRefresh: _ago(15 * 60 * 1000),
    status: 'live',
    pinned: true,
    tags: ['KPI', 'Recouvrement', 'Impayés', 'DT'],
    accessRoles: ['super_admin', 'admin_metier', 'analyste', 'lecteur_dt'],
  },
  {
    id: 'recouvrement-dt',
    title: 'Recouvrement par Direction Territoriale',
    description: 'Performance de recouvrement par DR vs objectif 98,5% — alertes DTs à risque, évolution bimestrielle et tableau détaillé.',
    category: 'facturation',
    url: '',
    external: false,
    owner: 'Direction Clientèle',
    lastRefresh: _ago(15 * 60 * 1000),
    status: 'live',
    pinned: true,
    tags: ['Recouvrement', 'DR', 'Objectif', 'Risque'],
    accessRoles: ['super_admin', 'admin_metier', 'analyste', 'lecteur_dt'],
  },
  {
    id: 'score360',
    title: 'Score Client 360°',
    description: 'Segmentation ML des clients : Premium, Stable, À surveiller, Sensible, Critique.',
    category: 'facturation',
    url: 'http://localhost:8050/score360',
    external: true,
    owner: 'DSI — Data Science',
    lastRefresh: _ago(3 * 60 * 60 * 1000),
    status: 'recent',
    pinned: true,
    tags: ['ML', 'Segmentation', 'Score', 'IA'],
    accessRoles: ['super_admin', 'admin_metier', 'analyste'],
  },
  {
    id: 'suivi-releveur',
    title: 'Suivi Releveurs',
    description: 'Performance des équipes de relevé terrain par tournée et secteur géographique.',
    category: 'production',
    url: 'http://localhost:8050/releveur',
    external: true,
    owner: 'Direction Technique',
    lastRefresh: _ago(30 * 60 * 1000),
    status: 'live',
    pinned: true,
    tags: ['Terrain', 'Tournée', 'Performance'],
    accessRoles: ['super_admin', 'admin_metier', 'analyste', 'lecteur_dt', 'dt'],
  },
  {
    id: 'carte-clients',
    title: 'Carte Clients',
    description: 'Visualisation géospatiale de 1,07M clients actifs SEN\'EAU — vue secteurs, points individuels et fiches client.',
    category: 'sig',
    url: '',
    external: false,
    owner: 'Direction Clientèle',
    lastRefresh: _ago(15 * 60 * 1000),
    status: 'live',
    pinned: true,
    tags: ['Carte', 'SIG', 'Clients', 'Géospatial'],
    accessRoles: ['super_admin', 'admin_metier', 'analyste'],
  },
  {
    id: 'prises-facturation',
    title: 'Prises — Situation de Facturation',
    description: 'Analyse détaillée des prises actives non facturées : CA manquant estimé par UO, évolution bimestrielle et dispersion sectorielle.',
    category: 'facturation',
    url: '',
    external: false,
    owner: 'Direction Clientèle',
    lastRefresh: _ago(15 * 60 * 1000),
    status: 'live',
    pinned: false,
    tags: ['Prises', 'CA Manquant', 'Facturation', 'UO'],
    accessRoles: ['super_admin', 'admin_metier', 'analyste'],
  },
  {
    id: 'acl-releveur',
    title: 'Suivi Recouvrement ACL',
    description: 'Matrice recouvrement par Direction × Secteur — tranches aging tj=0, tj+15, tj+30 et solde résiduel. Performance ACL (releveurs).',
    category: 'facturation',
    url: '',
    external: false,
    owner: 'Direction Clientèle',
    lastRefresh: _ago(15 * 60 * 1000),
    status: 'live',
    pinned: true,
    tags: ['ACL', 'Releveur', 'Aging', 'Recouvrement', 'DR', 'Secteur'],
    accessRoles: ['super_admin', 'admin_metier', 'analyste', 'lecteur_dt'],
  },
  {
    id: 'production-eau',
    title: 'Production & Distribution',
    description: 'Volumes produits, pertes réseau, pression et qualité de l\'eau par zone.',
    category: 'production',
    url: '#',
    external: false,
    owner: 'Direction Technique',
    lastRefresh: _ago(48 * 60 * 60 * 1000),
    status: 'stale',
    pinned: false,
    tags: ['Production', 'Volumes', 'NRW'],
    accessRoles: ['super_admin', 'admin_metier', 'analyste'],
  },
  {
    id: 'maintenance',
    title: 'Maintenance & Interventions',
    description: 'Suivi des pannes, délais d\'intervention et planification de la maintenance préventive.',
    category: 'maintenance',
    url: '#',
    external: false,
    owner: 'Direction Technique',
    lastRefresh: _ago(6 * 60 * 60 * 1000),
    status: 'recent',
    pinned: false,
    tags: ['GMAO', 'Pannes', 'Interventions'],
    accessRoles: ['super_admin', 'admin_metier', 'analyste'],
  },

  // ── Rapports RH ──────────────────────────────────────────────────────────
  {
    id: 'rh-dashboard',
    title: 'Tableau de Bord RH',
    description: 'KPIs RH clés : masse salariale, effectif actif, taux de féminisation, heures supplémentaires et formation.',
    category: 'rh',
    url: '/viewer/rh-dashboard',
    external: false,
    owner: 'Direction RH',
    lastRefresh: _ago(1 * 60 * 60 * 1000),
    status: 'live',
    pinned: false,
    tags: ['KPI', 'Masse Salariale', 'Effectif', 'Féminisation'],
    accessRoles: ['super_admin', 'admin_metier', 'analyste'],
  },
  {
    id: 'rh-effectif',
    title: 'Effectif & Répartition',
    description: 'Répartition de l\'effectif par établissement, qualification et type de contrat.',
    category: 'rh',
    url: '/viewer/rh-effectif',
    external: false,
    owner: 'Direction RH',
    lastRefresh: _ago(1 * 60 * 60 * 1000),
    status: 'live',
    pinned: false,
    tags: ['Effectif', 'Établissement', 'Qualification'],
    accessRoles: ['super_admin', 'admin_metier', 'analyste'],
  },
  {
    id: 'rh-salaire',
    title: 'Masse Salariale',
    description: 'Évolution mensuelle de la masse salariale, salaire moyen et répartition par établissement.',
    category: 'rh',
    url: '/viewer/rh-salaire',
    external: false,
    owner: 'Direction RH',
    lastRefresh: _ago(1 * 60 * 60 * 1000),
    status: 'live',
    pinned: false,
    tags: ['Masse Salariale', 'Salaire Moyen', 'Paie'],
    accessRoles: ['super_admin', 'admin_metier'],
  },
  {
    id: 'rh-hs',
    title: 'Heures Supplémentaires',
    description: 'Volume et coût des heures supplémentaires, taux HS par rapport à la masse salariale.',
    category: 'rh',
    url: '/viewer/rh-hs',
    external: false,
    owner: 'Direction RH',
    lastRefresh: _ago(1 * 60 * 60 * 1000),
    status: 'live',
    pinned: false,
    tags: ['Heures Sup', 'Coût', 'Taux HS'],
    accessRoles: ['super_admin', 'admin_metier', 'analyste'],
  },
  {
    id: 'rh-formation',
    title: 'Formation',
    description: 'Heures de formation, collaborateurs formés et répartition par thème et établissement.',
    category: 'rh',
    url: '/viewer/rh-formation',
    external: false,
    owner: 'Direction RH',
    lastRefresh: _ago(1 * 60 * 60 * 1000),
    status: 'live',
    pinned: false,
    tags: ['Formation', 'Compétences', 'Plan Formation'],
    accessRoles: ['super_admin', 'admin_metier', 'analyste'],
  },
]

// ─── Alertes ─────────────────────────────────────────────────────────────────

export const ALERTS: Alert[] = [
  {
    id: '1',
    title: 'Taux recouvrement critique — DR Tambacounda',
    message: 'Le taux de recouvrement de la Direction Régionale Tambacounda est passé sous 40% (37.6%). Action requise.',
    severity: 'critical',
    timestamp: _ago(2 * 60 * 60 * 1000),
    read: false,
    reportId: 'facturation',
  },
  {
    id: '2',
    title: 'Impayés en hausse — DR Saint Louis',
    message: '+18.4% d\'impayés sur 7 jours pour la DR Saint Louis (Secteur Podor). Seuil d\'alerte dépassé (+15%).',
    severity: 'critical',
    timestamp: _ago(3 * 60 * 60 * 1000),
    read: false,
    reportId: 'facturation',
  },
  {
    id: '3',
    title: 'Taux recouvrement faible — DR Ziguinchor',
    message: 'DR Ziguinchor : taux de recouvrement à 44.1% sur le mois en cours. Secteur Kolda en retard.',
    severity: 'warning',
    timestamp: _ago(5 * 60 * 60 * 1000),
    read: false,
    reportId: 'facturation',
  },
  {
    id: '4',
    title: '4 clients basculent en segment Critique',
    message: 'Les clients CLI-0042, CLI-0087, CLI-0134, CLI-0201 ont changé de segment Sensible → Critique.',
    severity: 'warning',
    timestamp: _ago(12 * 60 * 60 * 1000),
    read: false,
    reportId: 'score360',
  },
  {
    id: '5',
    title: 'Secteur Guediawaye II — Anomalie relevé',
    message: 'Absence de données de relevé pour 12 compteurs sur le Secteur Guediawaye II (DR Dakar 2). Vérification requise.',
    severity: 'warning',
    timestamp: _ago(18 * 60 * 60 * 1000),
    read: false,
    reportId: 'suivi-releveur',
  },
  {
    id: '6',
    title: 'Données Score 360° mises à jour',
    message: 'Le calcul hebdomadaire du Score Client 360° est terminé. 300+ clients analysés sur 12 Directions Régionales.',
    severity: 'info',
    timestamp: _ago(24 * 60 * 60 * 1000),
    read: true,
    reportId: 'score360',
  },
  {
    id: '7',
    title: 'Mise à jour DR/Secteurs effectuée',
    message: 'Les référentiels Directions Régionales et Secteurs ont été synchronisés (12 DR, 67 secteurs actifs).',
    severity: 'info',
    timestamp: _ago(48 * 60 * 60 * 1000),
    read: true,
  },
]

// ─── Credentials de test ─────────────────────────────────────────────────────

export const DEMO_CREDENTIALS = [
  { email: 'asta.niang@seneau.sn',    password: 'admin2025',    role: 'Super Admin DSI' },
  { email: 'younes.hachami@seneau.sn',password: 'analyste2025', role: 'Analyste' },
  { email: 'f.sarr@seneau.sn',        password: 'lecteur2025',  role: 'Lecteur DR Ziguinchor' },
  { email: 'o.diallo@seneau.sn',      password: 'rufisque2025', role: 'Lecteur DR Rufisque' },
]

// ─── Commentaires rapports ───────────────────────────────────────────────────

export interface CommentReply {
  id: string
  authorId: string
  authorName: string
  authorAvatar: string
  authorRole: Role
  content: string
  createdAt: string
}

export interface ReportComment {
  id: string
  reportId: string
  authorId: string
  authorName: string
  authorAvatar: string
  authorRole: Role
  content: string
  createdAt: string
  resolved: boolean
  resolvedBy?: string
  replies: CommentReply[]
}

const _ago2 = (ms: number) => new Date(Date.now() - ms).toISOString()

export const MOCK_COMMENTS: ReportComment[] = [
  {
    id: 'c1', reportId: 'facturation',
    authorId: '2', authorName: 'Syaka Sane', authorAvatar: 'SS', authorRole: 'admin_metier',
    content: 'Le CA de mars est en légère baisse sur la DR Dakar 2 — campagne de migration compteur en cours, impact attendu jusqu\'à mi-avril.',
    createdAt: _ago2(2 * 3600000), resolved: false,
    replies: [
      {
        id: 'r1', authorId: '1', authorName: 'Asta Niang', authorAvatar: 'AN', authorRole: 'super_admin',
        content: 'Noté, je vais surveiller l\'évolution sur les 2 prochaines semaines.', createdAt: _ago2(1 * 3600000),
      }
    ]
  },
  {
    id: 'c2', reportId: 'facturation',
    authorId: '4', authorName: 'Younes Hachami', authorAvatar: 'YH', authorRole: 'analyste',
    content: 'Anomalie détectée sur le secteur Pikine : 47 prises facturées en doublon ce mois-ci. À corriger en urgence avant la clôture.',
    createdAt: _ago2(5 * 3600000), resolved: true, resolvedBy: 'Asta Niang',
    replies: []
  },
  {
    id: 'c3', reportId: 'recouvrement-dt',
    authorId: '1', authorName: 'Asta Niang', authorAvatar: 'AN', authorRole: 'super_admin',
    content: 'Taux de recouvrement DR Thiès en forte progression (+8 pts) — actions de terrain payantes. Partager ce retour en réunion mensuelle.',
    createdAt: _ago2(24 * 3600000), resolved: false,
    replies: []
  },
  {
    id: 'c4', reportId: 'prises-facturation',
    authorId: '8', authorName: 'Abdou Khadir Gaye', authorAvatar: 'AG', authorRole: 'analyste',
    content: '320 prises jamais facturées identifiées sur DR Saint-Louis. Données validées avec l\'équipe terrain. Escalade nécessaire.',
    createdAt: _ago2(3 * 24 * 3600000), resolved: false,
    replies: []
  },
]

// ─── Stats globales ──────────────────────────────────────────────────────────

export const PLATFORM_STATS = {
  totalReports:    12,
  activeUsers:     36,
  datasources:     4,
  lastRefreshAll:  _ago(15 * 60 * 1000),
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const CATEGORY_META: Record<Category, { label: string; icon: string; color: string; imgSrc?: string }> = {
  facturation:  { label: 'Facturation',   icon: '💰', imgSrc: '/fcfa.png', color: 'bg-senblue-100 text-senblue-700' },
  production:   { label: 'Production',    icon: '💧', color: 'bg-cyan-100 text-cyan-700'       },
  maintenance:  { label: 'Maintenance',   icon: '🔧', color: 'bg-orange-100 text-orange-700'   },
  rh:           { label: 'RH',            icon: '👥', color: 'bg-purple-100 text-purple-700'   },
  sig:          { label: 'Cartographie',  icon: '🌍', color: 'bg-emerald-100 text-emerald-700' },
}

export const ROLE_META: Record<Role, { label: string; color: string }> = {
  super_admin:  { label: 'Super Admin DSI',   color: 'bg-senblue-500 text-white'  },
  admin_metier: { label: 'Admin Métier',      color: 'bg-sengreen-400 text-white' },
  analyste:     { label: 'Analyste',          color: 'bg-purple-500 text-white'   },
  lecteur_dt:   { label: 'Lecteur DT',        color: 'bg-slate-500 text-white'    },
  dt:           { label: 'Directeur DT',      color: 'bg-amber-500 text-white'    },
}

export function formatRelativeTime(dateStr: string): string {
  const date  = new Date(dateStr)
  const now   = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffM  = Math.floor(diffMs / 60000)
  if (diffM < 1)  return 'À l\'instant'
  if (diffM < 60) return `Il y a ${diffM} min`
  const diffH = Math.floor(diffM / 60)
  if (diffH < 24) return `Il y a ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  return `Il y a ${diffD}j`
}
