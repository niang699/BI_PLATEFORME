/* ─── Référentiels SEN'EAU ───────────────────────────────────────────────── */

export const SERVICES: Record<string, { label: string; couleur: string }> = {
  SG:    { label: "Secrétariat Général",                    couleur: "#1F3B72" },
  DPD:   { label: "Direction Production Distribution",      couleur: "#0891B2" },
  DTO:   { label: "Direction Travaux et Ouvrages",           couleur: "#0D9488" },
  DTX:   { label: "Direction Technique",                     couleur: "#7C3AED" },
  DCL:   { label: "Direction Clientèle",                     couleur: "#96C11E" },
  DRH:   { label: "Direction Ressources Humaines",           couleur: "#DB2777" },
  DSI:   { label: "Direction Systèmes Information",          couleur: "#2563EB" },
  DAL:   { label: "Direction Achats et Logistique",          couleur: "#D97706" },
  DFC:   { label: "Direction Finances et Comptabilité",      couleur: "#DC2626" },
  DQSE:  { label: "Dir. Qualité Sécurité Environnement",    couleur: "#059669" },
  DCRP:  { label: "Dir. Communication et Relations Publiques", couleur: "#9333EA" },
  DLCQE: { label: "Dir. Laboratoire et Contrôle Qualité",   couleur: "#0EA5E9" },
  DPP:   { label: "Direction Planification et Projets",      couleur: "#F59E0B" },
}

export const GROUPES: Record<string, { nom: string; type: "Management" | "Réalisation" | "Support" }> = {
  M01: { nom: "M01 · Gouvernance",                       type: "Management"  },
  M02: { nom: "M02 · Communication",                     type: "Management"  },
  R01: { nom: "R01 · Gestion Relation Clients",          type: "Réalisation" },
  R02: { nom: "R02 · Relevé, Facturation, Recouvrement", type: "Réalisation" },
  R03: { nom: "R03 · Production d'Eau Potable",          type: "Réalisation" },
  R04: { nom: "R04 · Maintenance Électromécanique",      type: "Réalisation" },
  R05: { nom: "R05 · Transport et Distribution",         type: "Réalisation" },
  R06: { nom: "R06 · Réalisation de Travaux",            type: "Réalisation" },
  R07: { nom: "R07 · Renouvellement du Réseau",          type: "Réalisation" },
  R08: { nom: "R08 · Études et Intégration Projets",     type: "Réalisation" },
  S01: { nom: "S01 · Management Capital Humain",         type: "Support"     },
  S02: { nom: "S02 · Gestion Système d'Information",     type: "Support"     },
  S03: { nom: "S03 · Achats et Gestion des Stocks",      type: "Support"     },
  S04: { nom: "S04 · Gestion Financière et Comptable",   type: "Support"     },
  S06: { nom: "S06 · Gestion Équipements de Mesure",     type: "Support"     },
}

const SERVICE_PROCESSUS: Record<string, string[]> = {
  DCL:   ["R01", "R02"], DPD:   ["R03", "R05"], DTO:   ["R06", "R07"],
  DTX:   ["R06", "R07", "R08"], DRH: ["S01"],   DSI:   ["S02"],
  DAL:   ["S03"],               DFC: ["S04"],   DQSE:  ["M01"],
  DCRP:  ["M02"],               DLCQE: ["S06"], DPP:   ["R08"],
  SG:    ["M01", "M02"],
}

