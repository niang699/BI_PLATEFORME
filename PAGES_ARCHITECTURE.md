# Pages du Portail BI SEN'EAU — Architecture & Technologies

Ce document couvre les 7 pages principales du dashboard (hors Administration, documentée dans `ADMIN_PAGE_ARCHITECTURE.md`).

---

## Stack commune à toutes les pages

| Couche | Technologie | Rôle |
|---|---|---|
| Framework | **Next.js 14** (App Router) | Routing, SSR, API Routes |
| UI | **React 18** + `'use client'` | Rendu client-side, état local |
| Typage | **TypeScript** | Typage strict |
| Icônes | **Lucide React** | Icônes SVG légères (pas d'emoji dans l'UI) |
| Styles | **Inline styles React** | Design tokens partagés, shadow-only |
| Fonts | Barlow Semi Condensed + Nunito | Hiérarchie typographique |

### Design tokens partagés

| Token | Valeur | Usage |
|---|---|---|
| `C_NAVY` | `#1F3B72` | Couleur primaire |
| `C_GREEN` | `#96C11E` | Succès, accents |
| `C_RED` | `#E84040` | Alertes, erreurs |
| `C_PAGE` | `#f8fafc` | Fond de page |
| `SHADOW` | `0 2px 10px rgba(31,59,114,.10)` | Cartes sans bordure |
| `F_TITLE` | Barlow Semi Condensed | Titres, KPIs |
| `F_BODY` | Nunito | Corps, boutons |

---

## 1. Accueil — `/dashboard`

**Fichier :** `src/app/dashboard/page.tsx`

### Vue d'ensemble

Page d'entrée du portail. Affiche un résumé personnalisé : salutation horaire, KPIs plateforme, rapports épinglés, exploration par catégorie, alertes non lues et statut des services.

### Composants internes

| Composant | Rôle |
|---|---|
| `SH` | En-tête de section avec slot action droit optionnel |
| `PinnedCard` | Carte rapport épinglé (titre, description, statut, propriétaire) |

### État du composant

```typescript
user: User | null          // utilisateur connecté (getCurrentUser() côté client)
greeting: string           // 'Bonjour' | 'Bon après-midi' | 'Bonsoir' (calculé à l'hydratation)
dateLabel: string          // date locale longue format français
```

### Sources de données

Toutes les données sont **statiques** — aucun appel API. Elles proviennent de `@/lib/mockData` :

```
REPORTS[]          → rapports épinglés + rapports récents
ALERTS[]           → alertes non lues (bandeau rouge conditionnel)
PLATFORM_STATS     → { totalReports, activeUsers, datasources }
CATEGORY_META      → libellés et métadonnées des 5 catégories
```

### Sections de la page

```
Hero
  ├── Salutation personnalisée (prénom, heure)
  └── KPIs plateforme : rapports | utilisateurs | sources | alertes

Bandeau alertes (conditionnel)
  → affiché si ALERTS.filter(a => !a.read).length > 0
  → lien "Voir toutes →" vers /dashboard/alerts

Grille principale (1fr + 280px)
  ├── Colonne gauche
  │   ├── Rapports épinglés (REPORTS.filter(r => r.pinned))
  │   ├── Explorer par catégorie (5 tuiles avec compteur)
  │   └── Bloc Hub IA JAMBAR (CTA Ouvrir JAMBAR + Score 360°)
  └── Colonne droite
      ├── Rapports récents (REPORTS non épinglés, 6 premiers)
      └── Statut plateforme (4 services hard-codés : ok)
```

### Patterns notables

- **Salutation horaire** : calculée dans `useEffect` pour éviter un hydration mismatch (le rendu serveur et le rendu client auraient des heures différentes).
- **`suppressHydrationWarning`** : appliqué aux `<span>` affichant `formatRelativeTime()` pour les mêmes raisons.
- Hover sur `PinnedCard` : `translateY(-2px)` + ombre renforcée, entièrement géré en inline (`onMouseEnter` / `onMouseLeave`).

---

## 2. Bibliothèque de Rapports — `/dashboard/reports`

