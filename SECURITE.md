# Sécurité du Portail BI SEN'EAU — Guide complet

Ce document explique, de façon simple et accessible à tous, comment le portail protège les données et les accès utilisateurs. Aucun prérequis technique nécessaire.

---

## Vue d'ensemble — Les 4 couches de protection

```
┌─────────────────────────────────────────────────────────────────┐
│  UTILISATEUR                                                    │
│  (navigateur)                                                   │
└───────────────────────┬─────────────────────────────────────────┘
                        │ Requête HTTP
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  COUCHE 1 — MIDDLEWARE (Edge Runtime)                           │
│  "Le videur à l'entrée"                                         │
│  → Vérifie que le visiteur a bien un badge (cookie)             │
│  → Sinon : redirection immédiate vers /login                    │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  COUCHE 2 — VALIDATION DE SESSION (validateSession)             │
│  "Le contrôle d'identité en caisse"                             │
│  → Vérifie que le badge est authentique (token en DB/Redis)     │
│  → Vérifie que l'utilisateur est toujours actif                 │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  COUCHE 3 — CONTRÔLE DES RÔLES (Authorization)                  │
│  "Le contrôle de niveau d'accès"                                │
│  → Vérifie que l'utilisateur a le droit sur cette ressource     │
│  → super_admin / admin_metier / analyste / lecteur_dt / dt      │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  COUCHE 4 — PROTECTION ANTI-BRUTE FORCE                         │
│  "Le système anti-tentatives répétées"                          │
│  → Bloque un compte après 5 échecs en 15 minutes               │
│  → Empêche les robots de deviner les mots de passe              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Les mots de passe — Comment ils sont protégés

### L'idée fondamentale : on ne stocke jamais le mot de passe

Quand vous créez un compte avec le mot de passe `"MonMotDePasse123"`, le portail **ne le stocke jamais tel quel** en base de données. Si quelqu'un piratait la base, il ne verrait que du charabia illisible — pas les vrais mots de passe.

Ce mécanisme s'appelle le **hachage**. C'est une transformation en sens unique :

```
"MonMotDePasse123"  →  [hachage bcrypt]  →  "$2a$12$X7hBm3p...kOa3Xi"
                                                     ↑
                              C'est ça qui est stocké en base de données
```

La flèche ne va que dans un sens. **Il est mathématiquement impossible de retrouver le mot de passe original à partir du hash.** Même les développeurs du portail ne peuvent pas le lire.

---

### La différence entre hachage et chiffrement

Beaucoup confondent les deux. Voici la distinction simple :

| | Chiffrement | Hachage |
|---|---|---|
| **Analogie** | Coffre-fort avec clé | Broyeur à papier |
| **Réversible ?** | Oui, avec la bonne clé | **Non, jamais** |
| **Utilisation** | Données qu'on veut récupérer (ex: fichiers) | Secrets à vérifier sans jamais les voir |
| **Exemples** | AES, RSA | **bcrypt** (ce qu'on utilise) |

> **Règle simple :** si un utilisateur oublie son mot de passe, personne ne peut le retrouver. La seule solution est de le **réinitialiser** — générer un nouveau mot de passe et créer un nouveau hash.

---

### Anatomie du hash bcrypt

Voici à quoi ressemble un hash stocké en base :

```
$2a$12$X7hBm3pQ9RzKlV8nWqYjAu7GdF2eHsP1mNcT6yIbE0wZvLkOa3Xi
 │   │  │                     │           │
 │   │  └─ SALT (22 chars)    │           └─ Résultat du hachage (31 chars)
 │   └─ Coût : 12 (= 4096 itérations)
 └─ Version de l'algorithme bcrypt
```

**Le SALT** est une chaîne aléatoire générée différemment pour chaque utilisateur. C'est ce qui fait que deux utilisateurs avec le même mot de passe auront des hashes complètement différents en base.

```
Utilisateur A : "azerty123"  →  $2a$12$SALT_A_ALÉATOIRE...HASH_A
Utilisateur B : "azerty123"  →  $2a$12$SALT_B_DIFFÉRENT...HASH_B
                                                          ↑ différent !