const BASE_INDICATEURS: Record<string, string[]> = {
  DCL:   ["Facturation par GF (m3)", "Taux d'annulation", "Taux de refacturation",
           "Taux de recouvrement", "Taux de réclamations traitées dans les délais",
           "Nombre de nouveaux branchements", "Taux de satisfaction client",
           "Encaissement mensuel", "Impayés cumulés", "Taux de coupures pour impayés",
           "Délai moyen de traitement des réclamations", "Taux de résiliation"],
  DPD:   ["Rendement de traitement", "Rendement de Transport",
           "Indice linéaire de perte", "Volume produit", "Volume distribué",
           "Taux de conformité eau produite", "Nombre de ruptures de production",
           "Continuité de service", "Consommation énergie / m3 produit"],
  DRH:   ["Taux d'exactitude de la paie", "Taux de respect du planning de paiement des salaires",
           "Heure supplémentaire ≤ 2,5% masse salariale", "Taux de formation réalisée",
           "Taux de féminisation", "Taux de turn-over", "Taux d'absentéisme",
           "Délai moyen de recrutement"],
  DSI:   ["Taux de disponibilité global du système informatique",
           "Taux de disponibilité des applications en production",
           "Taux de demandes traitées dans les délais", "Taux de couverture antivirus",
           "Délai moyen de résolution incidents", "Taux de sauvegarde réussie",
           "Taux de déploiement projets SI"],
  DFC:   ["Taux de conformité des comptes", "Taux de respect des dates d'arrêté des comptes",
           "Taux de paiement des factures fournisseurs dans les délais",
           "Taux de recouvrement global", "Délai de clôture comptable",
           "Taux d'exécution budgétaire"],
  DQSE:  ["Taux d'atteintes valeurs cible", "Taux de réalisation audit interne",
           "Taux de fermeture des NC et écart d'audit", "Taux d'avancement du PMQSE",
           "Nb d'accidents de travail", "Taux de fréquence accidents"],
  DTO:   ["Taux de mètre BO dans les délais", "Transmission de l'inventaire à jour à SONES",
           "Transmission du programme à SONES", "Taux de réalisation du programme de travaux",
           "Délai moyen de réalisation branchements"],
  DTX:   ["Délai de réalisation BO", "Délai de réalisation des BS",
           "Délai de réalisation des poses compteurs", "Taux de conformité des travaux réalisés",
           "Taux de réalisation du plan de renouvellement"],
  DAL:   ["Délai de traitement des DA", "Délai traitement BC",
           "Taux de transformation des DA en BC", "Taux de conformité des livraisons",
           "Rotation des stocks"],
  DLCQE: ["Taux de conformité physico-chimique", "Taux de réalisation physico-chimique",
           "Taux de conformité bactériologique", "Délai de rendu des résultats d'analyse",
           "Taux de satisfaction des demandes d'analyse"],
  DPP:   ["Taux de levée des anomalies", "Taux de conformité des ouvrages",
           "Taux de traitement des études dans les délais",
           "Taux de réalisation du plan d'investissement"],
  DCRP:  ["Communication dans les délais", "Niveau de satisfaction media",
           "Rappel des échéances de paiement"],
  SG:    ["Taux de féminisation global", "Conformité réglementaire",
           "Taux de réponse aux courriers dans les délais"],
}

const TYPES     = ["Qualité","Sécurité","Environnement","Financier","Performance"]
const SOURCES   = ["AarSENEAU","Excel","HR ACCESS","DWH PostgreSQL","Gordon API","DIGI"]
const FREQUENCES= ["Quotidien","Hebdomadaire","Mensuel","Trimestriel"]
const TAGS_POOL = ["KPI stratégique","Tableau de bord CODIR","Score Client 360°",
                   "Certification ISO","Reporting SONES","Plan d'action prioritaire",
                   "Indicateur opérationnel","Benchmark régional"]

/* ─── Seeded PRNG (LCG) — même séquence que Python seed=42 ────────────────── */
function makePRNG(seed: number) {
  let s = seed >>> 0
  return {
    next() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000 },
    choice<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)] },
    choices<T>(arr: T[], weights?: number[]): T {
      if (!weights) return this.choice(arr)
      const total = weights.reduce((a, b) => a + b, 0)
      let r = this.next() * total
      for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i] }
      return arr[arr.length - 1]
    },
    sample<T>(arr: T[], k: number): T[] {
      const copy = [...arr]; const result: T[] = []
      for (let i = 0; i < k && copy.length; i++) {
        const idx = Math.floor(this.next() * copy.length)
        result.push(copy.splice(idx, 1)[0])
      }
      return result
    },
  }
}

function genererValeur(nom: string, rng: ReturnType<typeof makePRNG>) {
  const n = nom.toLowerCase()
  if (n.includes("délai")) {
    const cible = rng.choice([5,7,10,15,30])
    const val   = Math.round(rng.next() * (cible * 0.8) + cible * 0.6) / 10 * 10
    return { val: Math.round(val * 10) / 10, cible: `< ${cible} jours`, atteint: val <= cible }
  }
  if (n.includes("volume") || n.includes("nombre") || n.includes("nb")) {
    const val = Math.round(rng.next() * 49900 + 100)
    return { val, cible: "À définir", atteint: rng.next() > 0.5 }
  }
  if (n.includes("rotation") || n.includes("indice linéaire")) {
    const val = Math.round((rng.next() * 11 + 1) * 100) / 100
    return { val, cible: "> 4", atteint: val >= 4 }
  }
  const cible = rng.choice([80,85,90,95,98,100])
  const val   = Math.round((rng.next() * 35 + 65) * 10) / 10
  return { val, cible: `> ${cible}%`, atteint: val >= cible }
}