**Fichier :** `src/app/dashboard/reports/page.tsx`

### Vue d'ensemble

Catalogue de tous les rapports du portail. Filtrables par catégorie (onglets) et par recherche texte. Utilise `ReportCard` pour le rendu de chaque rapport.

### Architecture du composant

La page est découpée en deux composants pour gérer le hook `useSearchParams` (qui requiert `Suspense`) :

```
ReportsPage (export default)
└── <Suspense fallback={<TopBar />}>
    └── ReportsContent   ← le vrai composant avec la logique
```

### État du composant (`ReportsContent`)

```typescript
activeTab: Category | 'all'    // catégorie active, synchronisée avec l'URL
searchVal: string               // texte de recherche (filtre client)
```

### Synchronisation URL ↔ onglet

```
Navigation directe vers /dashboard/reports?category=facturation
  → initialCat = searchParams.get('category') → setActiveTab('facturation')

Clic sur onglet
  → handleTabChange('facturation')
  → router.replace('/dashboard/reports?category=facturation', { scroll: false })
  → useEffect([searchParams]) → setActiveTab (sync)
```

Ce pattern permet le bouton retour du navigateur et le partage de liens avec filtre actif.

### Filtrage des rapports

```typescript
const filtered = REPORTS.filter(r => {
  const matchCat    = activeTab === 'all' || r.category === activeTab
  const matchSearch = !searchVal ||
    r.title.toLowerCase().includes(searchVal.toLowerCase()) ||
    (r.tags ?? []).some(t => t.toLowerCase().includes(searchVal.toLowerCase()))
  return matchCat && matchSearch
})
```

Recherche sur : titre + tags. Filtre entièrement côté client, aucun appel réseau.

### Sources de données

- `REPORTS[]` de `@/lib/mockData` — statique
- `CATEGORY_META` — icônes et libellés des catégories

### Rendu

- Grille CSS responsive : `repeat(auto-fill, minmax(300px, 1fr))`
- Chaque rapport → `<ReportCard report={r} />` (composant partagé dans `src/components/`)
- Si aucun résultat → état vide avec SVG inline

---

## 3. Hub IA JAMBAR — `/dashboard/hub-ia`

**Fichier :** `src/app/dashboard/hub-ia/page.tsx`

### Vue d'ensemble

Interface de chat avec l'assistant IA JAMBAR, basé sur l'API Claude (Anthropic). Propose 3 modes distincts avec des historiques de conversation séparés. En mode Rapport, la réponse de l'IA est du JSON structuré qui est parsé et affiché en composant visuel avec export PDF.

### Composants internes

| Composant | Rôle |
|---|---|
| `ReportView` | Affiche un rapport narratif structuré (synthèse, KPIs, positifs, vigilances, recommandations, tableau) |
| `exportReport()` | Génère un document HTML pour impression/PDF dans une fenêtre `window.open` |
| `renderMd()` | Micro-parseur Markdown (gras `**`, backticks `\``, sauts de ligne) vers HTML |

### Les 3 modes

| Mode | `id` | Comportement IA | Prompt système |
|---|---|---|---|
| Analyse BI | `analyse` | Réponse libre en Markdown | Contexte KPIs + indicateurs |
| Glossaire | `glossaire` | Définitions métier | Dictionnaire SEN'EAU |
| Rapport narratif | `rapport` | Réponse JSON structuré (`ReportData`) | Données live facturation + RH injectées |

### État du composant

```typescript
mode: 'analyse' | 'glossaire' | 'rapport'
allMsgs: Record<Mode, Msg[]>               // historique par mode (séparés)
input: string
loading: boolean
allReports: Record<Mode, Record<number, ReportData>>  // rapports parsés, indexés par position dans allMsgs
factKpis: FactKpis | null                  // données live facturation (chargées au montage)
rhKpis: RhKpis | null                      // données live RH (chargées au montage)
user: User | null
```

### Flux de données — Initialisation

Au montage, deux appels parallèles chargent les données live qui seront injectées dans les prompts du mode Rapport :

