# Page Administration — Architecture & Technologies

## Vue d'ensemble

La page Administration (`/dashboard/admin`) est le centre de contrôle du Portail BI SEN'EAU. Elle permet de gérer les utilisateurs, les droits d'accès aux rapports, de visualiser le catalogue de rapports et de monitorer le système. L'accès est restreint aux rôles `super_admin` et `admin_metier`.

---

## Stack technologique

| Couche | Technologie | Rôle |
|---|---|---|
| Framework | **Next.js 14** (App Router) | Routing, SSR, API Routes |
| UI | **React 18** + `'use client'` | Rendu client-side, état local |
| Typage | **TypeScript** | Typage strict (Role, User, Tab…) |
| Icônes | **Lucide React** | Icônes SVG légères |
| Base de données | **PostgreSQL** | Stockage utilisateurs, accès, logs |
| ORM/Driver | **node-postgres (pg)** via pool | Connexions PostgreSQL |
| Authentification | Cookie opaque + `validateSession()` | Token aléatoire 96 chars, session stockée en DB + Redis |
| Styles | **Inline styles** React | Design tokens partagés, shadow-only |
| Fonts | Barlow Semi Condensed + Nunito | Hiérarchie typographique |

---

## Architecture des fichiers

```
src/app/dashboard/admin/
└── page.tsx                  ← Page principale (client component, ~1000 lignes)

src/app/api/admin/
├── users/route.ts            ← CRUD utilisateurs (GET / POST / PUT / DELETE)
├── access/route.ts           ← Matrice d'accès rapports (GET / PUT)
└── columns/route.ts          ← Colonnes Power BI disponibles

src/lib/
├── auth.ts                   ← fetchCurrentUser() côté client
├── authServer.ts             ← validateSession(), hashPassword(), COOKIE_NAME
├── dbPortail.ts              ← Pool PostgreSQL (singleton)
├── mockData.ts               ← REPORTS[] (source de vérité des rapports)
└── types.ts                  ← Types Role, User, Report…
```

---

## Structure de la page (`page.tsx`)

### 1. Constantes statiques (module-level)

Définies en dehors du composant React — elles ne changent jamais à l'exécution.

```
ROLES_FORM      Rôles disponibles dans le formulaire utilisateur (5 rôles)
DR_LIST         16 Directions Régionales SEN'EAU
ROLES_DEF       Définition complète des rôles : couleur, permissions, description
CAT_META        Métadonnées des catégories de rapports (couleur, label)
NAV_PAGES       11 pages/onglets du sidebar avec leurs rôles par défaut
card            Style CSS card réutilisable (shadow-only, borderRadius 14)
TH / TD         Styles de tableau partagés
```

### 2. Composants internes

Tous définis dans le même fichier pour éviter la prop-drilling et le découpage inutile.

| Composant | Type | Rôle |
|---|---|---|
| `Field` | Fonction | Input labelisé réutilisable dans les formulaires |
| `UserModal` | Fonction | Modal création/édition utilisateur (overlay blur) |
| `RoleBadge` | Fonction | Badge coloré affichant le rôle d'un utilisateur |
| `UserAvatar` | Fonction | Avatar initiales avec couleur du rôle |
| `KpiStat` | Fonction | Carte KPI style gouvernance (icon + chiffre + label) |
| `SectionHeader` | Fonction | En-tête de section avec slot droit optionnel |

### 3. État du composant principal (`AdminPage`)

```typescript
// Utilisateur connecté
currentUser: User | null
loaded: boolean

// Navigation
activeTab: 'utilisateurs' | 'matrice' | 'rapports' | 'systeme'

// Gestion utilisateurs
apiUsers: ApiUserFull[]
usersLoading / usersError
drawerUser: ApiUserFull | null      // panneau latéral droite
modal: 'create' | ApiUserFull | null
search: string
roleFilter: string
confirmDisable: ApiUserFull | null  // confirmation désactivation

// Matrice rapports × rôles
accessMatrix: Record<reportId, Role[]>  // état courant (editable)
dbMatrix: Record<reportId, Role[]>      // référence serveur (GET)
matrixDirty / savingMatrix / saveOk / saveErr

// Matrice navigation × rôles
navMatrix: Record<pageId, Role[]>
baseNavMatrix: Record<pageId, Role[]>   // référence initiale (constante)
navDirty: boolean

// Système
cacheStatus / cacheResult / cacheError
```