```

Sans sel, un pirate pourrait créer une liste des mots de passe communs et leurs hashes ("rainbow table") pour trouver rapidement les mots de passe. Le sel rend cette attaque inutile.

---

### Les 3 étapes du hachage

**À la création du compte :**

```
Étape 1 — Générer un SALT aléatoire unique
          (16 octets aléatoires par le système d'exploitation)

Étape 2 — Combiner : SALT + "MonMotDePasse123"

Étape 3 — Appliquer la fonction bcrypt 4096 fois (coût 12)
          Chaque itération rend le calcul plus lent intentionnellement

→ Résultat stocké en base : "$2a$12$SALT...HASH"
```

**À la connexion :**

```
L'utilisateur saisit "MonMotDePasse123"
  → Le portail lit le hash stocké en base
  → Extrait le SALT depuis le hash
  → Refait le même calcul avec le SALT + ce que l'utilisateur a saisi
  → Compare les deux résultats
  → Identiques = bon mot de passe / Différents = mauvais mot de passe
```

Bcrypt ne "déchiffre" rien. Il **rejoue le calcul** et compare. Le mot de passe original n'est jamais reconstruit.

---

### Pourquoi 4096 itérations ?

Le "coût 12" signifie que bcrypt effectue 2¹² = **4096 itérations**. C'est intentionnellement lent.

```
Votre ordinateur vérifie votre mot de passe en ~250 ms → imperceptible pour vous

Un pirate essaie de deviner en attaquant 1 milliard de combinaisons :
  → Avec un mot de passe simple (SHA-1) : quelques secondes
  → Avec bcrypt coût 12 : environ 8 ans
```

| Coût | Temps calcul | Tentatives/seconde d'un attaquant |
|---|---|---|
| 10 | ~65 ms | ~15 |
| **12 (ce portail)** | **~250 ms** | **~4** |
| 14 | ~1 000 ms | ~1 |

Plus le coût monte, plus c'est lent pour tout le monde — y compris les attaquants. Le coût 12 est le standard de l'industrie en 2024-2025.

---

### Le code correspondant

```typescript
// authServer.ts — À la création / modification du mot de passe
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
  //                       └─ coût = 12 → 4096 itérations
}

// À la connexion
const valid = await bcrypt.compare(motDePasseSaisi, hashStockéEnBase)
//                         ↑                         ↑
//               ce que l'utilisateur tape     ce qui est en DB
// retourne true (bon) ou false (mauvais)
```

---

## 2. Les tokens de session — Votre badge numérique

### Qu'est-ce qu'un token de session ?

Quand vous vous connectez avec succès, le portail vous remet un **badge numérique** unique : le token de session. Ce badge est stocké dans votre navigateur sous forme de cookie et présenté automatiquement à chaque page que vous visitez.

C'est comme un badge d'accès dans un immeuble : vous le montrez à l'entrée de chaque zone, et le portail vérifie qu'il est valide.

---

### JWT vs Token opaque — Quelle différence ?

Beaucoup de portails utilisent des **JWT** (JSON Web Token). Ce portail a fait un choix différent : le **token opaque**.

| | JWT | Token opaque (ce portail) |
|---|---|---|
| **Contient des informations ?** | Oui (nom, rôle, email encodés en Base64) | Non — juste une clé aléatoire |
| **Décodable sans base de données ?** | Oui | Non |
| **Révocable immédiatement ?** | Non (valide jusqu'à expiration même si révoqué) | **Oui** (on supprime le token en DB) |
| **Que voit-on si on intercepte le cookie ?** | Les données de l'utilisateur (encodées) | Une suite de 96 caractères sans signification |
| **Taille** | 200-500 caractères | 96 caractères |

**Avantage clé du token opaque :** si un utilisateur est désactivé par un admin, sa session est révoquée immédiatement. Avec un JWT, l'utilisateur continuerait à avoir accès jusqu'à expiration du token.

---

### Comment le token est généré

```typescript
// authServer.ts
function makeToken(): string {
  return randomBytes(48).toString('hex')
  //     ↑                      ↑
  //     48 octets aléatoires   converti en hexadécimal (chaque octet = 2 chars)
  //     = 384 bits d'entropie  = 96 caractères
}
```

`randomBytes(48)` utilise le **générateur de nombres aléatoires cryptographique du système d'exploitation** (pas `Math.random()` qui est prédictible). Le résultat est imprévisible même pour celui qui a écrit le code.

```
Exemple de token généré :
a3f8d2c1e9b74a506f21d8c3b5e7f904a2c6d8e1f3b5a7c9d0e2f4b6a8c0d2e4f6b8a0c2d4e6f8

