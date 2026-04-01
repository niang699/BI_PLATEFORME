'use client'
import { useParams, useRouter } from 'next/navigation'
import { REPORTS } from '@/lib/mockData'
import { useState, useEffect } from 'react'
import { Inbox, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react'
import TopBar from '@/components/TopBar'
import RapportSenODS from './RapportSenODS'
import RapportRecouvrementDT from './RapportRecouvrementDT'
import RapportCarteClients   from './RapportCarteClients'
import RapportPrises         from './RapportPrises'
import RapportRH             from './RapportRH'

const DASH_BASE = process.env.NEXT_PUBLIC_DASH_URL || 'http://localhost:8050'

const ID_TO_PATH: Record<string, string> = {
  'facturation':    '/',
  'score360':       '/score360',
  'suivi-releveur': '/releveur',
  'carte-clients':  '/carte',
  // Rapports RH
  'rh-dashboard':   '/rh/dashboard',
  'rh-effectif':    '/rh/effectif',
  'rh-salaire':     '/rh/salaire',
  'rh-hs':          '/rh/hs',
  'rh-formation':   '/rh/formation',
}

const F_TITLE = "'Barlow Semi Condensed', sans-serif"
const F_BODY  = "'Nunito', sans-serif"
const C_NAVY  = '#1F3B72'

const STATUS_CFG = {
  live:   { label: 'En direct', color: '#059669', bg: 'rgba(5,150,105,.10)',  dot: '#059669' },
  recent: { label: 'Récent',    color: '#d97706', bg: 'rgba(217,119,6,.10)',  dot: '#d97706' },
  stale:  { label: '> 24h',     color: '#E84040', bg: 'rgba(232,64,64,.10)',  dot: '#E84040' },
}

/* ── Page introuvable ──────────────────────────────────────────────────── */
function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', fontFamily: F_BODY,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Inbox size={56} color="rgba(31,59,114,.18)" strokeWidth={1.5} />
        </div>
        <h2 style={{ fontFamily: F_TITLE, fontSize: 22, fontWeight: 800, color: C_NAVY, marginBottom: 8 }}>
          Rapport introuvable
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(31,59,114,.45)', marginBottom: 24 }}>
          Cet identifiant ne correspond à aucun rapport enregistré.
        </p>
        <button onClick={onBack} style={{
          padding: '9px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#1F3B72,#2B50A0)',
          color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: F_BODY,
          boxShadow: '0 3px 12px rgba(31,59,114,.22)',
        }}>← Retour</button>
      </div>
    </div>
  )
}

/* ── État de chargement ────────────────────────────────────────────────── */
function LoadingState({ title }: { title: string }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#f8fafc', zIndex: 10,
      fontFamily: F_BODY,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', marginBottom: 18,
        border: '3px solid #e8edf5',
        borderTopColor: C_NAVY,
        animation: 'spin-viewer 0.9s linear infinite',
      }} />
      <div style={{ fontSize: 13, fontWeight: 700, color: C_NAVY, marginBottom: 4 }}>
        Chargement du rapport…
      </div>
      <div style={{ fontSize: 11, color: 'rgba(31,59,114,.4)', fontWeight: 500 }}>{title}</div>
    </div>
  )
}