---

## Les 4 onglets

### Onglet 1 — Utilisateurs

Affiche et gère la liste des utilisateurs du portail.

**Flux de données :**
```
AdminPage mount
  → loadUsers()
  → GET /api/admin/users
  → PostgreSQL: SELECT * FROM portail_users ORDER BY is_active, role, nom
  → setApiUsers([...])
  → rendu du tableau
```

**Fonctionnalités :**
- Recherche texte (nom, prénom, email) + filtre par rôle — entièrement côté client
- Création utilisateur → `UserModal` → `POST /api/admin/users`
- Édition utilisateur → `UserModal` → `PUT /api/admin/users?id=X`
- Désactivation → soft delete → `DELETE /api/admin/users?id=X`
  - Met `is_active = false` + révoque les sessions actives en base
  - Impossible de se désactiver soi-même (guard côté API)
- Clic sur un utilisateur → ouvre le **Drawer** latéral (panneau droit)
  - Affiche les rapports accessibles pour son rôle en temps réel

**Sécurité du formulaire :**
- Email désactivé en mode édition (champ `disabled`)
- Mot de passe optionnel en édition (vide = inchangé)
- Champ DR conditionnel : apparaît uniquement pour `lecteur_dt`, `admin_metier`, `dt`
- Hash bcrypt du mot de passe fait côté serveur (`hashPassword()`)

### Onglet 2 — Matrice des rôles

Deux tables interactives de gestion des droits d'accès.

#### Table A : Rapports × Rôles

```
Lignes     : tous les rapports (REPORTS[] de mockData)
Colonnes   : 5 rôles (super_admin, admin_metier, analyste, lecteur_dt, dt)
Cellules   : bouton toggle (Check / —) cliquable uniquement si isSuperAdmin
```

**Flux de synchronisation :**
```
mount → GET /api/admin/access → setDbMatrix() + setAccessMatrix()
toggle → setAccessMatrix() local + setMatrixDirty(true)
save  → PUT /api/admin/access → {access: accessMatrix}
      → upsert PostgreSQL (portail_report_access)
      → INSERT portail_access_change_log (audit trail)
      → setDbMatrix(accessMatrix) + setMatrixDirty(false)
annuler → setAccessMatrix({...baseMatrix}) + setMatrixDirty(false)
```

**Visuel de changement :**
- Ligne fond jaune `#fffbeb` si modifiée
- Point orange à gauche du nom du rapport
- Bordure colorée sur le bouton toggle (vert = accordé, rouge = révoqué)
- Bandeau d'avertissement en haut avec compteur de changements

#### Table B : Navigation × Rôles

```
Lignes     : 11 pages/onglets du sidebar (NAV_PAGES)
Colonnes   : 5 rôles (identiques)
Cellules   : même comportement que la table A
Sections   : "Navigation" (bleu navy) | "Accès rapide" (violet)
```

