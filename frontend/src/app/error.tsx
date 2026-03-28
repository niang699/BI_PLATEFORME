'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #060e1f 0%, #0b1830 100%)',
      color: 'white', fontFamily: 'Inter, sans-serif', gap: 16,
    }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>Une erreur est survenue</h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', maxWidth: 400, textAlign: 'center' }}>
        {error.message || 'Erreur inattendue. Veuillez réessayer.'}
      </p>
      <button onClick={reset} style={{
        marginTop: 8, padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg, #96C11E, #7aa018)', color: '#060e1f',
        fontWeight: 700, fontSize: 13,
      }}>
        Réessayer
      </button>
    </div>
  )
}
