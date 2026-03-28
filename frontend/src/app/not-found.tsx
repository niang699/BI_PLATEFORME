import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #060e1f 0%, #0b1830 100%)',
      color: 'white', fontFamily: 'Inter, sans-serif', gap: 16,
    }}>
      <div style={{ fontSize: 64, fontWeight: 800, color: 'rgba(150,193,30,.4)' }}>404</div>
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>Page introuvable</h2>
      <Link href="/dashboard" style={{
        marginTop: 8, padding: '10px 24px', borderRadius: 10,
        background: 'linear-gradient(135deg, #96C11E, #7aa018)', color: '#060e1f',
        fontWeight: 700, fontSize: 13, textDecoration: 'none',
      }}>
        Retour à l&#x27;accueil
      </Link>
    </div>
  )
}