**Différence clé avec la table A :** la table navigation est gérée uniquement en état local (pas de persistance API pour l'instant) — `baseNavMatrix` est initialisée depuis `NAV_PAGES.defaultRoles` et ne change pas au fil du temps.

**Badge onglet commun :** `totalDirtyCount = countChanges (rapports) + countNavChanges (nav)`

### Onglet 3 — Rapports

Vue catalogue des rapports groupés par catégorie. Lecture seule.

- Source : `REPORTS[]` de `mockData.ts`
- Groupement côté client via `reduce` : `Record<category, Report[]>`
- Affiche : statut (live/recent/stale), tags, rôles ayant accès, liens externes
- Pas d'appel API — données statiques

### Onglet 4 — Système

Monitoring et outils d'administration système.

**Vidage du cache :**
```
Bouton "Vider le cache"
  → DELETE /api/cache
  → Réponse: { cleared: N }
  → Affichage résultat (N clés supprimées, horodatage)
  → Auto-reset après 8 secondes
```

---

## API Routes

### `GET /api/admin/users`

```
Auth     : cookie JWT → validateSession() → rôle in [super_admin, admin_metier]
Query    : SELECT id, nom, prenom, email, role, dt, is_active, created_at, last_login
           FROM portail_users ORDER BY is_active DESC, role, nom, prenom
Réponse  : { users: ApiUserFull[] }
```

### `POST /api/admin/users`

```
Auth     : idem
Body     : { nom, prenom, email, password, role, dt? }
Actions  : hashPassword(password) → INSERT portail_users → INSERT portail_access_logs
Guard    : email unique (catch duplicate key), rôle dans VALID_ROLES[]
Réponse  : { user } HTTP 201
```

### `PUT /api/admin/users?id=X`

```
Auth     : idem
Body     : champs partiels (seuls les champs présents sont mis à jour)
           password → hashPassword si présent
           dt → null si rôle sans DR
Actions  : UPDATE portail_users SET ... WHERE id=X → INSERT portail_access_logs
Réponse  : { user }
```

### `DELETE /api/admin/users?id=X`

```
Auth     : idem + guard (id !== auth.id)
Actions  : UPDATE portail_users SET is_active=false
           DELETE FROM portail_sessions WHERE user_id=X  (révocation sessions)
           INSERT portail_access_logs
Réponse  : { ok: true }
```

### `GET /api/admin/access`

```
Auth     : super_admin ou admin_metier
Query    : SELECT report_id, role, granted FROM portail_report_access
Réponse  : { access: Record<reportId, Role[]> }
           (uniquement les rôles où granted=true)
```

### `PUT /api/admin/access`

```
Auth     : super_admin uniquement
Body     : { access: Record<reportId, Role[]> }
Actions  : BEGIN
           → upsert chaque (reportId, role, granted) dans portail_report_access
           → INSERT portail_access_change_log pour chaque changement effectif
           COMMIT (ou ROLLBACK si erreur)
Réponse  : { ok: true, saved: N, changed: M }
```

---

## Schéma base de données (tables impliquées)

```sql
-- Utilisateurs du portail
portail_users (
  id            SERIAL PRIMARY KEY,
  nom           TEXT NOT NULL,
  prenom        TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL,      -- super_admin | admin_metier | analyste | lecteur_dt | dt
  dt            TEXT,               -- Direction Régionale (nullable)
  is_active     BOOLEAN DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    INTEGER REFERENCES portail_users(id)
)

-- Matrice d'accès rapports × rôles
portail_report_access (
  report_id   TEXT NOT NULL,
  role        TEXT NOT NULL,
  granted     BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  INTEGER REFERENCES portail_users(id),
  PRIMARY KEY (report_id, role)
)

-- Log d'audit des changements d'accès
portail_access_change_log (
  id          SERIAL PRIMARY KEY,
  changed_by  INTEGER REFERENCES portail_users(id),
  change_type TEXT,
  report_id   TEXT,
  role        TEXT,
  old_value   BOOLEAN,
  new_value   BOOLEAN,
  changed_at  TIMESTAMPTZ DEFAULT NOW()
)

-- Log général des actions
portail_access_logs (
  id        SERIAL PRIMARY KEY,
  user_id   INTEGER REFERENCES portail_users(id),
  email     TEXT,
  action    TEXT,   -- 'user_created' | 'user_updated' | 'user_disabled'
  detail    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Sessions actives (token opaque aléatoire, 96 chars hex)
portail_sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER REFERENCES portail_users(id),
  expires_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT
)
```

---

## Sécurité

### Garde d'accès côté frontend

```typescript
// Affichage bloquant dès que l'utilisateur est chargé
if (currentUser?.role !== 'super_admin' && currentUser?.role !== 'admin_metier') {
  return <EcranAccesRestreint />
}

// Actions Super Admin uniquement
if (currentUser?.role !== 'super_admin') return  // toggleCell, toggleNavCell
```

### Garde d'accès côté API

Chaque route API valide le cookie de session via `validateSession(token)` avant toute opération PostgreSQL. Sans cookie valide ou rôle insuffisant → HTTP 403.

### Soft delete

La suppression d'utilisateur ne supprime pas la ligne en base. Elle positionne `is_active = false` et révoque les sessions actives. L'historique est conservé et auditable.

### Audit trail

Chaque modification de la matrice d'accès est enregistrée dans `portail_access_change_log` avec `old_value`, `new_value`, `changed_by` et `changed_at`. Les créations/modifications d'utilisateurs sont loggées dans `portail_access_logs`.

---

## Authentification — Mots de passe & Tokens

### 1. Le mot de passe — bcrypt (hachage, pas chiffrement)

#### Concept fondamental : on ne chiffre pas, on hache

Un mot de passe ne se déchiffre **jamais**. Ce n'est pas du chiffrement (réversible), c'est du **hachage** (irréversible).

| | Chiffrement | Hachage |
|---|---|---|
| Réversible ? | Oui, avec une clé | **Non, impossible** |
| Algorithmes | AES, RSA… | bcrypt, SHA-256, Argon2… |
| Usage | Données à déchiffrer | Vérification de secret |
| Usage ici | — | Mots de passe utilisateurs |

#### À la création du compte — `authServer.ts`

```typescript
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)   // coût = 12 → 4096 itérations
}
```

Quand un utilisateur est créé avec le mot de passe `"MonPass123"`, bcrypt réalise 3 étapes :

```
Étape 1 — Générer un SALT aléatoire (16 bytes)
          $2a$12$X7hBm3pQ9RzKlV8nWqYjAu...

Étape 2 — Combiner : salt + "MonPass123"

Étape 3 — Itérer le calcul 2^12 = 4096 fois

Résultat stocké en base :
$2a$12$X7hBm3pQ9RzKlV8nWqYjAu7GdF2eHsP1mNcT6yIbE0wZvLkOa3Xi
├── $2a$  → version de l'algorithme bcrypt
├── $12$  → coût (4096 itérations)
├── X7hBm3pQ9RzKlV8nWqYjAu → salt (22 chars, 16 bytes)
└── 7GdF2eHsP1mNcT6yIbE0wZvLkOa3Xi → résultat du hachage (31 chars)
```

Le salt est **unique et aléatoire pour chaque utilisateur** : deux utilisateurs avec le même mot de passe auront deux hashes totalement différents en base.

#### À la connexion — `authServer.ts`

```typescript
const valid = row && (await bcrypt.compare(password, row.password_hash))
```

bcrypt **rerefait le calcul** depuis le salt extrait du hash stocké et compare les résultats. Il ne déchiffre rien — il rejoue le même calcul et vérifie que les sorties correspondent.

#### Pourquoi le coût 12 ?

Plus le coût est élevé, plus le calcul est lent intentionnellement.

| Coût | Temps calcul | Tentatives/seconde d'un attaquant |
|---|---|---|
| 10 | ~65 ms | ~15 |
| **12** | **~250 ms** | **~4** |
| 14 | ~1 s | ~1 |

À coût 12, tester 1 milliard de mots de passe prendrait environ **8 ans** même avec du matériel dédié.

#### Peut-on retrouver le mot de passe original ?

**Non, jamais.** Même les développeurs du portail ne peuvent pas retrouver le mot de passe d'un utilisateur. Si un utilisateur l'oublie, la seule option est de le **réinitialiser** en générant un nouveau hash avec `hashPassword()`.

---

### 2. Le token de session — aléatoire pur (pas JWT)

#### Ce n'est pas un JWT

Beaucoup d'applications utilisent **JWT** (JSON Web Token) : un token qui contient les données de l'utilisateur encodées en Base64 et signées. Ici le choix est différent — un **token opaque** : une chaîne aléatoire qui ne contient aucune information, juste une clé de recherche en base.

| | JWT | Token opaque (ce projet) |
|---|---|---|
| Contient des données ? | Oui (décodable sans DB) | Non (juste un identifiant) |
| Révocable immédiatement ? | Non (valide jusqu'à expiration) | **Oui** (suppression en DB/Redis) |
| Taille | ~200-500 chars | 96 chars hex |
| Vérification | Signature cryptographique | Lookup DB ou Redis |

#### Génération — `authServer.ts`

```typescript
function makeToken(): string {
  return randomBytes(48).toString('hex')   // 96 caractères hexadécimaux
}
```

`randomBytes(48)` utilise le **générateur cryptographique du système d'exploitation** (pas `Math.random()` qui est prédictible). Résultat : 48 octets = 384 bits d'entropie.

```
Exemple de token généré :
a3f8d2c1e9b74a506f21d8c3b5e7f904a2c6d8e1f3b5a7c9d0e2f4b6a8c0d2e4f6b8a0c2d4e6f8

Nombre de combinaisons possibles : 16^96 ≈ 2^384
(probabilité de deviner : astronomiquement proche de zéro)
```

#### Cycle de vie complet du token

```
╔══════════════════════════════════════════════════════╗
║                    CONNEXION                         ║
╠══════════════════════════════════════════════════════╣
║  1. bcrypt.compare(password, hash)  → OK             ║
║  2. makeToken() → 96 chars aléatoires                ║
║  3. INSERT portail_sessions                          ║
║       (token, user_id, expires_at = NOW + 8h)        ║
║  4. SET Redis "session:{token}" → JSON user          ║
║       TTL = 5 minutes (cache glissant)               ║
║  5. Cookie HttpOnly "portail_sid={token}"            ║
║       → envoyé au navigateur (jamais accessible JS)  ║
╚══════════════════════════════════════════════════════╝
                         │
                         ▼ (chaque requête suivante)
╔══════════════════════════════════════════════════════╗
║                   VALIDATION                         ║
╠══════════════════════════════════════════════════════╣
║  1. Lire cookie "portail_sid" → token                ║
║  2. GET Redis "session:{token}"                      ║
║     ├── HIT  → retourner user JSON (~1ms)            ║
║     │          renouveler TTL Redis (sliding window) ║
║     └── MISS → requête PostgreSQL                    ║
║               JOIN portail_sessions + portail_users  ║
║               WHERE token=? AND expires_at > NOW()   ║
║               AND is_active = true                   ║
║               → recacher dans Redis                  ║
╚══════════════════════════════════════════════════════╝
                         │
                         ▼

╔══════════════════════════════════════════════════════╗
║                  DÉCONNEXION                         ║
╠══════════════════════════════════════════════════════╣
║  1. DEL Redis "session:{token}" → invalide immédiat  ║
║  2. DELETE portail_sessions WHERE token=?            ║
║  3. Cookie effacé côté navigateur (Max-Age=0)        ║
╚══════════════════════════════════════════════════════╝
```

#### Pourquoi Redis en plus de PostgreSQL ?

Sans Redis, chaque page du portail déclencherait une requête SQL pour vérifier la session. Avec Redis :
- **~99 % des requêtes** → réponse depuis Redis en **~1 ms**
- PostgreSQL n'est touché que lors du premier accès ou si Redis redémarre (fallback transparent)

---

### 3. Protection anti-brute-force — `bruteForce.ts`

Avant même de vérifier le mot de passe, `checkBruteForce()` est appelé. Cela empêche un attaquant de tester des milliers de mots de passe.

```
Règles :
  MAX_ATTEMPTS    = 5 tentatives échouées
  WINDOW_SECONDS  = 15 minutes (fenêtre de comptage)
  LOCKOUT_SECONDS = 15 minutes (durée de blocage)

Clés Redis utilisées :
  bf:attempts:{email}   → compteur d'échecs (INCR atomique)
  bf:locked:{email}     → verrou actif (TTL automatique)
```

**Flux Redis :**
```
Tentative échouée 1 → INCR bf:attempts:user@ex.com = 1
                       EXPIRE bf:attempts:user@ex.com 900s
Tentative échouée 2 → INCR = 2
Tentative échouée 3 → INCR = 3
Tentative échouée 4 → INCR = 4
Tentative échouée 5 → INCR = 5 → seuil atteint
                       SET bf:locked:user@ex.com "1" EX 900s
                       DEL bf:attempts:user@ex.com
                       → compte bloqué 15 minutes

Connexion réussie   → DEL bf:attempts + DEL bf:locked
                       UPDATE portail_users SET failed_attempts=0
```

Si Redis est indisponible, le même comptage est fait directement en PostgreSQL sur les colonnes `failed_attempts` et `locked_until` de `portail_users` (fallback sans interruption de service).

---

### 4. Tableau récapitulatif — peut-on "décrypter" ?

| Élément | Algorithme | Réversible ? | Explication |
|---|---|---|---|
| Mot de passe en base | **bcrypt (coût 12)** | **Non, jamais** | Hachage irréversible — même les admins ne peuvent pas retrouver le mot de passe original |
| Token de session | **randomBytes (384 bits)** | Sans objet | Ce n'est pas du chiffrement — c'est une chaîne aléatoire opaque sans contenu à extraire |
| Données Redis | JSON en clair | Lisible si accès serveur | Protégé par l'accès réseau au serveur Redis, pas par chiffrement |
| Cookie navigateur | HttpOnly + Secure | Non accessible JS | Le flag `HttpOnly` empêche tout accès depuis JavaScript (protection XSS) |

> **Règle à retenir :** si un utilisateur oublie son mot de passe, il n'existe aucun moyen de le retrouver. La seule action possible est de le réinitialiser via `hashPassword(nouveauMotDePasse)` et d'enregistrer le nouveau hash en base.

---

## Patterns React utilisés

### `useCallback` pour les fetches

```typescript
const loadUsers = useCallback(async () => { ... }, [])
const loadMatrix = useCallback(async () => { ... }, [])
```
Évite de recréer les fonctions à chaque rendu. Les deux sont appelées dans un `useEffect` déclenché une seule fois après le chargement de l'utilisateur connecté.

### État dirty + baseMatrix

```
accessMatrix  ← état mutable (l'utilisateur modifie en cliquant)
baseMatrix    ← référence serveur (dbMatrix ?? fallback mockData)
matrixDirty   ← accessMatrix !== baseMatrix
```
Même pattern dupliqué pour la matrice navigation (`navMatrix` / `baseNavMatrix` / `navDirty`).

### Dérivé côté rendu (pas de state redondant)

```typescript
// Calculés à chaque rendu, pas stockés en state
const totalUsers       = apiUsers.length
const activeUsers      = apiUsers.filter(u => u.is_active).length
const isSuperAdmin     = currentUser?.role === 'super_admin'
const countChanges     = REPORTS.reduce(...)
const countNavChanges  = NAV_PAGES.reduce(...)
const totalDirtyCount  = countChanges + countNavChanges
const reportsByCategory = REPORTS.reduce(...)
const drawerReports    = drawerUser ? REPORTS.map(...) : []
```

### Optimistic UI

La matrice se met à jour instantanément au clic (état local) sans attendre la réponse serveur. La sauvegarde est explicite (bouton "Sauvegarder"). En cas d'erreur, `saveErr` s'affiche sans rollback automatique de l'état.

---

## Design System

La page utilise le design system partagé du portail :

| Token | Valeur | Usage |
|---|---|---|
| `C_NAVY` | `#1F3B72` | Couleur primaire textes et accents |
| `C_GREEN` | `#96C11E` | Succès, badges actifs |
| `C_PAGE` | `#f8fafc` | Fond de page |
| `card` | shadow `0 2px 10px rgba(31,59,114,.10)` | Cartes sans bordure |
| `F_TITLE` | Barlow Semi Condensed | Titres sections |
| `F_BODY` | Nunito | Corps de texte, boutons |

Aucune bibliothèque CSS externe (pas de Tailwind, pas de styled-components). Tous les styles sont en **inline styles React** avec des constantes partagées.