```
useEffect (mount)
  → Promise.all([
      fetch('/api/facturation/kpis'),   // KPIs facturation temps réel
      fetch('/api/rh/kpis'),            // KPIs RH temps réel
    ])
  → setFactKpis(fact), setRhKpis(rh)
```

### Flux de données — Envoi d'un message (`send()`)

```
Utilisateur saisit un message
  → newMsgs = [...msgs, { role:'user', content: q }]
  → setAllMsgs() (optimiste)

  → POST /api/seni
      body: {
        messages: apiMessages,   // historique avec compression (JSON rapport → '[rapport précédent généré]')
        mode: currentMode,
        kpis: KPI_CONTEXT,       // stats indicateurs statiques (total, atteints, priorité 1…)
        liveData: { fact, rh }   // UNIQUEMENT en mode 'rapport'
      }

  → Réponse : stream SSE (Server-Sent Events)
      → decoder.decode(chunk) → accumulation dans reply
      → setAllMsgs() à chaque chunk (streaming temps réel)

  → Si mode === 'rapport' et stream terminé :
      → JSON.parse(reply) → ReportData
      → setAllReports() → affichage <ReportView>
```

### Optimisation contexte (compression)

Pour éviter de renvoyer les JSON de rapport (> 300 tokens) à chaque échange, les messages assistant précédents en mode rapport sont remplacés par `'[rapport précédent généré]'` avant l'envoi API :

```typescript
const apiMessages = newMsgs.map(m => ({
  role: m.role,
  content: (currentMode === 'rapport' && m.role === 'assistant' && m.content.length > 300)
    ? '[rapport précédent généré]'
    : m.content,
}))
```

### Export PDF

`exportReport(data: ReportData)` construit un document HTML complet avec styles inline, puis ouvre `window.open('', '_blank')` — le navigateur déclenche `window.print()` via `<script>window.onload=()=>window.print()</script>`. Aucune librairie PDF externe.

### API Route

| Route | Méthode | Description |
|---|---|---|
| `/api/seni` | POST | Appel Claude API, stream SSE |
| `/api/facturation/kpis` | GET | KPIs facturation (PostgreSQL) |
| `/api/rh/kpis` | GET | KPIs RH (PostgreSQL) |

---

## 4. Mon Agence 360 — `/dashboard/agence-360`

**Fichier :** `src/app/dashboard/agence-360/page.tsx`

### Vue d'ensemble

Tableau de bord de performance personnalisé pour les Directions Territoriales. Agrège les données réelles de facturation et RH depuis PostgreSQL pour l'année courante et N-1. Affiche KPIs, classements, évolutions bimestrielles et tableaux de groupe.

### Composants internes

| Composant | Rôle |
|---|---|
| `Sk` | Skeleton de chargement (shimmer CSS) |
| `Pill` | Pastille statut colorée (ok / warning / critical / neutral) |
| `KpiCard` | Carte KPI avec valeur, variation N-1, barre de progression, pastille statut |
| `SegHead` | En-tête de segment avec titre, statut et lien "Détail →" |
| `DrTable` | Classement des Directions Régionales par taux de recouvrement |
| `UoTable` | Classement des secteurs (UO) par CA et taux de recouvrement |
| `ChartBimestre` | Graphique en barres SVG inline des taux par bimestre |
| `ChartGroupes` | Barres des groupes de facturation (résidentiel, commercial…) |

### État du composant principal

```typescript
annee: number               // année courante (lazy useState, jamais recalculée)
user: User | null
fact: FactKpiRaw | null     // données facturation année N
factN1: FactKpiRaw | null   // données facturation année N-1 (variations)
rh: RhKpiRaw | null         // données RH
factState: 'loading' | 'ok' | 'error'
rhState:   'loading' | 'ok' | 'error'
lastAt: string              // horodatage dernier refresh
greeting: string            // salutation horaire
```

### Seuils de statut

```typescript
const SEUIL = {
  TAUX_OBJECTIF: 98.5,  // objectif taux recouvrement
  TAUX_WARNING:  95,    // seuil avertissement
  IMPAYE_RATIO:  10,    // % impayés max acceptable
  HS_RATIO:      2.5,   // % heures supp max
  FORMATION_MIN: 50,    // % agents formés minimum
  TAUX_FEM_MIN:  20,    // % féminisation minimum
}
```

