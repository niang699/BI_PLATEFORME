'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/lib/auth'
import { DEMO_CREDENTIALS } from '@/lib/mockData'

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
    setLoading(true)
    setError('')
    setLocked(false)
    const result = await login(email, password)
    if (result && 'user' in result) {
      router.push('/dashboard')
    } else {
      const msg = result && 'error' in result ? result.error : 'Erreur de connexion.'
      const isLocked = result && 'reason' in result && result.reason === 'locked'
      setError(msg)
      setLocked(!!isLocked)
      setLoading(false)
    }
  }

  const quickLogin = (cred: typeof DEMO_CREDENTIALS[0]) => {
    setEmail(cred.email)
    setPassword(cred.password)
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:"'Nunito',sans-serif" }}>

      {/* ══════════════════════════════════════════
          GAUCHE — Formulaire
      ══════════════════════════════════════════ */}
      <div style={{
        flex:'0 0 45%', background:'#f8fafc',
        display:'flex', flexDirection:'column',
        padding:'32px 48px',
        position:'relative',
      }}>

        {/* Logo top-left */}
        <div style={{
          background:'#fff', borderRadius:10, padding:'8px 14px',
          display:'inline-flex', alignItems:'center',
          boxShadow:'0 2px 12px rgba(31,59,114,.12)',
          alignSelf:'flex-start', marginBottom:'auto',
        }}>
          <img src="/logo_seneau.png" alt="SEN'EAU" style={{ height:32, objectFit:'contain' }} />
        </div>

        {/* Formulaire centré verticalement */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', maxWidth:380, margin:'0 auto', width:'100%' }}>

          {/* Icône + titre */}
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <div style={{
              width:52, height:52, borderRadius:14, margin:'0 auto 16px',
              background:'linear-gradient(135deg,#1F3B72,#2B50A0)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 6px 20px rgba(31,59,114,.22)', fontSize:24,
            }}>🛡️</div>
            <h2 style={{ fontFamily:"'Barlow Semi Condensed',sans-serif", fontSize:26, fontWeight:800, color:'#1F3B72', marginBottom:6, letterSpacing:'-.01em' }}>
              Bienvenue
            </h2>
            <p style={{ fontSize:13, color:'rgba(31,59,114,.5)', fontWeight:500 }}>
              Connectez-vous à votre espace de travail
            </p>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:8, marginTop:12,
              background:'rgba(31,59,114,.06)', borderRadius:99,
              padding:'5px 14px',
            }}>
              <span style={{ fontSize:11, fontWeight:800, color:'#1F3B72', letterSpacing:'.04em' }}>BI</span>
              <span style={{ fontSize:11, color:'rgba(31,59,114,.5)', fontWeight:500 }}>Plateforme IA & Gouvernance</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Email */}
            <div>
              <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'rgba(31,59,114,.6)', marginBottom:7, letterSpacing:'.04em', textTransform:'uppercase' }}>
                Identifiant
              </label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'rgba(31,59,114,.3)' }}>👤</span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="prenom.nom@seneau.sn"
                  required
                  style={{
                    width:'100%', boxSizing:'border-box',
                    padding:'13px 14px 13px 42px',
                    background:'#fff', border:'1.5px solid #e2e8f0',
                    borderRadius:12, fontSize:13.5, color:'#1e293b',
                    outline:'none', transition:'border-color .18s, box-shadow .18s',
                    fontFamily:"'Nunito',sans-serif",
                  }}
                  onFocus={e => { e.target.style.borderColor='#1F3B72'; e.target.style.boxShadow='0 0 0 3px rgba(31,59,114,.08)' }}
                  onBlur={e  => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none' }}
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                <label style={{ fontSize:11.5, fontWeight:700, color:'rgba(31,59,114,.6)', letterSpacing:'.04em', textTransform:'uppercase' }}>
                  Mot de passe
                </label>
                <span style={{ fontSize:11.5, color:'#1F3B72', fontWeight:600, cursor:'pointer', opacity:.7 }}>
                  Mot de passe oublié ?
                </span>
              </div>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'rgba(31,59,114,.3)' }}>🔒</span>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width:'100%', boxSizing:'border-box',
                    padding:'13px 44px 13px 42px',
                    background:'#fff', border:'1.5px solid #e2e8f0',
                    borderRadius:12, fontSize:13.5, color:'#1e293b',
                    outline:'none', transition:'border-color .18s, box-shadow .18s',
                    fontFamily:"'Nunito',sans-serif",
                  }}
                  onFocus={e => { e.target.style.borderColor='#1F3B72'; e.target.style.boxShadow='0 0 0 3px rgba(31,59,114,.08)' }}
                  onBlur={e  => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none' }}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} style={{
                  position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', fontSize:15,
                  color:'rgba(31,59,114,.3)', padding:0, outline:'none',
                }}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Erreur */}
            {error && (
              <div style={{
                background: locked ? '#fff7ed' : '#fef2f2',
                border: `1px solid ${locked ? '#fed7aa' : '#fecaca'}`,
                borderRadius:10, padding:'12px 14px',
                fontSize:12.5, color: locked ? '#c2410c' : '#b91c1c', fontWeight:600,
                display:'flex', alignItems:'flex-start', gap:8,
              }}>
                <span style={{ fontSize:16, flexShrink:0 }}>{locked ? '🔒' : '⚠️'}</span>
                <span>{error}</span>
              </div>
            )}

            {/* Bouton connexion */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width:'100%', padding:'14px',
                background: loading ? '#94a3b8' : 'linear-gradient(135deg,#1F3B72,#2B50A0)',
                border:'none', borderRadius:12, outline:'none',
                color:'#fff', fontSize:14, fontWeight:700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow: loading ? 'none' : '0 4px 18px rgba(31,59,114,.30)',
                transition:'all .2s', marginTop:4,
                fontFamily:"'Barlow Semi Condensed',sans-serif", letterSpacing:'.03em',
              }}
              onMouseEnter={e => { if(!loading)(e.currentTarget as HTMLButtonElement).style.transform='translateY(-1px)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform='none' }}
            >
              {loading ? (
                <>
                  <span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 1s linear infinite', display:'inline-block' }} />
                  Connexion en cours…
                </>
              ) : 'Se connecter →'}
            </button>
          </form>

          {/* Comptes démo */}
          <div style={{ marginTop:24, paddingTop:20, borderTop:'1px solid #e2e8f0' }}>
            <p style={{ fontSize:10.5, fontWeight:700, color:'rgba(31,59,114,.35)', textAlign:'center', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:10 }}>
              Comptes de démonstration
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {DEMO_CREDENTIALS.map(cred => (
                <button key={cred.email} onClick={() => quickLogin(cred)} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'9px 14px', borderRadius:10, border:'1px solid #e2e8f0',
                  background:'#fff', cursor:'pointer', outline:'none',
                  transition:'all .15s', textAlign:'left',
                }}
                onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background='#f0f6ff'; b.style.borderColor='rgba(31,59,114,.2)' }}
                onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background='#fff'; b.style.borderColor='#e2e8f0' }}
                >
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#1F3B72' }}>{cred.role}</div>
                    <div style={{ fontSize:11, color:'rgba(31,59,114,.4)', marginTop:1 }}>{cred.email}</div>
                  </div>
                  <span style={{ fontSize:11, color:'#96C11E', fontWeight:700 }}>Remplir →</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign:'center', fontSize:11, color:'rgba(31,59,114,.3)', fontWeight:500, marginTop:'auto', paddingTop:16 }}>
          © 2025 SEN&#x27;EAU &nbsp;·&nbsp; Conçu par <strong style={{ color:'rgba(31,59,114,.5)' }}>Asta Niang</strong> — Data Engineer
        </p>
      </div>

      {/* ══════════════════════════════════════════
          DROITE — Branding & description
      ══════════════════════════════════════════ */}
      <div style={{
        flex:1,
        background:'linear-gradient(145deg,#0f2456 0%,#1F3B72 45%,#163060 100%)',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        padding:'48px 56px', position:'relative', overflow:'hidden',
      }}>

        {/* Décorations */}
        <div style={{ position:'absolute', top:-80, right:-80, width:320, height:320, borderRadius:'50%', background:'rgba(150,193,30,.06)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-60, left:-60, width:240, height:240, borderRadius:'50%', background:'rgba(255,255,255,.04)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:'30%', right:'15%', width:120, height:120, borderRadius:'50%', background:'rgba(150,193,30,.04)', pointerEvents:'none' }} />

        {/* Logo card */}
        <div style={{
          background:'rgba(255,255,255,.96)', borderRadius:20,
          padding:'16px 28px', marginBottom:32,
          boxShadow:'0 8px 32px rgba(0,0,0,.25)',
        }}>
          <img src="/logo_seneau.png" alt="SEN'EAU" style={{ height:44, objectFit:'contain', display:'block' }} />
        </div>

        {/* Titre + badge */}
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:7, marginBottom:14,
            background:'rgba(150,193,30,.18)', borderRadius:99,
            padding:'5px 16px', border:'1px solid rgba(150,193,30,.30)',
          }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#96C11E', display:'inline-block', boxShadow:'0 0 0 3px rgba(150,193,30,.25)' }} />
            <span style={{ fontSize:11, fontWeight:700, color:'#b8e05a', letterSpacing:'.08em', textTransform:'uppercase' }}>BI Platform</span>
          </div>
          <h1 style={{
            fontFamily:"'Barlow Semi Condensed',sans-serif",
            fontSize:32, fontWeight:900, color:'#fff',
            lineHeight:1.1, letterSpacing:'-.02em', marginBottom:10,
          }}>
            Plateforme BI<br />
            <span style={{ color:'#96C11E' }}>SEN&#x27;EAU</span>
          </h1>
          <p style={{ fontSize:15, color:'rgba(255,255,255,.75)', fontWeight:600, marginBottom:16 }}>
            Intelligence Artificielle &amp; Gouvernance des Données
          </p>
          <p style={{ fontSize:13, color:'rgba(255,255,255,.45)', lineHeight:1.7, maxWidth:380, fontWeight:400 }}>
            Exploitez la puissance de vos données, maîtrisez vos indicateurs de performance
            et pilotez l&#x27;activité de SEN&#x27;EAU en temps réel grâce à des outils analytiques
            avancés et une IA spécialisée.
          </p>
        </div>

        {/* Features */}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center', marginTop:8 }}>
          {[
            { icon:'jambar', label:'IA Analytique' },
            { icon:'📊',     label:'Reporting' },
            { icon:'⬡',      label:'Gouvernance' },
            { icon:'🔒',     label:'Sécurisé' },
          ].map(f => (
            <div key={f.label} style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:6,
              background:'rgba(255,255,255,.07)', borderRadius:14,
              padding:'12px 18px', border:'1px solid rgba(255,255,255,.10)',
              minWidth:72,
            }}>
              {f.icon === 'jambar' ? (
                <img src="/jambar_ia_simple_icon.svg" alt="JAMBAR" style={{ width:28, height:28, objectFit:'cover', objectPosition:'center 30%', filter:'drop-shadow(0 2px 6px rgba(150,193,30,.4))' }} />
              ) : (
                <span style={{ fontSize:20 }}>{f.icon}</span>
              )}
              <span style={{ fontSize:10.5, color:'rgba(255,255,255,.55)', fontWeight:700, letterSpacing:'.04em' }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}