function formule(nom: string) {
  const n = nom.toLowerCase()
  if (n.includes("recouvrement"))  return "Encaissements / CA facturé × 100"
  if (n.includes("formation"))     return "Nb formations réalisées / Nb formations planifiées × 100"
  if (n.includes("disponibilité")) return "(Temps total - Temps d'arrêt) / Temps total × 100"
  if (n.includes("féminisation"))  return "Nb femmes / Effectif total × 100"
  if (n.includes("absentéisme"))   return "Jours d'absence / Jours ouvrables × 100"
  if (n.includes("délai"))         return "Somme des délais / Nb dossiers traités"
  if (n.includes("conformité"))    return "Nb éléments conformes / Nb éléments contrôlés × 100"
  if (n.includes("turn-over"))     return "(Nb départs + Nb arrivées) / 2 / Effectif moyen × 100"
  if (n.includes("exécution") || n.includes("réalisation")) return "Réalisé / Prévu × 100"
  if (n.includes("satisfaction"))  return "Nb avis positifs / Total avis × 100"
  return "Numérateur / Dénominateur × 100"
}

/* ─── Types ──────────────────────────────────────────────────────────────── */
export interface Indicateur {
  id:                  number
  indicateur:          string
  service:             string
  service_label:       string
  service_couleur:     string
  groupe_processus:    string
  groupe_nom:          string
  groupe_type:         string
  type_indicateur:     string
  calcule:             boolean
  frequence_maj:       string
  priorite:            number
  source_reporting:    string
  pilote_processus:    string
  responsable_collecte: string
  mode_calcul:         string
  objectif_cible:      string
  valeur_actuelle:     number
  valeur_precedente:   number
  atteint_cible:       boolean
  tendance:            "hausse" | "baisse" | "stable"
  tags:                string[]
}

/* ─── Génération des 239 indicateurs ─────────────────────────────────────── */
function genererIndicateurs(): Indicateur[] {
  const rng   = makePRNG(42)
  const items: [string, string][] = []
  for (const [svc, list] of Object.entries(BASE_INDICATEURS))
    for (const nom of list) items.push([svc, nom])

  while (items.length < 239) {
    const [svc, nom] = items[Math.floor(rng.next() * Math.min(80, items.length))]
    items.push([svc, nom + " (DT)"])
  }
  // Shuffle deterministically
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]]
  }

  return items.slice(0, 239).map(([svc, nom], idx) => {
    const service    = SERVICES[svc]
    const procCodes  = SERVICE_PROCESSUS[svc] ?? ["M01"]
    const gCode      = rng.choice(procCodes)
    const groupe     = GROUPES[gCode]
    const { val, cible, atteint } = genererValeur(nom, rng)
    const valPrec    = Math.round(val * (0.88 + rng.next() * 0.24) * 10) / 10
    const delta      = val - valPrec
    const tendance: "hausse"|"baisse"|"stable" = delta > 0.5 ? "hausse" : delta < -0.5 ? "baisse" : "stable"

    return {
      id:                   idx + 1,
      indicateur:           nom,
      service:              svc,
      service_label:        service.label,
      service_couleur:      service.couleur,
      groupe_processus:     gCode,
      groupe_nom:           groupe.nom,
      groupe_type:          groupe.type,
      type_indicateur:      rng.choices(TYPES, [30,10,8,25,27]),
      calcule:              rng.next() < 0.70,
      frequence_maj:        rng.choices(FREQUENCES, [0.10,0.20,0.50,0.20]),
      priorite:             rng.next() < 0.40 ? 1 : 2,
      source_reporting:     rng.choice(SOURCES),
      pilote_processus:     `Directeur ${svc}`,
      responsable_collecte: `Chef Division ${svc}`,
      mode_calcul:          formule(nom),
      objectif_cible:       cible,
      valeur_actuelle:      val,
      valeur_precedente:    valPrec,
      atteint_cible:        atteint,
      tendance,
      tags:                 rng.sample(TAGS_POOL, 1 + Math.floor(rng.next() * 3)),
    }
  })
}

export const INDICATEURS: Indicateur[] = genererIndicateurs()