### Flux de données

```
Mount / refresh manuel
  → fetchAll(user, annee)
  → AbortController (annule les requêtes précédentes si refresh rapide)
  → Promise.all([
      fetch('/api/facturation/kpis?annee=N&dr=...'),  // filtré par DR si lecteur_dt
      fetch('/api/rh/kpis?annee=N'),
    ])
  → setFact(), setRh(), setFactState('ok'), setRhState('ok')
  → Puis fetch N-1 (facturation seulement, pour les variations)
      fetch('/api/facturation/kpis?annee=N-1&dr=...')
  → setFactN1()
```

**Filtre DR** : si `user.role === 'lecteur_dt'`, le paramètre `&dr=XXXXX` est ajouté pour restreindre les données à la Direction Régionale de l'utilisateur.

### Graphiques SVG inline

Tous les graphiques sont des barres SVG construites directement en JSX, sans librairie externe (pas de Recharts, pas de Chart.js). Exemple `ChartBimestre` :

```
rows triés par bimestre
  → maxTaux = Math.max(100, ...rows.map(r => r.taux_recouvrement))
  → chaque barre = <div style={{ height: (v / maxTaux) * 100 + 'px' }} />
  → couleur = rouge si < SEUIL.TAUX_WARNING, orange si < OBJECTIF, vert sinon
```

### API Routes utilisées

| Route | Méthode | Paramètres | Description |
|---|---|---|---|
| `/api/facturation/kpis` | GET | `annee`, `dr?` | KPIs facturation (CA, encaissement, taux recouvrement, classements DR/UO/groupe, évolution bimestrielle) |
| `/api/rh/kpis` | GET | `annee?` | KPIs RH (effectifs, féminisation, masse salariale, HS, formation) |

### Skeleton loading

Tous les composants acceptent `loading?: boolean`. Quand `true`, ils rendent des `<Sk>` (divs avec animation shimmer CSS `linear-gradient` + `background-size: 200%`) à la place des données. Aucun état "vide" affiché pendant le chargement initial.

---

## 5. Data Gouvernance — `/dashboard/gouvernance`

**Fichier :** `src/app/dashboard/gouvernance/page.tsx`

### Vue d'ensemble

Référentiel des indicateurs qualité de SEN'EAU. Catalogue de tous les indicateurs métier classés par service, processus et type de calcul. Inclut un panneau de roadmap Gantt et un lien vers le module de qualité des données.

### Sources de données

Toutes les données sont **statiques** — fichiers TypeScript, pas de base de données :

```
@/lib/indicateurs       → INDICATEURS[], SERVICES, GROUPES (référentiel métier)
@/lib/roadmapData       → PHASES[], STATUT_META, roadmapStats, GANTT_TOTAL
```

### Composants internes

| Composant | Rôle |
|---|---|
| `KpiCard` | Carte KPI cliquable (bascule le panneau expansible) |
| `PanneauIndicateurs` | Liste de tous les indicateurs avec filtres par service/groupe/priorité |
| `PanneauServices` | Indicateurs groupés par direction métier |
| `PanneauProcessus` | Indicateurs groupés par processus qualité (Management / Réalisation / Support) |
| `PanneauCalcules` | Focus sur les indicateurs avec formule de calcul (vs manuels) |

### Sous-modules (liens)

| Lien | Destination | Description |
|---|---|---|
| Data Quality | `/dashboard/gouvernance/data-quality` | Profil qualité des données |
| Catalogue | `/dashboard/catalog` | Vue catalogue partagé |

### État du composant

```typescript
active: CardId | null     // 'indicateurs' | 'services' | 'processus' | 'calcules' | null
selected: Indicateur | null  // indicateur sélectionné pour le drawer de détail
```

### Pattern panneau expansible

```
Clic KPI Card → toggle(id) → setActive(prev => prev === id ? null : id)
Transition → useEffect([active]) → panelRef.current.scrollIntoView({ behavior:'smooth' })
Panneau → {active === 'indicateurs' && <PanneauIndicateurs />}
```

