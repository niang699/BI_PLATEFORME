import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Contexte statique — mis en cache côté Anthropic (prompt caching) ────────
// Ne change jamais → envoyé une fois, puis servi depuis le cache (~90% moins cher)
const BASE_CONTEXT = `Tu es JAMBAR, l'Assistant Analytique Officiel de SEN'EAU (Société Nationale des Eaux du Sénégal).

IDENTITÉ :
- Tu t'appelles JAMBAR — Assistant Analytique SEN'EAU
- Tu travailles exclusivement sur les données SEN'EAU
- Tu réponds en français, ton professionnel et accessible
- Tes réponses sont concises : maximum 120 mots sauf demande explicite
- Tu utilises des emojis sobres pour structurer (📊 ✅ ⚠️ 💡 📈 📉)

CONNAISSANCE MÉTIER SEN'EAU :
SEUILS DE PERFORMANCE :
• Taux de recouvrement cible    : > 85%
• Taux de disponibilité SI      : > 99%
• Délai traitement réclamations : < 5 jours
• Rendement réseau              : > 80%
• Taux de conformité eau        : 100%

DIRECTIONS (13) :
• DCL  → Direction Clientèle
• DPD  → Direction Production et Distribution
• DTO  → Direction Travaux et Ouvrages
• DTX  → Direction Technique
• DRH  → Direction Ressources Humaines
• DSI  → Direction Systèmes d'Information
• DAL  → Direction Achats et Logistique
• DFC  → Direction Finances et Comptabilité
• DQSE → Direction Qualité Sécurité Environnement
• DCRP → Direction Communication et Relations Publiques
• DLCQE→ Direction Laboratoire et Contrôle Qualité Eau
• DPP  → Direction Planification et Projets
• SG   → Secrétariat Général

SEGMENTATION CLIENT 360° :
• ⭐ Premium      → Paiement régulier · ancienneté > 5 ans
• ✅ Stable       → Retards < 15 jours · fidèle
• 👁️ À surveiller → Retards 15-30 jours · finit par payer
• 🤝 Sensible     → Difficultés réelles · bonne foi
• 🚨 Critique     → Impayés chroniques · non-réponse

RÈGLE ABSOLUE :
Si la question est hors périmètre SEN'EAU, réponds :
"Je suis spécialisé sur les données et processus SEN'EAU. Posez-moi une question sur vos KPIs, indicateurs ou segments clients."`

// ── Types ────────────────────────────────────────────────────────────────────
type DtData = {
  dr: string; taux_recouvrement: number; a_risque: boolean; ecart_objectif: number
  ca_total?: number; encaissement?: number; impaye?: number
}

type LiveData = {
  fact?: {
    ca_total?: number; ca?: number   // ca_total = nom unifié, ca = alias rétrocompat
    encaissement?: number; impaye?: number; taux_recouvrement?: number; taux_impaye?: number
    nb_factures?: number; nb_dr?: number
    objectif_taux?: number
    meilleure_dt?: { direction_territoriale?: string; taux_recouvrement?: number }
    pire_dt?: { direction_territoriale?: string; taux_recouvrement?: number }
    dts_a_risque?: DtData[]
  } | null
  rh?: {
    nb_salaries?: number; nb_femmes?: number; taux_feminisation?: number
    masse_salariale?: number; salaire_moyen?: number
    montant_hs?: number; taux_hs?: number
    nb_heures_formation?: number; nb_collaborateurs_formes?: number; pct_formes?: number
  } | null
}

type SystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }

// ── Formatage ────────────────────────────────────────────────────────────────
function fmtM(v?: number) {
  if (!v) return 'N/A'
  return v >= 1e9 ? `${(v / 1e9).toFixed(2)} Mrd FCFA` : `${(v / 1e6).toFixed(2)} M FCFA`
}
function fmtN(v?: number) {
  if (v == null) return 'N/A'
  return new Intl.NumberFormat('fr-FR').format(v)
}

// ── Profondeur d'historique par mode ─────────────────────────────────────────
// rapport : one-shot → 2 messages suffisent (évite de renvoyer les JSON précédents)
// glossaire : questions courtes → 4
// analyse : conversation longue → 8
const HISTORY_DEPTH: Record<string, number> = { rapport: 2, glossaire: 4, analyse: 8 }

