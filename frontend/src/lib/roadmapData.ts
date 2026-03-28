// ─── Types ────────────────────────────────────────────────────────────────────

export type RoadmapStatut = 'FAIT' | 'EN COURS' | 'À FAIRE' | 'Permanent'

export interface SousTache {
  titre:   string
  statut:  RoadmapStatut
  detail?: string
}

export interface Jalon {
  code:        string
  titre:       string
  responsable: string
  debut:       string   // ex: "Jan 2026"
  fin:         string   // ex: "Déc 2026"
  statut:      RoadmapStatut
  indicateur:  string
  observation?: string
  sousTaches:  SousTache[]
}

export interface Phase {
  id:     string
  numero: string
  titre:  string
  color:  string
  jalons: Jalon[]
}

// ─── Couleurs statut ──────────────────────────────────────────────────────────

export const STATUT_META: Record<RoadmapStatut, { label: string; color: string; bg: string; dot: string }> = {
  'FAIT':      { label: 'Fait',      color: '#059669', bg: 'rgba(5,150,105,.12)',   dot: '#059669' },
  'EN COURS':  { label: 'En cours',  color: '#D97706', bg: 'rgba(217,119,6,.12)',   dot: '#D97706' },
  'À FAIRE':   { label: 'À faire',   color: '#6B7280', bg: 'rgba(107,114,128,.10)', dot: '#9CA3AF' },
  'Permanent': { label: 'Permanent', color: '#1F3B72', bg: 'rgba(31,59,114,.10)',   dot: '#1F3B72' },
}

// ─── Helpers timeline (Jan 2026 = 0, Déc 2027 = 23) ─────────────────────────

export const GANTT_MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Juil','Aoû','Sep','Oct','Nov','Déc']
export const GANTT_START_YEAR = 2026
export const GANTT_TOTAL = 24 // Jan 2026 → Déc 2027

export function parseGanttDate(dateStr: string): number {
  const [m, y] = dateStr.split(' ')
  const mIdx  = GANTT_MONTHS.indexOf(m)
  const yOff  = (parseInt(y) - GANTT_START_YEAR) * 12
  return Math.max(0, Math.min(GANTT_TOTAL - 1, yOff + mIdx))
}

// ─── Données feuille de route ─────────────────────────────────────────────────