Un seul panneau visible à la fois — recliquer ferme, cliquer une autre carte bascule.

### Indicateurs disponibles

```typescript
const TOTAL        = INDICATEURS.length
const NB_CALCULES  = INDICATEURS.filter(i => i.calcule).length
const NB_SERVICES  = Object.keys(SERVICES).length       // directions métier
const NB_PROCESSUS = Object.keys(GROUPES).length        // processus qualité
const NB_PRIORITE1 = INDICATEURS.filter(i => i.priorite === 1).length
```

### Roadmap Gantt

`PanneauCalcules` (ou panneau dédié) affiche la roadmap de déploiement des indicateurs sous forme de diagramme Gantt CSS inline :

```
PHASES[]  → chaque phase a { label, debut, fin, statut, description }
parseGanttDate(d) → % position sur l'axe temporel (0-100)
GANTT_TOTAL → durée totale en jours (diviseur de la position)
```

Barres positionnées avec `left` et `width` en `%`, calculés depuis les dates.

---

## 6. Rapports Self-Service — `/dashboard/self-service`

**Fichier :** `src/app/dashboard/self-service/page.tsx`

### Vue d'ensemble

Interface de génération de rapports à la demande et de planification d'envois automatiques. Délègue l'essentiel à deux composants dédiés.

### Structure

```
SelfServicePage
  ├── Hero gradient (navy → noir) avec tabs
  │   ├── Tab "Générer maintenant" → tab='generate'
  │   └── Tab "Planifier" → tab='schedule'
  └── Contenu selon tab
      ├── <GenerateurRapportPDF />   (src/components/GenerateurRapportPDF.tsx)
      └── <RapportsPlanifiesPanel /> (src/components/RapportsPlanifiesPanel.tsx)
```

### État

```typescript
tab: 'generate' | 'schedule'
```

État minimal — toute la logique métier est dans les composants enfants.

### Composant `GenerateurRapportPDF`

Formulaire de configuration d'un rapport : type (Facturation / RH / Recouvrement), indicateurs à inclure, période, format (PDF / Excel / HTML). Génère le rapport en appelant l'API et déclenche le téléchargement.

### Composant `RapportsPlanifiesPanel`

Liste des rapports planifiés avec statut (actif/inactif), fréquence (quotidien / hebdomadaire / mensuel) et destinataires email. Permet de créer, activer/désactiver et supprimer des planifications.

### Icônes utilisées

```typescript
import { FileText, CalendarClock, Zap, Clock3 } from 'lucide-react'

FileText      → onglet "Générer maintenant"
CalendarClock → onglet "Planifier"
Zap           → icône hero de la page
Clock3        → indicateur fréquence dans le bandeau contextuel
```

### Hero gradient

Le header utilise un dégradé sombre unique dans le portail :
```css
background: linear-gradient(135deg, #1F3B72 0%, #162d58 60%, #0e1f3d 100%)
```
Avec deux cercles décoratifs `rgba(150,193,30,.06)` positionnés en `absolute` pour l'effet de profondeur.

---

## 7. Centre d'Alertes — `/dashboard/alerts`

**Fichier :** `src/app/dashboard/alerts/page.tsx`

### Vue d'ensemble

Centre de consultation et de gestion des alertes opérationnelles. Affiche les alertes triées par sévérité avec actions lecture individuelle/globale. Présente aussi les règles d'alerte configurées.

### État du composant

```typescript
alerts: Alert[]                  // copie locale de ALERTS[] (mutable)
filter: 'all' | 'unread'         // filtre actif
```

Les alertes sont initialisées depuis `ALERTS[]` (mockData) et l'état est local — aucune persistance des lectures en base pour l'instant. Rechargement = lectures perdues.

### Actions disponibles

