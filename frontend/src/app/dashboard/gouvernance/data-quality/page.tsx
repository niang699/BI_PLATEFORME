'use client'
import { useState, useEffect } from 'react'
import TopBar from '@/components/TopBar'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  LineChart, Line, CartesianGrid, Legend, ReferenceLine,
} from 'recharts'
import { ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, RefreshCw, ChevronLeft, HelpCircle, X } from 'lucide-react'
import Link from 'next/link'

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface DqRule {
  id: string; label: string; source: string; dimension: string
  score: number; nb_total: number; nb_ok: number; nb_ko: number
}
interface DqSource { id: string; label: string; schema: string; score: number; nb_rules: number; nb_ok: number }
interface DqDim    { id: string; label: string; score: number; weight: number }
interface DqData {
  score_global: number; last_run: string
  sources: DqSource[]; dimensions: DqDim[]; rules: DqRule[]; _errors: string[]
}
interface DqHistoryRow {
  date: string
  score_global: number
  completude: number; exactitude: number; coherence: number
  fraicheur: number;  unicite: number;    conformite: number
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
const scoreColor = (s: number) => s >= 90 ? '#059669' : s >= 75 ? '#D97706' : '#DC2626'
const scoreLabel = (s: number) => s >= 90 ? 'Excellent' : s >= 75 ? 'Acceptable' : s < 60 ? 'Critique' : 'À surveiller'
const scoreIcon  = (s: number) =>
  s >= 90 ? <CheckCircle2 size={14} />
  : s >= 75 ? <AlertTriangle size={14} />
  : <AlertCircle size={14} />

const DIM_COLORS: Record<string, string> = {
  completude: '#1F3B72', exactitude: '#96C11E', coherence: '#0891B2',
  fraicheur:  '#8b5cf6', unicite:    '#D97706', conformite: '#059669',
}

/* ─── Mini polygone SVG pour la modale ─────────────────────────────────────── */
function MiniRadar({ points, color, label }: { points: number[], color: string, label: string }) {
  // points = 6 scores (0-100) dans l'ordre des axes
  const cx = 60, cy = 60, r = 46
  const angles = [270, 330, 30, 90, 150, 210] // top, top-right, bottom-right, bottom, bottom-left, top-left
  const toXY = (angle: number, pct: number) => {
    const rad = (angle * Math.PI) / 180
    return { x: cx + (r * pct / 100) * Math.cos(rad), y: cy + (r * pct / 100) * Math.sin(rad) }
  }
  const gridPts = angles.map(a => toXY(a, 100))
  const dataPts = angles.map((a, i) => toXY(a, points[i]))
  const poly = (pts: {x:number,y:number}[]) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const gridLines = gridPts.map(p => `M${cx},${cy} L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        {/* Grille */}
        {[25, 50, 75, 100].map(pct => (
          <polygon key={pct}
            points={poly(angles.map(a => toXY(a, pct)))}
            fill="none" stroke="rgba(31,59,114,.12)" strokeWidth={0.8} />
        ))}
        <path d={gridLines} stroke="rgba(31,59,114,.1)" strokeWidth={0.8} fill="none" />
        {/* Données */}
        <polygon points={poly(dataPts)} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1.8} />
        {dataPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />)}
      </svg>
      <div style={{ fontSize: 10, fontWeight: 700, color, textAlign: 'center', maxWidth: 110 }}>{label}</div>
    </div>
  )
}

/* ─── Modale guide radar ─────────────────────────────────────────────────────── */
function RadarGuideModal({ onClose }: { onClose: () => void }) {
  const dims = [
    { id: 'completude', label: 'Complétude', weight: 30, color: '#1F3B72',
      desc: 'Champs obligatoires remplis', low: 'Données manquantes — abonnés sans adresse, compteurs sans index' },
    { id: 'exactitude', label: 'Exactitude', weight: 25, color: '#96C11E',
      desc: 'Valeurs dans les plages attendues', low: 'Valeurs aberrantes — consommation négative, âge > 120 ans' },
    { id: 'coherence', label: 'Cohérence', weight: 20, color: '#0891B2',
      desc: 'Cohérence entre tables liées', low: 'Contradictions — facture sans abonné, paiement > montant dû' },
    { id: 'fraicheur', label: 'Fraîcheur', weight: 15, color: '#8b5cf6',
      desc: 'Données mises à jour dans les délais', low: 'Retard de synchronisation — index non relevés depuis >48h' },
    { id: 'unicite', label: 'Unicité', weight: 7, color: '#D97706',
      desc: 'Absence de doublons', low: 'Doublons — même abonné enregistré deux fois' },
    { id: 'conformite', label: 'Conformité', weight: 3, color: '#059669',
      desc: 'Formats respectés (email, tél…)', low: 'Format invalide — numéro à 7 chiffres, email sans @' },
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 20, padding: '28px 32px',
        maxWidth: 760, width: '90vw', maxHeight: '88vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(15,23,42,.25)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1F3B72', marginBottom: 4 }}>
              Comment lire le Radar Chart ?
            </div>
            <div style={{ fontSize: 12, color: 'rgba(31,59,114,.45)' }}>
              Chaque axe = une dimension · Centre = 0 · Bord = 100
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'rgba(31,59,114,.06)', border: 'none', borderRadius: 8,
              padding: 6, cursor: 'pointer', color: '#1F3B72', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* 3 exemples de polygones */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1F3B72', letterSpacing: '.06em',
          textTransform: 'uppercase', marginBottom: 14 }}>Formes typiques</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>

          <div style={{ padding: '16px 12px', borderRadius: 12, border: '1.5px solid #059669',
            background: 'rgba(5,150,105,.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <MiniRadar points={[92, 88, 90, 85, 93, 91]} color="#059669"
              label="Hexagone large et régulier" />
            <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', textAlign: 'center' }}>
              Qualité excellente
            </div>
            <div style={{ fontSize: 10, color: 'rgba(31,59,114,.55)', textAlign: 'center', lineHeight: 1.5 }}>
              Tous les axes ≥ 85%. La source de données est fiable sur toutes les dimensions.
            </div>
          </div>

          <div style={{ padding: '16px 12px', borderRadius: 12, border: '1.5px solid #D97706',
            background: 'rgba(217,119,6,.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <MiniRadar points={[55, 50, 58, 48, 52, 60]} color="#D97706"
              label="Hexagone rétréci uniformément" />
            <div style={{ fontSize: 10, fontWeight: 700, color: '#D97706', textAlign: 'center' }}>
              Problème systémique
            </div>
            <div style={{ fontSize: 10, color: 'rgba(31,59,114,.55)', textAlign: 'center', lineHeight: 1.5 }}>
              Tous les axes &lt; 60%. La source entière est dégradée — vérifier la pipeline d'alimentation.
            </div>
          </div>

          <div style={{ padding: '16px 12px', borderRadius: 12, border: '1.5px solid #DC2626',
            background: 'rgba(220,38,38,.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <MiniRadar points={[88, 85, 90, 30, 87, 91]} color="#DC2626"
              label="Creux sur un axe (Fraîcheur)" />
            <div style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', textAlign: 'center' }}>
              Problème ciblé
            </div>
            <div style={{ fontSize: 10, color: 'rgba(31,59,114,.55)', textAlign: 'center', lineHeight: 1.5 }}>
              Un seul axe effondré. Identifier la règle en échec dans le tableau ci-dessous et intervenir précisément.
            </div>
          </div>
        </div>

        {/* Tableau des 6 dimensions */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1F3B72', letterSpacing: '.06em',
          textTransform: 'uppercase', marginBottom: 14 }}>Les 6 dimensions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dims.map(d => (
            <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '14px 110px 32px 1fr 1fr',
              alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
              background: 'rgba(31,59,114,.025)', border: '1px solid rgba(31,59,114,.06)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: d.color }}>{d.label}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#1F3B72',
                background: 'rgba(31,59,114,.08)', borderRadius: 6, padding: '2px 6px', textAlign: 'center' }}>
                {d.weight}%
              </div>
              <div style={{ fontSize: 10, color: 'rgba(31,59,114,.6)' }}>{d.desc}</div>
              <div style={{ fontSize: 10, color: '#DC2626', opacity: .8 }}>
                <span style={{ fontWeight: 700 }}>Si bas : </span>{d.low}
              </div>
            </div>
          ))}
        </div>

        {/* Règle de lecture résumée */}
        <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(31,59,114,.04)', border: '1px solid rgba(31,59,114,.1)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#1F3B72', marginBottom: 4 }}>
            Règle d'or
          </div>
          <div style={{ fontSize: 10, color: 'rgba(31,59,114,.65)', lineHeight: 1.6 }}>
            La <strong>surface du polygone</strong> représente la qualité globale.
            Un creux sur <strong>Complétude</strong> ou <strong>Exactitude</strong> coûte beaucoup plus cher au score global
            (30% + 25% = 55% du poids total) qu'un creux sur <strong>Conformité</strong> (3%).
            Priorisez toujours les axes les plus lourds.
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Mini jauge SVG pour la modale Score Global ───────────────────────────── */
function MiniGauge({ score, label, sublabel }: { score: number; label: string; sublabel: string }) {
  const r = 32, cx = 40, cy = 40
  const circ = 2 * Math.PI * r
  const dash  = (score / 100) * circ * 0.75
  const color = score >= 90 ? '#059669' : score >= 75 ? '#D97706' : score >= 60 ? '#F59E0B' : '#DC2626'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={80} height={70} viewBox="0 0 80 80">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(31,59,114,.08)"
          strokeWidth={7} strokeDasharray={`${circ * 0.75} ${circ}`}
          strokeDashoffset={-circ * 0.125} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color}
          strokeWidth={7} strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={-circ * 0.125} strokeLinecap="round" />
        <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle"
          fontSize={13} fontWeight={800} fill={color}>{score}</text>
        <text x={cx} y={cx + 12} textAnchor="middle" fontSize={7} fill="rgba(31,59,114,.4)">/100</text>
      </svg>
      <div style={{ fontSize: 11, fontWeight: 700, color, textAlign: 'center' }}>{label}</div>
      <div style={{ fontSize: 9, color: 'rgba(31,59,114,.45)', textAlign: 'center', maxWidth: 110, lineHeight: 1.5 }}>{sublabel}</div>
    </div>
  )
}

/* ─── Modale guide Score Global ──────────────────────────────────────────────── */
function ScoreGuideModal({ onClose }: { onClose: () => void }) {
  const zones = [
    { score: 95, label: 'Excellent', range: '90 – 100', color: '#059669',
      bg: 'rgba(5,150,105,.06)', border: '#059669',
      desc: 'Données fiables et à jour. Les processus métier peuvent s\'appuyer sur ces données sans vérification manuelle supplémentaire.',
      actions: ['Maintenir la cadence de surveillance', 'Documenter les bonnes pratiques', 'Étendre les règles à d\'autres sources'] },
    { score: 80, label: 'Acceptable', range: '75 – 89', color: '#D97706',
      bg: 'rgba(217,119,6,.06)', border: '#D97706',
      desc: 'Qualité satisfaisante mais quelques anomalies à corriger. Les rapports restent exploitables avec une vigilance accrue sur les dimensions en jaune.',
      actions: ['Identifier les règles en échec dans le tableau', 'Planifier une correction dans les 30 jours', 'Surveiller l\'évolution hebdomadaire'] },
    { score: 67, label: 'À surveiller', range: '60 – 74', color: '#F59E0B',
      bg: 'rgba(245,158,11,.06)', border: '#F59E0B',
      desc: 'Des anomalies significatives affectent la fiabilité. Certains rapports peuvent contenir des erreurs. Une action corrective est recommandée.',
      actions: ['Prioriser les dimensions à fort poids (Complétude, Exactitude)', 'Ouvrir un ticket de correction dans les 15 jours', 'Bloquer les exports critiques si < 65'] },
    { score: 45, label: 'Critique', range: '0 – 59', color: '#DC2626',
      bg: 'rgba(220,38,38,.06)', border: '#DC2626',
      desc: 'Qualité insuffisante. Les données ne doivent pas être utilisées pour des décisions opérationnelles sans audit préalable.',
      actions: ['Escalader immédiatement au responsable de la source', 'Geler les exports automatiques', 'Lancer un audit complet de la pipeline'] },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 20, padding: '28px 32px',
        maxWidth: 780, width: '90vw', maxHeight: '88vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(15,23,42,.25)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1F3B72', marginBottom: 4 }}>
              Guide — Score Global de Qualité
            </div>
            <div style={{ fontSize: 12, color: 'rgba(31,59,114,.45)' }}>
              Moyenne pondérée des 6 dimensions · Échelle 0 – 100
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'rgba(31,59,114,.06)', border: 'none', borderRadius: 8,
              padding: 6, cursor: 'pointer', color: '#1F3B72', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Formule de calcul */}
        <div style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(31,59,114,.04) 0%, rgba(31,59,114,.08) 100%)',
          border: '1px solid rgba(31,59,114,.1)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#1F3B72', letterSpacing: '.06em',
            textTransform: 'uppercase', marginBottom: 10 }}>Formule de calcul</div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#1F3B72', lineHeight: 1.8 }}>
            Score = (Complétude × <strong>0.30</strong>)
                  + (Exactitude × <strong>0.25</strong>)
                  + (Cohérence  × <strong>0.20</strong>)
                  + (Fraîcheur  × <strong>0.15</strong>)
                  + (Unicité    × <strong>0.07</strong>)
                  + (Conformité × <strong>0.03</strong>)
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(31,59,114,.5)',
            padding: '8px 12px', background: 'rgba(31,59,114,.04)', borderRadius: 8 }}>
            Chaque dimension est calculée par : <strong>nb_enregistrements_conformes / nb_total × 100</strong>
          </div>
        </div>

        {/* 4 zones de score */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1F3B72', letterSpacing: '.06em',
          textTransform: 'uppercase', marginBottom: 14 }}>Interprétation par zone</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {zones.map(z => (
            <div key={z.label} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto',
              gap: 16, alignItems: 'start', padding: '14px 18px', borderRadius: 12,
              background: z.bg, border: `1.5px solid ${z.border}22` }}>
              <MiniGauge score={z.score} label={z.label} sublabel={z.range} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: z.color, marginBottom: 6 }}>
                  {z.label} — {z.range}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(31,59,114,.65)', lineHeight: 1.6, marginBottom: 8 }}>
                  {z.desc}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {z.actions.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 10, color: 'rgba(31,59,114,.6)' }}>
                      <span style={{ color: z.color, fontSize: 8, marginTop: 2, flexShrink: 0 }}>▶</span>
                      {a}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: z.color, opacity: .15,
                alignSelf: 'center', lineHeight: 1 }}>
                {z.score >= 90 ? '✓' : z.score >= 75 ? '~' : z.score >= 60 ? '!' : '✕'}
              </div>
            </div>
          ))}
        </div>

        {/* Barre de progression visuelle */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1F3B72', letterSpacing: '.06em',
          textTransform: 'uppercase', marginBottom: 12 }}>Échelle de référence</div>
        <div style={{ position: 'relative', height: 28, borderRadius: 14, overflow: 'hidden',
          background: 'linear-gradient(to right, #DC2626 0%, #F59E0B 30%, #D97706 50%, #059669 75%, #059669 100%)',
          marginBottom: 6 }}>
          {[0, 60, 75, 90, 100].map(v => (
            <div key={v} style={{ position: 'absolute', left: `${v}%`, top: 0, bottom: 0,
              borderLeft: '1px solid rgba(255,255,255,.4)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9,
          color: 'rgba(31,59,114,.4)', fontWeight: 600, paddingLeft: 0, marginBottom: 20 }}>
          <span>0 · Critique</span>
          <span style={{ marginLeft: '59%' }}>60</span>
          <span>75</span>
          <span>90 · Excellent</span>
        </div>

        {/* Note de bas de page */}
        <div style={{ padding: '12px 16px', borderRadius: 10,
          background: 'rgba(31,59,114,.03)', border: '1px solid rgba(31,59,114,.08)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#1F3B72', marginBottom: 4 }}>
            Fréquence de calcul
          </div>
          <div style={{ fontSize: 10, color: 'rgba(31,59,114,.55)', lineHeight: 1.6 }}>
            Le score est recalculé à chaque chargement de la page (TTL cache : 1h) ou manuellement via le bouton <strong>Recalculer</strong>.
            Les règles SQL s'exécutent directement sur <strong>sen_dwh</strong> (RH) et <strong>sen_ods</strong> (Facturation).
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Gauge circulaire SVG ──────────────────────────────────────────────────── */
function ScoreGauge({ score }: { score: number }) {
  const r = 70, cx = 90, cy = 90
  const circ = 2 * Math.PI * r
  const dash  = (score / 100) * circ * 0.75
  const color = scoreColor(score)
  return (
    <svg width={180} height={160} viewBox="0 0 180 180">
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(31,59,114,.08)"
        strokeWidth={14} strokeDasharray={`${circ * 0.75} ${circ}`}
        strokeDashoffset={-circ * 0.125} strokeLinecap="round" />
      {/* Value */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color}
        strokeWidth={14} strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={-circ * 0.125} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
        fontSize={28} fontWeight={800} fill={color}>{score.toFixed(0)}</text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize={10} fontWeight={600}
        fill="rgba(31,59,114,.45)">/ 100</text>
      <text x={cx} y={cy + 38} textAnchor="middle" fontSize={10} fontWeight={700}
        fill={color}>{scoreLabel(score)}</text>
    </svg>
  )
}

/* ─── Composant principal ───────────────────────────────────────────────────── */
export default function DataQualityPage() {
  const [data,       setData]       = useState<DqData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [refresh,    setRefresh]    = useState(0)
  const [filter,     setFilter]     = useState<string>('all')
  const [radarGuide,  setRadarGuide]  = useState(false)
  const [scoreGuide,  setScoreGuide]  = useState(false)
  const [histDays,    setHistDays]    = useState<7|30|90>(30)
  const [histData,    setHistData]    = useState<DqHistoryRow[]>([])
  const [histLoading, setHistLoading] = useState(true)
  const [showAllDims, setShowAllDims] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/data-quality')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    setHistLoading(true)
    fetch(`/api/data-quality/history?days=${histDays}`)
      .then(r => r.json())
      .then(d => { setHistData(Array.isArray(d) ? d : []); setHistLoading(false) })
      .catch(() => { setHistData([]); setHistLoading(false) })
  }, [histDays, refresh])

  const filteredRules = data?.rules.filter(r => filter === 'all' || r.source === filter) ?? []
  const sortedRules   = [...filteredRules].sort((a, b) => a.score - b.score)

  return (
    <>
      <TopBar title="Data Quality Score"
        subtitle="Qualité des données · RH · Facturation · 6 dimensions" />

      {radarGuide && <RadarGuideModal onClose={() => setRadarGuide(false)} />}
      {scoreGuide && <ScoreGuideModal onClose={() => setScoreGuide(false)} />}

      <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '24px 28px' }}>

        {/* ── Fil d'ariane ── */}
        <div style={{ marginBottom: 20 }}>
          <Link href="/dashboard/gouvernance"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: 'rgba(31,59,114,.5)', textDecoration: 'none',
              fontWeight: 600, letterSpacing: '.02em' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#1F3B72')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(31,59,114,.5)')}>
            <ChevronLeft size={14} /> Data Gouvernance
          </Link>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 300, color: 'rgba(31,59,114,.35)', fontSize: 13, gap: 10 }}>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Calcul des scores en cours…
          </div>
        )}

        {!loading && data && (
          <>
            {/* ── Ligne 1 : Score global + Radar + Sources ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: 20, marginBottom: 20 }}>

              {/* Score global */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '24px 16px',
                border: '1px solid rgba(31,59,114,.08)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', boxShadow: '0 2px 12px rgba(31,59,114,.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12, fontWeight: 700, color: '#1F3B72', letterSpacing: '.03em' }}>
                    <ShieldCheck size={14} strokeWidth={2} />
                    SCORE GLOBAL
                  </div>
                  <button onClick={() => setScoreGuide(true)} title="Guide d'interprétation"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(31,59,114,.06)',
                      border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
                      fontSize: 10, fontWeight: 600, color: 'rgba(31,59,114,.5)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(31,59,114,.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#1F3B72' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(31,59,114,.06)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(31,59,114,.5)' }}>
                    <HelpCircle size={12} /> Guide
                  </button>
                </div>
                <ScoreGauge score={data.score_global} />
                <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(31,59,114,.35)', textAlign: 'center' }}>
                  Calculé le {new Date(data.last_run).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
                <button onClick={() => setRefresh(r => r + 1)}
                  style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(31,59,114,.06)', border: 'none', borderRadius: 8,
                    padding: '6px 14px', fontSize: 11, fontWeight: 600,
                    color: '#1F3B72', cursor: 'pointer' }}>
                  <RefreshCw size={11} /> Recalculer
                </button>
              </div>

              {/* Radar dimensions */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '20px 16px',
                border: '1px solid rgba(31,59,114,.08)', boxShadow: '0 2px 12px rgba(31,59,114,.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1F3B72',
                    letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    Profil par dimension
                  </div>
                  <button onClick={() => setRadarGuide(true)} title="Comment lire ce graphique ?"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(31,59,114,.06)',
                      border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
                      fontSize: 10, fontWeight: 600, color: 'rgba(31,59,114,.5)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(31,59,114,.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#1F3B72' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(31,59,114,.06)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(31,59,114,.5)' }}>
                    <HelpCircle size={12} /> Guide
                  </button>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={data.dimensions.map(d => ({ subject: d.label, score: d.score }))}
                    margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                    <PolarGrid stroke="rgba(31,59,114,.15)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'rgba(31,59,114,.7)', fontWeight: 600 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Score" dataKey="score" stroke="#1F3B72" strokeWidth={2}
                      fill="#1F3B72" fillOpacity={0.25}
                      dot={{ fill: '#1F3B72', r: 3 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Scores par source */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '20px 16px',
                border: '1px solid rgba(31,59,114,.08)', boxShadow: '0 2px 12px rgba(31,59,114,.06)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1F3B72',
                  letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 16 }}>
                  Score par source
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {data.sources.map(src => (
                    <div key={src.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#1F3B72' }}>{src.label}</div>
                          <div style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', fontFamily: 'monospace' }}>{src.schema}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                          color: scoreColor(src.score), fontWeight: 800, fontSize: 18 }}>
                          {src.score.toFixed(0)}
                          <span style={{ fontSize: 10, fontWeight: 600 }}>/100</span>
                        </div>
                      </div>
                      <div style={{ height: 6, background: 'rgba(31,59,114,.06)', borderRadius: 4 }}>
                        <div style={{ height: '100%', borderRadius: 4,
                          width: `${src.score}%`, background: scoreColor(src.score),
                          transition: 'width 1s ease' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4,
                        fontSize: 10, color: 'rgba(31,59,114,.4)' }}>
                        <span>{src.nb_rules} règles vérifiées</span>
                        <span style={{ color: '#059669' }}>{src.nb_ok} OK</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Ligne 2 : Évolution temporelle ── */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', marginBottom: 20,
              border: '1px solid rgba(31,59,114,.08)', boxShadow: '0 2px 12px rgba(31,59,114,.06)' }}>

              {/* En-tête */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1F3B72',
                    letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    Évolution du score
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', marginTop: 2 }}>
                    {histData.length > 0
                      ? `${histData.length} point${histData.length > 1 ? 's' : ''} · du ${histData[0].date} au ${histData[histData.length-1].date}`
                      : 'Aucune donnée historique — le score sera enregistré à chaque recalcul'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Toggle dimensions */}
                  <button onClick={() => setShowAllDims(v => !v)}
                    style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 8,
                      border: '1px solid rgba(31,59,114,.15)', cursor: 'pointer',
                      background: showAllDims ? '#1F3B72' : 'transparent',
                      color: showAllDims ? '#fff' : 'rgba(31,59,114,.5)' }}>
                    Dimensions
                  </button>
                  {/* Sélecteur période */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {([7, 30, 90] as const).map(d => (
                      <button key={d} onClick={() => setHistDays(d)}
                        style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', border: '1px solid',
                          borderColor: histDays === d ? '#1F3B72' : 'rgba(31,59,114,.15)',
                          background: histDays === d ? '#1F3B72' : 'transparent',
                          color: histDays === d ? '#fff' : 'rgba(31,59,114,.5)' }}>
                        {d}j
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {histLoading ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(31,59,114,.3)', fontSize: 12, gap: 8 }}>
                  <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Chargement…
                </div>
              ) : histData.length === 0 ? (
                <div style={{ height: 200, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ fontSize: 28 }}>📈</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(31,59,114,.4)' }}>
                    Aucun historique disponible
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(31,59,114,.3)', textAlign: 'center', maxWidth: 280 }}>
                    Les scores sont enregistrés automatiquement à chaque calcul.
                    Cliquez sur <strong>Recalculer</strong> pour créer le premier point.
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={histData} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="rgba(31,59,114,.06)" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(31,59,114,.4)' }}
                      tickFormatter={v => {
                        const [, m, d] = v.split('-')
                        return `${d}/${m}`
                      }}
                      axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'rgba(31,59,114,.4)' }}
                      axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 10,
                        border: '1px solid rgba(31,59,114,.12)', boxShadow: '0 4px 16px rgba(31,59,114,.1)' }}
                      formatter={(v: unknown, name: string) => [`${v}`, name]}
                      labelFormatter={l => `📅 ${l}`} />
                    {/* Lignes de seuil */}
                    <ReferenceLine y={90} stroke="#059669" strokeDasharray="3 3" strokeOpacity={0.4}
                      label={{ value: 'Excellent', position: 'right', fontSize: 8, fill: '#059669', opacity: 0.7 }} />
                    <ReferenceLine y={75} stroke="#D97706" strokeDasharray="3 3" strokeOpacity={0.4}
                      label={{ value: 'Acceptable', position: 'right', fontSize: 8, fill: '#D97706', opacity: 0.7 }} />
                    <ReferenceLine y={60} stroke="#DC2626" strokeDasharray="3 3" strokeOpacity={0.4}
                      label={{ value: 'Critique', position: 'right', fontSize: 8, fill: '#DC2626', opacity: 0.7 }} />
                    {/* Score global — toujours visible */}
                    <Line type="monotone" dataKey="score_global" name="Score global"
                      stroke="#1F3B72" strokeWidth={2.5} dot={{ r: 3, fill: '#1F3B72' }}
                      activeDot={{ r: 5 }} />
                    {/* Dimensions — visibles si toggle actif */}
                    {showAllDims && <>
                      <Line type="monotone" dataKey="completude"  name="Complétude"  stroke="#1F3B72" strokeWidth={1} strokeDasharray="4 2" dot={false} strokeOpacity={0.6} />
                      <Line type="monotone" dataKey="exactitude"  name="Exactitude"  stroke="#96C11E" strokeWidth={1} strokeDasharray="4 2" dot={false} strokeOpacity={0.8} />
                      <Line type="monotone" dataKey="coherence"   name="Cohérence"   stroke="#0891B2" strokeWidth={1} strokeDasharray="4 2" dot={false} strokeOpacity={0.8} />
                      <Line type="monotone" dataKey="fraicheur"   name="Fraîcheur"   stroke="#8b5cf6" strokeWidth={1} strokeDasharray="4 2" dot={false} strokeOpacity={0.8} />
                      <Line type="monotone" dataKey="unicite"     name="Unicité"     stroke="#D97706" strokeWidth={1} strokeDasharray="4 2" dot={false} strokeOpacity={0.8} />
                      <Line type="monotone" dataKey="conformite"  name="Conformité"  stroke="#059669" strokeWidth={1} strokeDasharray="4 2" dot={false} strokeOpacity={0.8} />
                      <Legend iconType="line" iconSize={12}
                        wrapperStyle={{ fontSize: 10, color: 'rgba(31,59,114,.6)', paddingTop: 8 }} />
                    </>}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ── Ligne 3 (ex-2) : Barres dimensions ── */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', marginBottom: 20,
              border: '1px solid rgba(31,59,114,.08)', boxShadow: '0 2px 12px rgba(31,59,114,.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1F3B72',
                letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 16 }}>
                Détail par dimension (pondéré dans le score global)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {data.dimensions.map(d => (
                  <div key={d.id} style={{ padding: '12px 14px', borderRadius: 10,
                    background: 'rgba(31,59,114,.03)', border: '1px solid rgba(31,59,114,.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: DIM_COLORS[d.id] ?? '#1F3B72' }}>{d.label}</div>
                        <div style={{ fontSize: 9, color: 'rgba(31,59,114,.35)', marginTop: 2 }}>Poids {Math.round(d.weight * 100)}%</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4,
                        color: scoreColor(d.score), fontWeight: 800, fontSize: 16 }}>
                        {scoreIcon(d.score)}
                        {d.score.toFixed(0)}
                      </div>
                    </div>
                    <div style={{ height: 5, background: 'rgba(31,59,114,.08)', borderRadius: 4 }}>
                      <div style={{ height: '100%', borderRadius: 4, width: `${d.score}%`,
                        background: DIM_COLORS[d.id] ?? '#1F3B72', opacity: .8, transition: 'width 1s ease' }} />
                    </div>
                    <div style={{ marginTop: 4, fontSize: 9, fontWeight: 600, color: scoreColor(d.score) }}>
                      {scoreLabel(d.score)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Ligne 3 : Tableau des règles ── */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px',
              border: '1px solid rgba(31,59,114,.08)', boxShadow: '0 2px 12px rgba(31,59,114,.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1F3B72',
                  letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Détail des règles ({sortedRules.length})
                </div>
                {/* Filtre source */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {['all', ...Array.from(new Set(data.rules.map(r => r.source)))].map(s => (
                    <button key={s} onClick={() => setFilter(s)}
                      style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', border: '1px solid',
                        borderColor: filter === s ? '#1F3B72' : 'rgba(31,59,114,.15)',
                        background: filter === s ? '#1F3B72' : 'transparent',
                        color: filter === s ? '#fff' : 'rgba(31,59,114,.5)' }}>
                      {s === 'all' ? 'Toutes' : s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mini bar chart pour les règles en échec */}
              {sortedRules.filter(r => r.score < 90).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', fontWeight: 600, marginBottom: 8 }}>
                    Règles à améliorer (score &lt; 90)
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart
                      data={sortedRules.filter(r => r.score < 90).slice(0, 8)
                        .map(r => ({ name: r.label.slice(0, 30) + (r.label.length > 30 ? '…' : ''), score: r.score }))}
                      layout="vertical" margin={{ left: 0, right: 40 }}>
                      <XAxis type="number" domain={[0, 100]} hide />
                      <YAxis type="category" dataKey="name" width={240}
                        tick={{ fontSize: 9, fill: 'rgba(31,59,114,.6)' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: unknown) => [`${v}%`, 'Score']}
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid rgba(31,59,114,.1)' }} />
                      <Bar dataKey="score" barSize={10} radius={[0, 4, 4, 0]}>
                        {sortedRules.filter(r => r.score < 90).slice(0, 8).map((r, i) => (
                          <Cell key={i} fill={scoreColor(r.score)} fillOpacity={.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(31,59,114,.08)' }}>
                      {['Règle', 'Source', 'Dimension', 'Score', 'Total', 'KO', 'Statut'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left',
                          fontSize: 9, fontWeight: 800, letterSpacing: '.1em',
                          textTransform: 'uppercase', color: 'rgba(31,59,114,.4)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRules.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(31,59,114,.04)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(31,59,114,.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '10px 12px', color: '#1F3B72', fontWeight: 500 }}>{r.label}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: 'rgba(31,59,114,.06)', borderRadius: 6,
                            padding: '2px 8px', fontSize: 10, fontWeight: 700, color: '#1F3B72' }}>
                            {r.source}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: `${DIM_COLORS[r.dimension] ?? '#1F3B72'}18`,
                            borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700,
                            color: DIM_COLORS[r.dimension] ?? '#1F3B72' }}>
                            {r.dimension.charAt(0).toUpperCase() + r.dimension.slice(1)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 60, height: 5, background: 'rgba(31,59,114,.08)', borderRadius: 4 }}>
                              <div style={{ height: '100%', borderRadius: 4, width: `${r.score}%`,
                                background: scoreColor(r.score) }} />
                            </div>
                            <span style={{ fontWeight: 700, color: scoreColor(r.score), fontSize: 12 }}>
                              {r.score}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'rgba(31,59,114,.5)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {r.nb_total.toLocaleString('fr-FR')}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600,
                          color: r.nb_ko > 0 ? '#DC2626' : '#059669', fontVariantNumeric: 'tabular-nums' }}>
                          {r.nb_ko.toLocaleString('fr-FR')}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                            color: scoreColor(r.score), fontSize: 10, fontWeight: 700 }}>
                            {scoreIcon(r.score)} {scoreLabel(r.score)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Erreurs éventuelles */}
              {data._errors.length > 0 && (
                <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(220,38,38,.05)', border: '1px solid rgba(220,38,38,.15)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', marginBottom: 4 }}>
                    {data._errors.length} source(s) en erreur
                  </div>
                  {data._errors.map((e, i) => (
                    <div key={i} style={{ fontSize: 10, color: '#DC2626', opacity: .7 }}>{e}</div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </>
  )
}