Nombre de combinaisons possibles : 16^96 ≈ 2^384
Pour deviner ce token par hasard, il faudrait tester une quantité de combinaisons
supérieure au nombre d'atomes dans l'univers observable.
```

---

### Le cycle de vie complet d'un token

```
═══════════════════════════════════════════
            CONNEXION
═══════════════════════════════════════════

  Vous saisissez email + mot de passe
            │
            ▼
  bcrypt.compare() → mot de passe correct
            │
            ▼
  makeToken() → génère 96 chars aléatoires
            │
            ▼
  INSERT portail_sessions (token, user_id, expires_at = maintenant + 8h)
            │
            ▼
  SET Redis "session:{token}" → données utilisateur JSON
  TTL = 5 minutes (cache glissant)
            │
            ▼
  Cookie HttpOnly "portail_sid={token}" → envoyé au navigateur
  (le cookie n'est jamais accessible au JavaScript de la page)


═══════════════════════════════════════════
    CHAQUE PAGE / REQUÊTE SUIVANTE
═══════════════════════════════════════════

  Votre navigateur envoie automatiquement le cookie
            │
            ▼
  Middleware lit le cookie → token présent et 96 chars ?
  NON → redirect /login
  OUI → ↓
            │
            ▼
  validateSession(token) :
  ┌─────────────────────────────────────┐
  │  1. Chercher dans Redis (ultra-rapide ~1ms)  │
  │     TROUVÉ → retourner user directement      │
  │              renouveler le TTL Redis         │
  │     PAS TROUVÉ → ↓                          │
  │  2. Chercher en PostgreSQL                   │
  │     WHERE token = ? AND expires_at > NOW()   │
  │     AND is_active = true                     │
  │     TROUVÉ → recacher dans Redis → retourner │
  │     PAS TROUVÉ → 401 Unauthorized            │
  └─────────────────────────────────────────────┘


═══════════════════════════════════════════
            DÉCONNEXION
═══════════════════════════════════════════

  Vous cliquez "Se déconnecter"
            │
            ▼
  DEL Redis "session:{token}" → invalide immédiatement
            │
            ▼
  DELETE portail_sessions WHERE token = ?
            │
            ▼
  Cookie effacé côté navigateur (Max-Age = 0)

  → Même si quelqu'un avait copié le cookie,
    il ne fonctionnerait plus instantanément.
```

---

### Pourquoi Redis en plus de PostgreSQL ?

Sans Redis, chaque clic sur le portail déclencherait une requête SQL pour vérifier votre session. Avec des dizaines d'utilisateurs actifs simultanément, ça représente beaucoup de requêtes.

```
Sans Redis :
  Chaque requête → requête SQL → ~5-20 ms → base de données sollicitée

Avec Redis :
  ~99% des requêtes → Redis → ~1 ms → quasi-instantané
  ~1% (cache expiré) → Redis MISS → PostgreSQL → ~10 ms → mis en cache Redis

Redis = mémoire ultra-rapide (RAM)
PostgreSQL = stockage durable (disque)
```

Si Redis redémarre ou est indisponible, le portail bascule automatiquement sur PostgreSQL — **aucune interruption de service** pour les utilisateurs.

---

### Sécurité du cookie

Le cookie `portail_sid` est créé avec deux protections importantes :

```
HttpOnly → le cookie est invisible au JavaScript de la page
           Un script malveillant injecté dans la page (attaque XSS)
           ne peut pas lire ou voler le token

Secure   → le cookie n'est envoyé que via HTTPS
           Impossible à intercepter sur un réseau non chiffré
```

---

## 3. Le Middleware — Le premier gardien

### Rôle

Le middleware est la **première ligne de défense** du portail. Il s'exécute avant même que la page ne commence à se charger, sur chaque requête vers `/dashboard/*` et `/viewer/*`.

**Analogie :** c'est le vigile à l'entrée du bâtiment. Il vérifie que vous avez un badge. S'il n'y en a pas, vous ne franchissez pas la porte — peu importe qui vous êtes.

---

### Ce qu'il vérifie

```typescript
// src/middleware.ts

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Routes publiques (/login, /api/auth/login) → toujours laisser passer
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Routes protégées (/dashboard/*, /viewer/*) → vérifier le cookie
  const token = req.cookies.get('portail_sid')?.value

  if (!token || token.length !== 96) {
    // Pas de cookie ou token invalide → redirection /login
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
    // ↑ après connexion, l'utilisateur sera redirigé vers la page demandée
  }

  return NextResponse.next()  // cookie présent → laisser passer
}
```

---

### Ce qu'il ne fait PAS (volontairement)

Le middleware **ne vérifie pas si le token est valide en base de données**. Il vérifie seulement que le cookie existe et fait 96 caractères.

**Pourquoi ?**

Le middleware s'exécute sur **Edge Runtime** — une infrastructure ultra-légère proche du réseau (comme Cloudflare Workers). Elle est très rapide mais n'a pas accès à `node-postgres` (le driver de base de données). Elle ne peut pas ouvrir une connexion SQL.

---

### Les deux niveaux de vérification

```
          MIDDLEWARE                        VALIDATE SESSION
         (Edge Runtime)                    (API Routes)

  Vérifie : cookie présent ?       Vérifie : token valide en DB ?
            longueur = 96 chars ?            utilisateur actif ?
                                             session non expirée ?

  Peut accéder à DB : NON          Peut accéder à DB : OUI (PostgreSQL + Redis)

  Vitesse : < 1ms                  Vitesse : ~1ms (Redis) ou ~10ms (PostgreSQL)

  Rôle : filtrer les requêtes      Rôle : valider l'identité réelle
         sans aucun cookie                 et les droits d'accès
```

**Un attaquant avec un cookie de 96 caractères inventés :**
- Passe le middleware (cookie présent, bonne longueur)
- Est bloqué par `validateSession()` (token introuvable en DB)

Les deux couches sont complémentaires. L'une sans l'autre serait insuffisante.

---

### Que se passe-t-il si quelqu'un accède directement à une URL ?

```
Scénario : quelqu'un tape directement https://portail.seneau.sn/dashboard/admin
           sans être connecté

  1. Middleware intercepte la requête
  2. Cherche le cookie "portail_sid" → absent
  3. Redirige vers /login?redirect=/dashboard/admin
  4. Après connexion réussie, redirige automatiquement vers /dashboard/admin
```

L'utilisateur voit la page de connexion — jamais un écran blanc ou une erreur cryptique.

---

## 4. Protection anti-brute force

### Le problème

Un "brute force" consiste à essayer des milliers de mots de passe automatiquement jusqu'à trouver le bon. Sans protection, un robot pourrait tester `"azerty123"`, `"123456"`, `"seneau2024"` des milliers de fois par seconde.

### La solution : Redis comme compteur

À chaque tentative de connexion échouée, un compteur est incrémenté dans Redis :

```
Tentative 1 échouée :
  Redis : bf:attempts:user@seneau.sn = 1   (expire dans 15 min)

Tentative 2 échouée :
  Redis : bf:attempts:user@seneau.sn = 2

Tentative 3 échouée :
  Redis : bf:attempts:user@seneau.sn = 3

Tentative 4 échouée :
  Redis : bf:attempts:user@seneau.sn = 4

Tentative 5 échouée : ← SEUIL ATTEINT
  Redis : bf:locked:user@seneau.sn = "1"   (expire dans 15 min)
  Réponse : "Compte temporairement bloqué. Réessayez dans 15 minutes."
  (le mot de passe n'est même plus vérifié)
```

```
Connexion réussie à tout moment :
  Redis : SUPPRIME bf:attempts:user@seneau.sn
          SUPPRIME bf:locked:user@seneau.sn
  → Compteur remis à zéro
```

### Les paramètres

```
MAX_ATTEMPTS    = 5 tentatives échouées
WINDOW_SECONDS  = 900 secondes (15 minutes de fenêtre de comptage)
LOCKOUT_SECONDS = 900 secondes (15 minutes de blocage)
```

Un utilisateur légitime qui se trompe 5 fois dans une heure doit attendre 15 minutes. Un robot qui essaie 1000 combinaisons voit ses tentatives rejetées immédiatement après 5 échecs.

### Fallback PostgreSQL

Si Redis est indisponible, le même comptage est fait directement en base sur les colonnes `failed_attempts` et `locked_until` de `portail_users`. **La protection reste active même sans Redis.**

---

## 5. Contrôle des rôles — Qui a accès à quoi

Même avec un token valide, chaque page et chaque API vérifient que l'utilisateur a le droit d'accéder à ce qu'il demande.

### Les 5 rôles

| Rôle | Profil | Accès |
|---|---|---|
| `super_admin` | Administrateur technique | Tout, sans restriction |
| `admin_metier` | Responsable BI | Administration + tous les rapports |
| `analyste` | Analyste data | Rapports + Hub IA + Self-Service |
| `lecteur_dt` | Lecteur Direction Territoriale | Rapports de sa DR uniquement |
| `dt` | Directeur Territorial | Rapports de sa DR + Mon Agence 360 |

### Vérification côté frontend (affichage)

```typescript
// Page Admin — garde d'affichage
if (currentUser?.role !== 'super_admin' && currentUser?.role !== 'admin_metier') {
  return <EcranAccesRestreint />
}
```

Cela empêche l'affichage du contenu, mais **ce n'est pas suffisant** seul — un utilisateur technique pourrait bypasser le rendu côté client.

### Vérification côté API (la vraie protection)

```typescript
// API Route /api/admin/users — vérification côté serveur
const auth = await validateSession(token)
if (!auth || !['super_admin', 'admin_metier'].includes(auth.role)) {
  return new Response('Forbidden', { status: 403 })
}
```

Même si quelqu'un parvenait à afficher la page (en désactivant JavaScript par exemple), toute requête à l'API retournerait `403 Forbidden` — les données ne seraient jamais envoyées.

**Règle : le frontend filtre l'affichage, le backend filtre les données. Les deux sont indispensables.**

---

## 6. Récapitulatif — Tableau de sécurité

| Élément | Mécanisme | Peut-on le déchiffrer / contourner ? |
|---|---|---|
| Mot de passe en base | **bcrypt coût 12** — hachage irréversible | **Non, jamais.** Même avec accès à la DB |
| Token de session | **96 chars aléatoires** — 384 bits d'entropie | Impossible à deviner. Révocable instantanément |
| Cookie navigateur | **HttpOnly + Secure** | Inaccessible au JavaScript, HTTPS uniquement |
| Cache session | **Redis TTL 5min** | Protégé par accès réseau serveur |
| Protection pages | **Middleware Edge** | Premier filtre, bloque sans cookie |
| Protection API | **validateSession() + rôle** | Validation complète DB avant toute donnée |
| Attaques répétées | **Anti-brute force Redis** | Blocage 15min après 5 échecs |
| Audit | **Logs en base** | Toutes les actions admin enregistrées |

---

## 7. Scénarios concrets

### Scénario 1 — Un pirate vole la base de données

Il obtient la table `portail_users` et voit les `password_hash`.

**Ce qu'il peut faire :** regarder des suites de caractères illisibles.

**Ce qu'il ne peut pas faire :** retrouver les mots de passe. Pour tester un seul mot de passe, il faut ~250ms avec bcrypt. Tester 1 million de mots de passe communs prendrait 3 jours. Avec un mot de passe fort, des millénaires.

---

### Scénario 2 — Un pirate intercepte le cookie

Il obtient la valeur du cookie `portail_sid` d'un utilisateur.

**Ce qu'il peut faire :** accéder au portail pendant la durée de la session (max 8h).

**Ce qu'on peut faire :** désactiver l'utilisateur dans l'admin → `is_active = false` + suppression immédiate de toutes ses sessions → le cookie ne fonctionne plus en quelques secondes.

**Prévention :** le flag `Secure` empêche l'interception sur HTTP non chiffré.

---

### Scénario 3 — Un utilisateur essaie de deviner un token

Il envoie des requêtes avec des tokens aléatoires de 96 caractères.

**Ce qu'il voit :** `401 Unauthorized` à chaque fois.

**Probabilité de succès :** 1 sur 2³⁸⁴ ≈ 1 sur 39 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 (c'est astronomiquement improbable).

---

### Scénario 4 — Un employé quitte SEN'EAU

L'administrateur le désactive dans l'onglet Utilisateurs.

**Ce qui se passe automatiquement :**
1. `is_active = false` en base
2. `DELETE FROM portail_sessions WHERE user_id = X` — toutes les sessions supprimées
3. Si l'utilisateur était connecté, sa prochaine requête retourne `401` — il est redirigé vers `/login`
4. Même avec son cookie, il ne peut plus se connecter
