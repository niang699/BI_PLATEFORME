'use client'
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html>
      <body style={{
        margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#060e1f', color: 'white', fontFamily: 'Inter, sans-serif', gap: 16,
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Erreur critique</h2>
        <button onClick={reset} style={{
          padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: '#96C11E', color: '#060e1f', fontWeight: 700, fontSize: 13,
        }}>
          Réessayer
        </button>
      </body>
    </html>
  )
}