export const PHASES: Phase[] = [
  // ── PHASE I — GOUVERNANCE ──────────────────────────────────────────────────
  {
    id: 'gouvernance',
    numero: 'I',
    titre: 'Gouvernance',
    color: '#1F3B72',
    jalons: [
      {
        code: 'I.1',
        titre: 'Note de stratégie DG',
        responsable: 'DG / DSI',
        debut: 'Jan 2026', fin: 'Fév 2026',
        statut: 'FAIT',
        indicateur: 'Note de cadrage validée et diffusée',
        observation: 'Document validé en CODIR Janvier 2026',
        sousTaches: [
          { titre: 'Rédaction de la note de cadrage stratégique',     statut: 'FAIT',    detail: 'Rédigée par la DSI avec appui DG' },
          { titre: 'Validation en CODIR',                             statut: 'FAIT',    detail: 'CODIR du 20 Jan 2026' },
          { titre: 'Diffusion à toutes les directions',               statut: 'FAIT',    detail: 'Mail interne + affichage portail' },
          { titre: 'Intégration au plan stratégique SEN\'EAU',        statut: 'FAIT',    detail: 'Annexée au plan stratégique 2026-2030' },
        ],
      },
      {
        code: 'I.2',
        titre: 'Sensibilisation gouvernance des données',
        responsable: 'DSI',
        debut: 'Jan 2026', fin: 'Mar 2026',
        statut: 'FAIT',
        indicateur: 'Ateliers de sensibilisation tenus (directions concernées)',
        observation: 'Ateliers tenus avec 8 directions sur 12',
        sousTaches: [
          { titre: 'Conception du kit de sensibilisation (supports)',  statut: 'FAIT',    detail: 'PPT + fiches pratiques' },
          { titre: 'Atelier Direction Clientèle',                     statut: 'FAIT',    detail: '2h — 12 participants' },
          { titre: 'Atelier Direction Technique',                     statut: 'FAIT',    detail: '2h — 9 participants' },
          { titre: 'Atelier DAF / DRH',                               statut: 'FAIT',    detail: '2h — 7 participants' },
          { titre: 'Atelier SMQSE / Travaux',                         statut: 'FAIT',    detail: '1h30 — 5 participants' },
          { titre: 'Bilan de sensibilisation & rapport',              statut: 'FAIT',    detail: 'Rapport synthèse transmis à la DG' },
        ],
      },
      {
        code: 'I.3',
        titre: 'Kick-off COMOP Données',
        responsable: 'DSI / DRH',
        debut: 'Mar 2026', fin: 'Mai 2026',
        statut: 'À FAIRE',
        indicateur: 'Premier COMOP tenu, membres désignés',
        sousTaches: [
          { titre: 'Définition de la charte COMOP',                   statut: 'À FAIRE', detail: 'Rôles, fréquence, livrables' },
          { titre: 'Désignation des Data Stewards par direction',     statut: 'À FAIRE' },
          { titre: 'Mise en place du calendrier des revues',          statut: 'À FAIRE', detail: 'Revues mensuelles + trimestrielles' },
          { titre: '1er COMOP — séance inaugurale',                   statut: 'À FAIRE', detail: 'Mai 2026 — présence DG' },
        ],
      },
      {
        code: 'I.4',
        titre: 'Flash Gouvernance trimestriel',
        responsable: 'DSI',
        debut: 'Mar 2026', fin: 'Déc 2026',
        statut: 'EN COURS',
        indicateur: 'Bulletin trimestriel publié (4 éditions/an)',
        observation: 'Édition T1 en cours de rédaction',
        sousTaches: [
          { titre: 'Template Flash Gouvernance',                      statut: 'FAIT',    detail: 'Maquette validée par DG' },
          { titre: 'Édition T1 2026 (Mar–Mai)',                       statut: 'EN COURS', detail: 'Publication prévue Juin 2026' },
          { titre: 'Édition T2 2026 (Jun–Aoû)',                       statut: 'À FAIRE' },
          { titre: 'Édition T3 2026 (Sep–Nov)',                       statut: 'À FAIRE' },
          { titre: 'Édition T4 2026 (Oct–Déc)',                       statut: 'À FAIRE' },
        ],
      },
      {
        code: 'I.5',
        titre: 'Cartographie des processus clés',
        responsable: 'DSI / Métiers',
        debut: 'Fév 2026', fin: 'Déc 2026',
        statut: 'À FAIRE',
        indicateur: 'Processus documentés et validés par les directions',
        sousTaches: [
          { titre: 'Identification des processus critiques (données)', statut: 'À FAIRE', detail: 'Min. 15 processus à cartographier' },
          { titre: 'Cartographie processus Clientèle',                statut: 'À FAIRE' },
          { titre: 'Cartographie processus Technique/Production',     statut: 'À FAIRE' },
          { titre: 'Cartographie processus Finance / RH',             statut: 'À FAIRE' },
          { titre: 'Validation par les pilotes de processus',         statut: 'À FAIRE' },
          { titre: 'Publication sur le portail Data Gouvernance',     statut: 'À FAIRE' },
        ],
      },
      {
        code: 'I.6',
        titre: 'Formation gouvernance (cabinet)',
        responsable: 'DRH / DSI',
        debut: 'Avr 2026', fin: 'Oct 2026',
        statut: 'À FAIRE',
        indicateur: 'Formation certifiante réalisée (équipe DSI + pilotes)',
        sousTaches: [
          { titre: 'Appel d\'offres cabinet de formation',            statut: 'À FAIRE', detail: 'Spécialiste Data Governance' },
          { titre: 'Sélection du prestataire',                        statut: 'À FAIRE' },
          { titre: 'Module 1 — Concepts & Frameworks DG',             statut: 'À FAIRE', detail: '3 jours — équipe DSI' },
          { titre: 'Module 2 — Qualité et lignage des données',       statut: 'À FAIRE', detail: '2 jours — pilotes métier' },
          { titre: 'Module 3 — Cas pratiques SEN\'EAU',               statut: 'À FAIRE', detail: '2 jours — mise en situation' },
          { titre: 'Évaluation & certification',                      statut: 'À FAIRE' },
        ],
      },
      {
        code: 'I.7',
        titre: 'Recrutement Data Scientist',
        responsable: 'DRH',
        debut: 'Avr 2026', fin: 'Mar 2027',
        statut: 'À FAIRE',
        indicateur: 'Data Scientist en poste et opérationnel',
        sousTaches: [
          { titre: 'Rédaction du profil de poste',                    statut: 'À FAIRE', detail: 'Python, ML, secteur eau/énergie' },
          { titre: 'Publication de l\'offre (job boards + réseau)',   statut: 'À FAIRE' },
          { titre: 'Présélection et entretiens techniques',           statut: 'À FAIRE' },
          { titre: 'Intégration et onboarding',                       statut: 'À FAIRE', detail: '1 mois d\'onboarding DSI' },
          { titre: 'Prise en main des modèles ML existants',          statut: 'À FAIRE', detail: 'Score 360°, prévision NRW' },
        ],
      },
      {
        code: 'I.8',
        titre: 'Documentation & Glossaire métier',
        responsable: 'DSI / Métiers',
        debut: 'Jun 2026', fin: 'Aoû 2026',
        statut: 'À FAIRE',
        indicateur: 'Glossaire validé (> 80 termes) publié sur le portail',
        sousTaches: [
          { titre: 'Collecte des termes métier par direction',        statut: 'À FAIRE', detail: 'Ateliers de collecte — 6 directions' },
          { titre: 'Normalisation et dédoublonnage',                  statut: 'À FAIRE' },
          { titre: 'Validation par les pilotes de processus',         statut: 'À FAIRE' },
          { titre: 'Intégration au portail Data Gouvernance',         statut: 'À FAIRE', detail: 'Section glossaire enrichie > 80 termes' },
          { titre: 'Communication interne sur le glossaire',          statut: 'À FAIRE' },
        ],
      },
      {
        code: 'I.9',
        titre: 'Pilotage & amélioration continue',
        responsable: 'DSI',
        debut: 'Jan 2026', fin: 'Déc 2027',
        statut: 'Permanent',
        indicateur: 'Revues mensuelles tenues, actions de progrès tracées',
        observation: 'Activité récurrente sur toute la durée du programme',
        sousTaches: [
          { titre: 'Revues mensuelles COMOP',                         statut: 'EN COURS', detail: 'Tableau de bord de suivi des jalons' },
          { titre: 'Reporting trimestriel DG',                        statut: 'EN COURS', detail: 'Avancement programme + KPI qualité' },
          { titre: 'Mise à jour du plan d\'action',                   statut: 'EN COURS' },
          { titre: 'Revue annuelle du référentiel indicateurs',       statut: 'À FAIRE',  detail: 'Dec 2026 + Dec 2027' },
        ],
      },
    ],
  },

  // ── PHASE II — DATAMARTS ───────────────────────────────────────────────────
  {
    id: 'datamarts',
    numero: 'II',
    titre: 'Conception & Réalisation des Datamarts',
    color: '#96C11E',
    jalons: [
      {
        code: 'II.1',
        titre: 'Score Card MDI',
        responsable: 'DSI / Direction Clientèle',
        debut: 'Jan 2026', fin: 'Mar 2026',
        statut: 'FAIT',
        indicateur: 'Tableau de bord MDI livré et validé en production',
        observation: 'Mis en production Mar 2026 — accessible sur le portail',
        sousTaches: [
          { titre: 'Expression de besoins Direction Clientèle',       statut: 'FAIT', detail: 'Atelier de cadrage — Jan 2026' },
          { titre: 'Modélisation du datamart MDI',                    statut: 'FAIT', detail: 'Schéma étoile validé' },
          { titre: 'Développement des KPI (CA, recouvrement, impayés)', statut: 'FAIT' },
          { titre: 'Intégration source Oracle AarSENEAU',             statut: 'FAIT', detail: 'ETL Talend — pipeline quotidien' },
          { titre: 'Tests et recette utilisateurs',                   statut: 'FAIT', detail: '3 cycles de recette' },
          { titre: 'Mise en production & formation utilisateurs',     statut: 'FAIT', detail: 'Formation 12 utilisateurs' },
        ],
      },
      {
        code: 'II.2',
        titre: 'Datamart DRHT (RH & Temps)',
        responsable: 'DSI / DRH',
        debut: 'Jun 2026', fin: 'Déc 2026',
        statut: 'EN COURS',
        indicateur: 'Datamart DRHT en production, données < 24h',
        observation: 'Phase d\'expression de besoins terminée, modélisation en cours',
        sousTaches: [
          { titre: 'Expression de besoins DRH',                       statut: 'FAIT',    detail: '3 ateliers — 15 KPI identifiés' },
          { titre: 'Modélisation du datamart DRHT',                   statut: 'EN COURS', detail: 'Schéma en révision' },
          { titre: 'Extraction données RH (Oracle SIRH)',             statut: 'À FAIRE' },
          { titre: 'Développement tableaux de bord',                  statut: 'À FAIRE',  detail: 'Effectifs, absences, formations' },
          { titre: 'Tests et recette DRH',                            statut: 'À FAIRE' },
          { titre: 'Mise en production',                              statut: 'À FAIRE',  detail: 'Cible Déc 2026' },
        ],
      },
      {
        code: 'II.3',
        titre: 'Score Card DRMC',
        responsable: 'DSI / DRMC',
        debut: 'Jun 2026', fin: 'Déc 2026',
        statut: 'À FAIRE',
        indicateur: 'Tableau de bord DRMC livré et validé',
        sousTaches: [
          { titre: 'Cadrage et expression de besoins DRMC',           statut: 'À FAIRE' },
          { titre: 'Modélisation KPI DRMC',                           statut: 'À FAIRE' },
          { titre: 'Développement du tableau de bord',                statut: 'À FAIRE' },
          { titre: 'Recette et déploiement',                          statut: 'À FAIRE' },
        ],
      },
      {
        code: 'II.4',
        titre: 'Datamart Intervention réseau',
        responsable: 'DSI / Direction Technique',
        debut: 'Jan 2026', fin: 'Juil 2026',
        statut: 'EN COURS',
        indicateur: 'Datamart réseau opérationnel, suivi interventions en temps réel',
        observation: 'Intégration gordon 80% réalisé',
        sousTaches: [
          { titre: 'Expression de besoins Direction Technique',       statut: 'FAIT',    detail: 'Suivi pannes, délais, MTTR' },
          { titre: 'Connexion source GMAO',                           statut: 'EN COURS', detail: 'Extraction des ordres de travail' },
          { titre: 'Modélisation datamart interventions',             statut: 'FAIT' },
          { titre: 'Développement indicateurs réseau',                statut: 'EN COURS', detail: 'MTTR, taux résolution, NRW' },
          { titre: 'Tests et recette',                                statut: 'À FAIRE' },
          { titre: 'Mise en production — Juil 2026',                  statut: 'À FAIRE' },
        ],
      },
      {
        code: 'II.5',
        titre: 'Datamart DAL (Achat / Stock)',
        responsable: 'DSI / DAL',
        debut: 'Jun 2026', fin: 'Déc 2026',
        statut: 'EN COURS',
        indicateur: 'Datamart DAL en production, stocks et achats tracés',
        sousTaches: [
          { titre: 'Expression de besoins DAL',                       statut: 'FAIT',    detail: 'KPI achats, stocks, délais fournisseurs' },
          { titre: 'Audit des sources données achats/stocks',         statut: 'EN COURS' },
          { titre: 'Modélisation datamart DAL',                       statut: 'À FAIRE' },
          { titre: 'Pipeline ETL fournisseurs & commandes',           statut: 'À FAIRE' },
          { titre: 'Tableaux de bord suivi stocks',                   statut: 'À FAIRE' },
          { titre: 'Mise en production',                              statut: 'À FAIRE', detail: 'Cible Déc 2026' },
        ],
      },
      {
        code: 'II.6',
        titre: 'Datamart Production eau',
        responsable: 'DSI / Direction Technique',
        debut: 'Jan 2026', fin: 'Sep 2026',
        statut: 'EN COURS',
        indicateur: 'Volumes produits et NRW suivis automatiquement',
        observation: 'Collecte automatisée sur 7/12 zones de production',
        sousTaches: [
          { titre: 'Inventaire des points de mesure actifs',          statut: 'FAIT',    detail: '87 points — 7 zones couvertes' },
          { titre: 'Mise en place pipeline collecte télémétrie',      statut: 'FAIT' },
          { titre: 'Modélisation volumes/pertes (NRW)',               statut: 'EN COURS' },
          { titre: 'Intégration données laboratoire qualité',         statut: 'EN COURS', detail: 'pH, turbidité, chlore' },
          { titre: 'Tableaux de bord production & distribution',      statut: 'À FAIRE' },
          { titre: 'Extension à 12/12 zones + mise en production',   statut: 'À FAIRE',  detail: 'Cible Sep 2026' },
        ],
      },
      {
        code: 'II.7',
        titre: 'Datamart Clientèle',
        responsable: 'DSI / Direction Clientèle',
        debut: 'Jan 2026', fin: 'Déc 2027',
        statut: 'EN COURS',
        indicateur: 'Historique clients, facturations et scores 360° centralisés',
        observation: 'Score Card MDI (II.1) est la 1ère brique livrée',
        sousTaches: [
          { titre: 'Score Card MDI (1ère brique)',                    statut: 'FAIT',    detail: 'Voir II.1 — livré Mar 2026' },
          { titre: 'Historique 5 ans facturations / paiements',      statut: 'EN COURS', detail: 'Migration Oracle → DWH PostgreSQL' },
          { titre: 'Modèle Score Client 360° v2 (ML)',               statut: 'EN COURS', detail: 'Mise à jour hebdomadaire' },
          { titre: 'Segmentation et clustering clients',              statut: 'À FAIRE',  detail: '5 segments comportementaux' },
          { titre: 'Cartographie SIG clients et impayés',            statut: 'EN COURS', detail: 'Carte interactive par DT/Secteur' },
          { titre: 'Module prédiction impayés',                       statut: 'À FAIRE',  detail: 'Modèle ML — horizon 30 jours' },
          { titre: 'Consolidation complète Déc 2027',                statut: 'À FAIRE' },
        ],
      },
      {
        code: 'II.8',
        titre: 'Datamart Finance',
        responsable: 'DSI / DAF',
        debut: 'Mar 2026', fin: 'Nov 2026',
        statut: 'À FAIRE',
        indicateur: 'Indicateurs financiers consolidés en production',
        sousTaches: [
          { titre: 'Expression de besoins DAF',                       statut: 'À FAIRE', detail: 'Budget, trésorerie, charges, investissements' },
          { titre: 'Audit sources comptables et financières',         statut: 'À FAIRE' },
          { titre: 'Modélisation datamart Finance',                   statut: 'À FAIRE' },
          { titre: 'Pipeline ETL source comptabilité',                statut: 'À FAIRE' },
          { titre: 'Tableaux de bord financiers',                     statut: 'À FAIRE' },
          { titre: 'Mise en production — Nov 2026',                   statut: 'À FAIRE' },
        ],
      },
      {
        code: 'II.9',
        titre: 'Datamart SMQSE',
        responsable: 'DSI / SMQSE',
        debut: 'Mar 2026', fin: 'Déc 2026',
        statut: 'À FAIRE',
        indicateur: 'Indicateurs qualité, sécurité et environnement suivis',
        sousTaches: [
          { titre: 'Expression de besoins SMQSE',                     statut: 'À FAIRE', detail: 'Qualité eau, sécurité chantiers, ISO' },
          { titre: 'Modélisation datamart SMQSE',                     statut: 'À FAIRE' },
          { titre: 'Pipeline collecte indicateurs qualité',           statut: 'À FAIRE' },
          { titre: 'Tableau de bord conformité ISO / OHSAS',          statut: 'À FAIRE' },
          { titre: 'Mise en production',                              statut: 'À FAIRE' },
        ],
      },
      {
        code: 'II.10',
        titre: 'Datamart Travaux',
        responsable: 'DSI / Direction Travaux',
        debut: 'Mar 2026', fin: 'Déc 2026',
        statut: 'À FAIRE',
        indicateur: 'Suivi chantiers et investissements opérationnel',
        sousTaches: [
          { titre: 'Expression de besoins Direction Travaux',         statut: 'À FAIRE', detail: 'Avancement chantiers, coûts, délais' },
          { titre: 'Modélisation datamart Travaux',                   statut: 'À FAIRE' },
          { titre: 'Intégration planning et marchés',                 statut: 'À FAIRE' },
          { titre: 'Tableau de bord investissements',                 statut: 'À FAIRE' },
          { titre: 'Mise en production',                              statut: 'À FAIRE' },
        ],
      },
      {
        code: 'II.11',
        titre: 'Systématisation Collecte Prod-Labo',
        responsable: 'DSI / Direction Technique',
        debut: 'Jan 2026', fin: 'Déc 2026',
        statut: 'EN COURS',
        indicateur: 'Collecte automatisée (> 90% des points de mesure)',
        observation: 'Actuellement 7/12 zones couvertes — cible 12/12 en Déc 2026',
        sousTaches: [
          { titre: 'Audit points de mesure existants',                statut: 'FAIT',    detail: '87 capteurs inventoriés' },
          { titre: 'Déploiement télémétrie zones 1-7',                statut: 'FAIT' },
          { titre: 'Automatisation transfert données labo',           statut: 'EN COURS', detail: 'Protocole API labo → DWH' },
          { titre: 'Validation qualité données collectées',           statut: 'À FAIRE',  detail: 'Contrôle > 95% complétude' },
        ],
      },
      {
        code: 'II.12',
        titre: 'Recrutement Data Engineer + Data Architect',
        responsable: 'DRH / DSI',
        debut: 'Jun 2026', fin: 'Déc 2026',
        statut: 'À FAIRE',
        indicateur: 'Profils recrutés et intégrés dans l\'équipe Data',
        sousTaches: [
          { titre: 'Rédaction profils de poste Data Engineer',        statut: 'À FAIRE', detail: 'Python, Spark, PostgreSQL, ETL' },
          { titre: 'Rédaction profil Data Architect',                 statut: 'À FAIRE', detail: 'DWH, modélisation, MDM' },
          { titre: 'Lancement appels à candidatures',                 statut: 'À FAIRE' },
          { titre: 'Entretiens et sélection',                         statut: 'À FAIRE' },
          { titre: 'Intégration et onboarding équipe',                statut: 'À FAIRE', detail: '1 mois d\'onboarding' },
        ],
      },
    ],
  },
]

// ─── KPIs synthèse ────────────────────────────────────────────────────────────

export function roadmapStats() {
  const all       = PHASES.flatMap(p => p.jalons)
  const total     = all.length
  const fait      = all.filter(j => j.statut === 'FAIT').length
  const enCours   = all.filter(j => j.statut === 'EN COURS').length
  const aFaire    = all.filter(j => j.statut === 'À FAIRE').length
  const permanent = all.filter(j => j.statut === 'Permanent').length
  return { total, fait, enCours, aFaire, permanent }
}
