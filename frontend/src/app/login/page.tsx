'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/lib/auth'
import { DEMO_CREDENTIALS } from '@/lib/mockData'
import { BarChart2, BrainCircuit, ShieldCheck, BellDot, Eye, EyeOff, Lock, AlertTriangle, type LucideIcon } from 'lucide-react'

const F_TITLE = "'Barlow Semi Condensed', sans-serif"
const F_BODY  = "'Nunito', sans-serif"
const C_NAVY  = '#1F3B72'
const C_GREEN = '#96C11E'

const FEATURES: { Icon: LucideIcon; color: string; bg: string; title: string; desc: string }[] = [
  {
    Icon: BarChart2,
    color: C_NAVY, bg: 'rgba(31,59,114,.08)',
    title: 'Reporting Temps Réel',
    desc: 'CA, recouvrement, prises non facturées — données actualisées en continu sur toutes vos DRs.',
  },
  {
    Icon: BrainCircuit,
    color: C_GREEN, bg: 'rgba(150,193,30,.10)',
    title: 'IA JAMBAR',
    desc: 'Assistant analytique intelligent qui répond à vos questions métier et génère des insights automatiques.',
  },
  {
    Icon: ShieldCheck,
    color: '#2B50A0', bg: 'rgba(43,80,160,.08)',
    title: 'Data Gouvernance',
    desc: 'Qualité des données, catalogue métier, traçabilité et contrôle des accès par rôle.',
  },
  {
    Icon: BellDot,
    color: '#d97706', bg: 'rgba(217,119,6,.08)',
    title: 'Alertes & Actions',
    desc: 'Détection proactive des anomalies avec notifications ciblées et rapports planifiés par email.',
  },
]


