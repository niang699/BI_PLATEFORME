/**
 * Design tokens partagés — Portail BI SEN'EAU
 * Importer dans chaque page pour garantir la cohérence inter-pages.
 */

/* ── Couleurs ──────────────────────────────────────────────────────────────── */
export const C_NAVY    = '#1F3B72'
export const C_GREEN   = '#96C11E'
export const C_RED     = '#E84040'
export const C_PAGE    = '#f8fafc'   // fond de toutes les pages dashboard
export const C_CARD    = '#ffffff'
export const C_BORDER  = '#eef1f8'   // séparateurs internes légers (tables…)
export const C_MUTED   = 'rgba(31,59,114,.45)'
export const C_FAINT   = 'rgba(31,59,114,.28)'

/* ── Typographie ───────────────────────────────────────────────────────────── */
export const F_TITLE = "'Barlow Semi Condensed', sans-serif"
export const F_BODY  = "'Nunito', sans-serif"

/* ── Cards ─────────────────────────────────────────────────────────────────── */
/** Carte flottante standard — aucune bordure */
export const cardStyle = {
  background   : C_CARD,
  borderRadius : 14,
  boxShadow    : '0 2px 10px rgba(31,59,114,.10)',
} as const

/** Carte au survol — ombre plus profonde */
export const cardHoverShadow = '0 6px 24px rgba(31,59,114,.14)'

/* ── Hero (bandeau blanc en haut de page, style Gouvernance) ──────────────── */
export const heroStyle = {
  background : C_CARD,
  padding    : '28px 32px 0',
  boxShadow  : '0 1px 0 rgba(31,59,114,.08)',
} as const

/* ── Icon box (carré coloré 44×44 dans les headers) ───────────────────────── */
export function iconBox(color: string): React.CSSProperties {
  return {
    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
    background: `${color}14`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}

/* ── Badge pill (statut, rôle…) ────────────────────────────────────────────── */
export function pillStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '4px 12px', borderRadius: 20,
    fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' as const,
    background: `${color}14`, color,
  }
}

/* ── Tabs underline (style Gouvernance) ────────────────────────────────────── */
export function tabStyle(active: boolean, color = C_NAVY): React.CSSProperties {
  return {
    padding: '9px 20px', border: 'none', outline: 'none',
    borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
    borderRadius: 0, background: 'transparent',
    color: active ? color : C_MUTED,
    fontSize: 11.5, fontWeight: active ? 700 : 500,
    cursor: 'pointer', transition: 'all .18s',
    display: 'flex', alignItems: 'center', gap: 6,
    letterSpacing: '.01em', whiteSpace: 'nowrap' as const,
    fontFamily: F_BODY,
  }
}

/* ── Input / Select sans bordure ───────────────────────────────────────────── */
export const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10, border: 'none',
  fontSize: 13, fontFamily: F_BODY, color: C_NAVY,
  background: '#f0f4fb', outline: 'none', width: '100%',
}

/* ── Bouton primaire ───────────────────────────────────────────────────────── */
export const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 20px', borderRadius: 10, border: 'none',
  background: C_NAVY, color: '#fff',
  fontSize: 12, fontWeight: 700, fontFamily: F_BODY,
  cursor: 'pointer',
}

/* ── Bouton ghost ──────────────────────────────────────────────────────────── */
export const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 20px', borderRadius: 10, border: 'none',
  background: '#f0f4fb', color: C_NAVY,
  fontSize: 12, fontWeight: 700, fontFamily: F_BODY,
  cursor: 'pointer',
}

/* ── Table header / cell ───────────────────────────────────────────────────── */
export const TH: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: C_FAINT,
  letterSpacing: '.06em', textTransform: 'uppercase',
  padding: '12px 18px', textAlign: 'left',
  background: '#f7f9fd', fontFamily: F_BODY, whiteSpace: 'nowrap',
}

export const TD: React.CSSProperties = {
  padding: '12px 18px', borderBottom: `1px solid ${C_BORDER}`,
  fontSize: 12, color: '#334155', fontFamily: F_BODY,
}

/* ── Focus ring (accessibilité) ────────────────────────────────────────────── */
export const focusRing: React.CSSProperties = {
  outline: `2px solid ${C_NAVY}`,
  outlineOffset: 2,
}