| Action | Handler | Effet |
|---|---|---|
| Marquer une alerte comme lue | `markOne(id)` | `setAlerts(prev => prev.map(a => a.id === id ? {...a, read:true} : a))` |
| Tout marquer comme lu | `markAll()` | `setAlerts(prev => prev.map(a => ({...a, read:true})))` |
| Filtrer non lues | `setFilter('unread')` | `shown = alerts.filter(a => !a.read)` |

### Niveaux de sévérité

```typescript
const SEV_META = {
  critical: { label: 'Critique',      color: '#E84040', icon: <AlertTriangle size={16} /> },
  warning:  { label: 'Avertissement', color: '#f59e0b', icon: <AlertTriangle size={16} /> },
  info:     { label: 'Information',   color: '#3b82f6', icon: <Info          size={16} /> },
}
```

### Règles d'alerte affichées

3 règles hard-codées (`RULES[]`) illustrant les seuils de déclenchement (pas encore dynamiques) :

| Règle | Condition | Fréquence | Sévérité |
|---|---|---|---|
| Taux recouvrement critique | < 40% | Quotidien | Critique |
| Impayés en hausse | > +15% | Hebdomadaire | Avertissement |
| Bascule segment Critique | Changement | Temps réel | Avertissement |

### Icônes utilisées

```typescript
import { BellDot, AlertTriangle, Info, CheckCircle2, Bell } from 'lucide-react'

BellDot      → icône hero si alertes non lues
Bell         → icône hero si tout est lu
AlertTriangle → sévérités critical et warning
Info         → sévérité info
CheckCircle2 → état vide "Aucune alerte non lue"
```

### Comportement visuel

- Alerte non lue : opacité 1, shadow normale (`0 2px 10px`), texte gras
- Alerte lue : opacité 0.65, shadow réduite (`0 1px 6px`), texte normal
- Icône hero : couleur et fond changent dynamiquement selon `unreadNb > 0`

---

## Structure des fichiers partagés

```
src/lib/
├── mockData.ts          ← REPORTS[], ALERTS[], PLATFORM_STATS, CATEGORY_META, formatRelativeTime()
├── indicateurs.ts       ← INDICATEURS[], SERVICES, GROUPES (gouvernance)
├── roadmapData.ts       ← PHASES[], STATUT_META, parseGanttDate, GANTT_TOTAL
├── auth.ts              ← getCurrentUser() côté client (lit le cookie/localStorage)
├── authServer.ts        ← validateSession(), hashPassword() côté serveur uniquement
└── dbPortail.ts         ← Pool PostgreSQL singleton

src/components/
├── TopBar.tsx           ← Barre supérieure partagée (titre, breadcrumb, avatar utilisateur)
├── ReportCard.tsx       ← Carte rapport (mode normal + mode compact)
├── GenerateurRapportPDF.tsx   ← Formulaire génération rapport PDF
└── RapportsPlanifiesPanel.tsx ← Panel rapports planifiés

src/app/api/
├── seni/route.ts        ← API Claude (stream SSE) — Hub IA JAMBAR
├── facturation/
│   └── kpis/route.ts   ← KPIs facturation (PostgreSQL)
└── rh/
    └── kpis/route.ts   ← KPIs RH (PostgreSQL)
```

---

## Résumé — Pages et leur source de données

| Page | Route | Données | Appels API |
|---|---|---|---|
| Accueil | `/dashboard` | Statiques (mockData) | Aucun |
| Bibliothèque | `/dashboard/reports` | Statiques (mockData) | Aucun |
| Hub IA JAMBAR | `/dashboard/hub-ia` | PostgreSQL + Claude API | `/api/seni`, `/api/facturation/kpis`, `/api/rh/kpis` |
| Mon Agence 360 | `/dashboard/agence-360` | PostgreSQL (temps réel) | `/api/facturation/kpis`, `/api/rh/kpis` |
| Data Gouvernance | `/dashboard/gouvernance` | Statiques (fichiers TS) | Aucun |
| Self-Service BI | `/dashboard/self-service` | — (formulaire) | Via composants enfants |
| Centre d'Alertes | `/dashboard/alerts` | Statiques (mockData) | Aucun |
| Administration | `/dashboard/admin` | PostgreSQL | `/api/admin/*`, `/api/cache` |