export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState('')
  const [locked,   setLocked]   = useState(false)
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setLocked(false)
    const result = await login(email, password)
    if (result && 'user' in result) {
      router.push('/dashboard')
    } else {
      const msg = result && 'error' in result ? result.error : 'Erreur de connexion.'
      const isLocked = result && 'reason' in result && result.reason === 'locked'
      setError(msg); setLocked(!!isLocked); setLoading(false)
    }
  }

  const quickLogin = (cred: typeof DEMO_CREDENTIALS[0]) => {
    setEmail(cred.email); setPassword(cred.password)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: F_BODY, background: '#f4f7fb' }}>

      <style>{`
        @keyframes spin-login { to { transform: rotate(360deg); } }
        @keyframes float-up { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes pulse-green { 0%,100% { box-shadow: 0 0 0 0 rgba(150,193,30,.4); } 50% { box-shadow: 0 0 0 8px rgba(150,193,30,0); } }
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(31,59,114,.3); }
      `}</style>

      {/* ══════════════════════════════════════════════════════
          GAUCHE — Branding & pitch plateforme
      ══════════════════════════════════════════════════════ */}
      <div style={{
        flex: '0 0 58%',
        background: 'linear-gradient(150deg, #eef3ff 0%, #f0f8e8 55%, #f4f7fb 100%)',
        display: 'flex', flexDirection: 'column',
        padding: '48px 56px',
        position: 'relative', overflow: 'hidden',
      }}>

        {/* Décorations de fond */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(150,193,30,.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(31,59,114,.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', left: '60%', width: 180, height: 180, borderRadius: '50%', background: 'rgba(150,193,30,.05)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '8px 16px', boxShadow: '0 2px 16px rgba(31,59,114,.10)', display: 'inline-flex' }}>
            <img src="/logo_seneau.png" alt="SEN'EAU" style={{ height: 30, objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(150,193,30,.12)', border: '1px solid rgba(150,193,30,.25)', borderRadius: 99, padding: '4px 12px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C_GREEN, display: 'inline-block', animation: 'pulse-green 2s infinite' }} />
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#4a7c10', letterSpacing: '.06em', textTransform: 'uppercase' }}>Portail Data</span>
          </div>
        </div>

        {/* Headline principale */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 560 }}>

          <div style={{ marginBottom: 32 }}>
            <h1 style={{
              fontFamily: F_TITLE, fontSize: 48, fontWeight: 900, color: C_NAVY,
              lineHeight: 1.05, letterSpacing: '-.02em', marginBottom: 6,
            }}>
              Pilotez.<br />
              Analysez.<br />
              <span style={{ color: C_GREEN }}>Décidez.</span>
            </h1>
            <div style={{ width: 48, height: 4, borderRadius: 99, background: C_GREEN, marginTop: 16, marginBottom: 22 }} />
            <p style={{ fontSize: 15.5, color: 'rgba(31,59,114,.62)', lineHeight: 1.85, fontWeight: 500, maxWidth: 470, marginBottom: 24 }}>
              La plateforme de{' '}
              <strong style={{ color: C_NAVY, fontWeight: 800 }}>Business Intelligence nouvelle génération</strong>{' '}
              de SEN&apos;EAU — centralisez vos données, automatisez vos rapports et exploitez
              l&apos;intelligence artificielle pour chaque décision stratégique.
            </p>
          </div>

          {/* Features grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background: '#fff', borderRadius: 16, padding: '16px 18px',
                border: '1px solid #e8edf5',
                boxShadow: '0 2px 12px rgba(31,59,114,.06)',
                transition: 'transform .2s, box-shadow .2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <f.Icon size={16} color={f.color} strokeWidth={2.2} />
                  </div>
                  <span style={{ fontFamily: F_TITLE, fontSize: 14, fontWeight: 800, color: C_NAVY }}>{f.title}</span>
                </div>
                <p style={{ fontSize: 11.5, color: 'rgba(31,59,114,.5)', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>{f.desc}</p>
              </div>
            ))}
          </div>

        </div>

        {/* Témoignage */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: '20px 24px',
          border: '1px solid #e8edf5', boxShadow: '0 2px 16px rgba(31,59,114,.06)',
          marginTop: 8,
        }}>
          <p style={{ fontSize: 13.5, color: 'rgba(31,59,114,.7)', lineHeight: 1.75, fontStyle: 'italic', fontWeight: 500, margin: '0 0 14px' }}>
            &ldquo;Grâce au portail, j&apos;ai mes indicateurs de recouvrement à jour sans attendre le rapport mensuel. Un gain de temps considérable pour toute mon équipe.&rdquo;
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${C_NAVY}, #2B50A0)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: F_TITLE,
            }}>MF</div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: C_NAVY, fontFamily: F_TITLE }}>Mamadou Fall</div>
              <div style={{ fontSize: 11, color: 'rgba(31,59,114,.4)', fontWeight: 500 }}>Directeur Régional — DR Centre</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
              {[1,2,3,4,5].map(i => <span key={i} style={{ color: C_GREEN, fontSize: 13 }}>★</span>)}
            </div>
          </div>
        </div>

        {/* Footer gauche */}
        <p style={{ fontSize: 11, color: 'rgba(31,59,114,.3)', fontWeight: 500, marginTop: 24 }}>
          © 2025 SEN&apos;EAU &nbsp;·&nbsp; Conçu par <strong style={{ color: 'rgba(31,59,114,.5)' }}>Asta Niang</strong> — Data Engineer
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════
          DROITE — Formulaire de connexion
      ══════════════════════════════════════════════════════ */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 40px',
        background: '#fff',
        borderLeft: '1px solid #e8edf5',
        boxShadow: '-4px 0 32px rgba(31,59,114,.06)',
      }}>

        {/* Card formulaire */}
        <div style={{ width: '100%', maxWidth: 360 }}>

          {/* En-tête */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18, margin: '0 auto 16px',
              background: `linear-gradient(135deg, ${C_NAVY}, #2B50A0)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(31,59,114,.25)',
              animation: 'float-up 3s ease-in-out infinite',
            }}>
              <img src="/logo_seneau.png" alt="" style={{ height: 32, objectFit: 'contain', filter: 'brightness(10)' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextSibling as HTMLElement).style.display = 'block' }}
              />
              <span style={{ display: 'none' }}><ShieldCheck size={24} color="#fff" /></span>
            </div>
            <h2 style={{ fontFamily: F_TITLE, fontSize: 26, fontWeight: 900, color: C_NAVY, marginBottom: 6, letterSpacing: '-.01em' }}>
              Connexion
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(31,59,114,.45)', fontWeight: 500 }}>
              Accédez à votre espace de travail
            </p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(31,59,114,.5)', marginBottom: 7, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                Identifiant
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="prenom.nom@seneau.sn"
                required
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  background: '#f8fafc', border: '1.5px solid #e8edf5',
                  borderRadius: 12, fontSize: 13.5, color: C_NAVY,
                  outline: 'none', transition: 'all .18s',
                  fontFamily: F_BODY, fontWeight: 600,
                }}
                onFocus={e => { e.target.style.borderColor = C_NAVY; e.target.style.background = '#fff'; e.target.style.boxShadow = `0 0 0 3px rgba(31,59,114,.08)` }}
                onBlur={e  => { e.target.style.borderColor = '#e8edf5'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            {/* Mot de passe */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(31,59,114,.5)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Mot de passe
                </label>
                <span style={{ fontSize: 11.5, color: C_GREEN, fontWeight: 700, cursor: 'pointer' }}>
                  Mot de passe oublié ?
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '13px 44px 13px 16px',
                    background: '#f8fafc', border: '1.5px solid #e8edf5',
                    borderRadius: 12, fontSize: 13.5, color: C_NAVY,
                    outline: 'none', transition: 'all .18s',
                    fontFamily: F_BODY, fontWeight: 600,
                  }}
                  onFocus={e => { e.target.style.borderColor = C_NAVY; e.target.style.background = '#fff'; e.target.style.boxShadow = `0 0 0 3px rgba(31,59,114,.08)` }}
                  onBlur={e  => { e.target.style.borderColor = '#e8edf5'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none' }}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(31,59,114,.35)', padding: 0, outline: 'none',
                  fontSize: 16,
                }}>
                  {showPwd ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                </button>
              </div>
            </div>

            {/* Erreur */}
            {error && (
              <div style={{
                background: locked ? '#fff7ed' : 'rgba(232,64,64,.06)',
                border: `1px solid ${locked ? '#fed7aa' : 'rgba(232,64,64,.2)'}`,
                borderRadius: 10, padding: '11px 14px',
                fontSize: 12.5, color: locked ? '#c2410c' : '#E84040', fontWeight: 600,
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>{locked ? <Lock size={14} strokeWidth={2.2} /> : <AlertTriangle size={14} strokeWidth={2.2} />}</span>
                <span>{error}</span>
              </div>
            )}

            {/* Bouton connexion */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px',
                background: loading ? '#94a3b8' : `linear-gradient(135deg, ${C_NAVY}, #2B50A0)`,
                border: 'none', borderRadius: 12, outline: 'none',
                color: '#fff', fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: loading ? 'none' : '0 6px 20px rgba(31,59,114,.28)',
                transition: 'all .2s', marginTop: 4,
                fontFamily: F_TITLE, letterSpacing: '.04em', fontSize: 15,
              }}
              onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 10px 28px rgba(31,59,114,.36)' } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = loading ? 'none' : '0 6px 20px rgba(31,59,114,.28)' }}
            >
              {loading ? (
                <>
                  <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin-login 0.8s linear infinite', display: 'inline-block' }} />
                  Connexion en cours…
                </>
              ) : 'Se connecter →'}
            </button>
          </form>

          {/* Comptes démo */}
          <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: 'rgba(31,59,114,.3)', textAlign: 'center', letterSpacing: '.10em', textTransform: 'uppercase', marginBottom: 12 }}>
              Comptes de démonstration
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DEMO_CREDENTIALS.map(cred => (
                <button key={cred.email} onClick={() => quickLogin(cred)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 14px', borderRadius: 10, border: '1.5px solid #f1f5f9',
                  background: '#f8fafc', cursor: 'pointer', outline: 'none',
                  transition: 'all .15s', textAlign: 'left',
                }}
                onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#eef3ff'; b.style.borderColor = 'rgba(31,59,114,.15)' }}
                onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#f8fafc'; b.style.borderColor = '#f1f5f9' }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C_NAVY, fontFamily: F_BODY }}>{cred.role}</div>
                    <div style={{ fontSize: 10.5, color: 'rgba(31,59,114,.4)', marginTop: 1 }}>{cred.email}</div>
                  </div>
                  <span style={{ fontSize: 11, color: C_GREEN, fontWeight: 800 }}>Utiliser →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