/* ── État d'erreur ─────────────────────────────────────────────────────── */
function ErrorState({ title, url, onRetry }: { title: string; url: string; onRetry: () => void }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#f8fafc', zIndex: 10,
      fontFamily: F_BODY,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '40px 48px',
        boxShadow: '0 4px 24px rgba(31,59,114,.10)', textAlign: 'center', maxWidth: 460,
        border: '1px solid #e8edf5',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <AlertTriangle size={52} color="rgba(232,64,64,.35)" strokeWidth={1.5} />
        </div>
        <h3 style={{ fontFamily: F_TITLE, fontSize: 20, fontWeight: 800, color: C_NAVY, marginBottom: 8 }}>
          Dashboard non disponible
        </h3>
        <p style={{ fontSize: 13, color: 'rgba(31,59,114,.5)', lineHeight: 1.6, marginBottom: 6 }}>
          Le tableau de bord <strong style={{ color: C_NAVY }}>{title}</strong> n&apos;est pas accessible.
        </p>
        <p style={{ fontSize: 12, color: 'rgba(31,59,114,.38)', marginBottom: 24 }}>
          Vérifiez que le serveur tourne sur{' '}
          <code style={{ background: '#f4f6fb', padding: '2px 7px', borderRadius: 6, fontSize: 11, color: C_NAVY }}>
            {DASH_BASE}
          </code>
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onRetry} style={{
            padding: '9px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#1F3B72,#2B50A0)',
            color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: F_BODY,
            boxShadow: '0 3px 10px rgba(31,59,114,.22)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <RefreshCw size={12} />Réessayer
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{
            padding: '9px 22px', borderRadius: 10, textDecoration: 'none',
            background: '#f4f6fb', border: '1px solid #e8edf5',
            color: C_NAVY, fontSize: 12, fontWeight: 700, fontFamily: F_BODY,
          }}>Ouvrir directement →</a>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE VIEWER
══════════════════════════════════════════════════════════════════════════ */
export default function ViewerPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [error, setError]   = useState(false)

  const report    = REPORTS.find(r => r.id === id)
  const path      = ID_TO_PATH[id] || '/'
  const iframeUrl = `${DASH_BASE}${path}`

  useEffect(() => { setLoaded(false); setError(false) }, [id])

  if (!report) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <TopBar />
        <NotFound onBack={() => router.push('/dashboard/reports')} />
      </div>
    )
  }

  const status = STATUS_CFG[report.status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc' }}>

      <TopBar />

      {/* ── Barre navigation rapport ────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e8edf5',
        padding: '0 20px',
        height: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, fontFamily: F_BODY,
        boxShadow: '0 1px 4px rgba(31,59,114,.05)',
      }}>
        {/* Retour — revient à la liste filtrée par catégorie */}
        <button onClick={() => router.push(`/dashboard/reports?category=${report.category}`)} style={{
          display: 'flex', alignItems: 'center', gap: 5, background: 'none',
          border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 7,
          fontSize: 11, fontWeight: 700, color: 'rgba(31,59,114,.45)',
          fontFamily: F_BODY, transition: 'all .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background='#f4f6fb'; e.currentTarget.style.color=C_NAVY }}
        onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='rgba(31,59,114,.45)' }}>
          ← Retour
        </button>

        {/* Statut + plein écran */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 99,
            fontSize: 10, fontWeight: 700, fontFamily: F_BODY,
            background: status.bg, color: status.color,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: status.dot, flexShrink: 0,
              ...(report.status === 'live' ? { animation: 'pulse-dot 2s ease-in-out infinite' } : {}),
            }} />
            {status.label}
          </span>

          <a href={iframeUrl} target="_blank" rel="noopener noreferrer"
            title="Ouvrir en plein écran"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, textDecoration: 'none', background: '#f4f6fb', border: '1px solid #e8edf5', fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.45)', fontFamily: F_BODY, transition: 'all .15s' }}
            onMouseEnter={e => { const a = e.currentTarget; a.style.background='#eef2ff'; a.style.color=C_NAVY; a.style.borderColor='#E0E7FF' }}
            onMouseLeave={e => { const a = e.currentTarget; a.style.background='#f4f6fb'; a.style.color='rgba(31,59,114,.45)'; a.style.borderColor='#e8edf5' }}
          ><ExternalLink size={11} />Plein écran</a>
        </div>
      </div>

      {/* ── Zone contenu ───────────────────────────────────────────────── */}
      {id === 'facturation' ? (
        <RapportSenODS />
      ) : id === 'recouvrement-dt' ? (
        <RapportRecouvrementDT />
      ) : id === 'carte-clients' ? (
        <RapportCarteClients />
      ) : id === 'prises-facturation' ? (
        <RapportPrises />
      ) : id === 'rh-dashboard' || id === 'rh-effectif' || id === 'rh-salaire' || id === 'rh-hs' || id === 'rh-formation' ? (
        <RapportRH />
      ) : (
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!loaded && !error && <LoadingState title={report.title} />}
          {error && (
            <ErrorState
              title={report.title}
              url={iframeUrl}
              onRetry={() => { setError(false); setLoaded(false) }}
            />
          )}
          <iframe
            src={iframeUrl}
            style={{
              flex: 1, width: '100%', border: 'none',
              minHeight: 'calc(100vh - 104px)',
              display: error ? 'none' : 'block',
            }}
            onLoad={(e) => {
              try {
                // Si Chrome charge sa page d'erreur interne, on traite comme une erreur
                const loc = (e.target as HTMLIFrameElement).contentWindow?.location?.href ?? ''
                if (loc.startsWith('chrome-error://') || loc.startsWith('about:')) {
                  setError(true); return
                }
              } catch { /* cross-origin — normal si Dash tourne */ }
              setLoaded(true)
            }}
            onError={() => setError(true)}
            title={report.title}
            allow="fullscreen"
          />
        </div>
      )}

      <style>{`
        @keyframes spin-viewer {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: .5; transform: scale(.75); }
        }
      `}</style>
    </div>
  )
}