// ── Construction du prompt système (2 blocs séparés) ─────────────────────────
// Bloc 1 : BASE_CONTEXT — statique, mis en cache (cache_control: ephemeral)
// Bloc 2 : contexte dynamique du mode — non caché (change selon les données live)
function buildSystemBlocks(
  mode: string,
  kpis?: Record<string, string>,
  liveData?: LiveData,
): SystemBlock[] {
  const staticBlock: SystemBlock = {
    type: 'text',
    text: BASE_CONTEXT,
    cache_control: { type: 'ephemeral' }, // servi depuis le cache après le 1er appel
  }

  let dynamic = ''

  if (mode === 'glossaire') {
    dynamic = `
MODE : GLOSSAIRE MÉTIER SEN'EAU
Tu es le référentiel de définitions métier SEN'EAU.
Format de réponse :
📌 **[TERME]**
Définition : ...
Formule (si applicable) : ...
Seuil SEN'EAU : ...
Exemple concret : ...`
  } else if (mode === 'rapport') {
    const f = liveData?.fact
    const r = liveData?.rh

    const objectif = f?.objectif_taux ?? 98.5
    const ca = f?.ca_total ?? f?.ca ?? 0
    const dtRisqueLines = f?.dts_a_risque?.length
      ? f.dts_a_risque.map(d =>
          `  ⚠️ ${d.dr} : ${d.taux_recouvrement.toFixed(1)}%  (écart : ${d.ecart_objectif.toFixed(1)} pts)`
        ).join('\n')
      : '  ✅ Toutes les DTs atteignent l\'objectif'

    const factBlock = f ? `
DONNÉES FACTURATION (sen_ods · mv_recouvrement) :
• CA total                  : ${fmtM(ca)}
• Encaissement              : ${fmtM(f.encaissement)}
• Impayés                   : ${fmtM(f.impaye)}
• Taux de recouvrement      : ${f.taux_recouvrement?.toFixed(1) ?? 'N/A'}%   [objectif : ${objectif}%]
• Taux d'impayés            : ${f.taux_impaye?.toFixed(1) ?? 'N/A'}%
• Nombre de factures        : ${fmtN(f.nb_factures)}
• Nombre de DTs             : ${f.nb_dr ?? 'N/A'}
• Meilleure DT              : ${f.meilleure_dt?.direction_territoriale ?? 'N/A'} (${f.meilleure_dt?.taux_recouvrement?.toFixed(1) ?? 'N/A'}%)
• Pire DT                   : ${f.pire_dt?.direction_territoriale ?? 'N/A'} (${f.pire_dt?.taux_recouvrement?.toFixed(1) ?? 'N/A'}%)
DTs À RISQUE (< ${objectif}%) :
${dtRisqueLines}
INTERPRÉTATION :
- Objectif taux recouvrement : ${objectif}%
- Taux ≥ ${objectif}% → atteint · 90–${objectif}% → attention · < 90% → critique
- Taux impayés > 10% → risque trésorerie
- Chaque DT à risque nécessite un plan de recouvrement ciblé` : ''

    const rhBlock = r ? `
DONNÉES RH EN TEMPS RÉEL :
• Effectif total             : ${fmtN(r.nb_salaries)} collaborateurs
• Effectif féminin           : ${fmtN(r.nb_femmes)} · Taux féminisation : ${r.taux_feminisation?.toFixed(1) ?? 'N/A'}%
• Masse salariale            : ${fmtM(r.masse_salariale)} · Salaire moyen : ${fmtM(r.salaire_moyen)}
• Heures supp.               : ${fmtM(r.montant_hs)} · Taux HS : ${r.taux_hs?.toFixed(2) ?? 'N/A'}%  [seuil : > 5%]
• Formation                  : ${fmtN(r.nb_heures_formation)} h · ${fmtN(r.nb_collaborateurs_formes)} formés (${r.pct_formes?.toFixed(1) ?? 'N/A'}%)
INTERPRÉTATION :
- Féminisation < 20% → déséquilibre genre
- Taux HS > 8% → risque réglementaire
- Formés < 50% → plan de formation insuffisant` : ''

    dynamic = `${factBlock}${rhBlock}

RÉPONDS UNIQUEMENT avec ce JSON (aucun texte autour). Utilise les données réelles ci-dessus.
{"titre":"...","periode":"...","synthese":"2-3 phrases.","kpis":[{"label":"...","valeur":"...","unite":"...","cible":"...","statut":"ok|warning|alert"}],"positifs":["...","..."],"vigilances":["...","..."],"recommandations":["...","..."],"tableau":null}
Règles : max 5 kpis · max 3 items par liste · tableau=null si inutile · statut selon écart à la cible.`
  } else {
    // mode analyse
    const k = kpis ?? {}
    dynamic = `
MODE : ANALYSE DES PERFORMANCES
DONNÉES EN TEMPS RÉEL :
• Total indicateurs    : ${k.total ?? 'N/A'}
• Cibles atteintes     : ${k.atteints ?? 'N/A'} (${k.pct ?? 'N/A'}%)
• Indicateurs P1       : ${k.priorite1 ?? 'N/A'}
• Services couverts    : ${k.services ?? 'N/A'}
• Processus qualité    : ${k.processus ?? 'N/A'}`
  }

  return [staticBlock, { type: 'text', text: dynamic }]
}

// ── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { messages, mode, kpis, liveData } = await req.json()

    const depth = HISTORY_DEPTH[mode ?? 'analyse'] ?? 8
    const history = (messages as { role: string; content: string }[]).slice(-depth)

    // Rapport → Sonnet (3-5x plus rapide qu'Opus, largement suffisant pour du JSON structuré)
    // Analyse/Glossaire → Haiku (réponses courtes, ultra-rapide)
    const model = mode === 'rapport'
      ? 'claude-sonnet-4-6'
      : mode === 'analyse' || mode === 'glossaire'
      ? 'claude-haiku-4-5-20251001'
      : 'claude-sonnet-4-6'

    const stream = await client.messages.stream(
      {
        model,
        max_tokens: mode === 'rapport' ? 2500 : 400,
        system: buildSystemBlocks(mode ?? 'analyse', kpis, liveData as LiveData) as Anthropic.TextBlockParam[],
        messages: history as Anthropic.MessageParam[],
      },
      { headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' } },
    )

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.error('JAMBAR API error:', err)
    return new Response("Erreur de connexion à l'API Claude.", { status: 500 })
  }
}
