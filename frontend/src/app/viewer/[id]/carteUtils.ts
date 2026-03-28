/**
 * Utilitaires partagés carte — importables côté serveur (pas de Leaflet ici)
 */

const C_NAVY   = '#1F3B72'
const C_GREEN  = '#96C11E'
const C_ORANGE = '#d97706'
const C_CYAN   = '#0891b2'
const C_PURPLE = '#7c3aed'
const C_GRAY   = '#64748b'

export const PROFIL_CATS = [
  { key: 'particulier', label: 'Particuliers',         color: C_NAVY,   match: (p: string) => p.toLowerCase().includes('particulier') },
  { key: 'commerce',    label: 'Industrie & Commerce', color: C_ORANGE, match: (p: string) => /entreprise|usine|hotel|restaurant|boulangerie|pharmacie|chantier|banque|clinique|industrie/i.test(p) },
  { key: 'institution', label: 'Institutions',         color: C_GREEN,  match: (p: string) => /hôpital|hopital|école|ecole|université|universite|bâtiment|batiment|ambassade|organisation|municipal|administratif|parc|marché/i.test(p) },
  { key: 'eau',         label: 'Bornes & Points eau',  color: C_CYAN,   match: (p: string) => /borne|bouche|edicule|potence|marai/i.test(p) },
  { key: 'personnel',   label: 'Personnel interne',    color: C_PURPLE, match: (p: string) => /cadre|employé|retraite|local|membre|expatrie|fermier|onas|sones/i.test(p) },
]

export function profilColor(profil: string): string {
  for (const cat of PROFIL_CATS) if (cat.match(profil)) return cat.color
  return C_GRAY
}

export function secteurColor(taux: number | undefined): string {
  if (!taux || taux === 0) return C_NAVY
  if (taux >= 98.5) return '#22c55e'
  if (taux >= 95)   return '#ca8a04'
  if (taux >= 90)   return C_ORANGE
  return '#dc2626'
}
