'use client'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState, useCallback, useRef, Fragment, useMemo } from 'react'
import { AlertTriangle as AlertIcon } from 'lucide-react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet'
import type { Map as LMap } from 'leaflet'

/* ═══════════════════════════════ TYPES ════════════════════════════════════ */
export interface SecteurPoint {
  uo: string; code_uo: string; nb_total: number; nb_actif: number
  lat: number; lng: number; nb_tournees: number
  nb_sans_facture?: number        // clients sans aucune facture (toutes périodes, MV géo)
  nb_total_live?: number          // COUNT(*) live depuis API_CLIENT (même base que nb_avec_facture)
  nb_avec_facture?: number        // COUNT(*) PDI actifs ayant ≥1 facture dans la période (API_CLIENT ∩ pdi_fact)
  nb_sans_facture_filtre?: number // COUNT(*) PDI actifs sans aucune facture dans la période (API_CLIENT \ pdi_fact)
  nb_factures?: number; ca_total?: number; enc_total?: number
  imp_total?: number; taux_recouvrement?: number
}

export interface ClientPoint {
  id: string; ref: string; nom: string; prenom: string
  profil: string; uo: string; code_uo: string
  tournee: string; adresse: string; telephone: string
  compteur: string; diametre: string; lat: number; lng: number
}

interface BBox  { minLat: number; maxLat: number; minLng: number; maxLng: number }
interface Stats { nbVisible: number; capped: boolean; zoom: number }

interface CarteMapProps {
  secteurs:       SecteurPoint[]
  filtreUO:       string
  filtreProfil:   string
  onStatsUpdate:  (s: Stats) => void
  onSelectClient: (c: ClientPoint) => void
  focusLatLng?:   [number, number] | null   // déclenche flyTo
}

/* ═══════════════════════════════ CONSTANTES ═══════════════════════════════ */
const SENEGAL_CENTER: [number, number] = [14.5, -14.4]
const ZOOM_INITIAL   = 7
const ZOOM_THRESHOLD = 13
const MAX_POINTS     = 2000

/* Couleurs vives pour les points individuels sur fond sombre */
const C_POINT_BLUE   = '#60a5fa'   // particuliers
const C_POINT_AMBER  = '#fbbf24'   // industrie & commerce
const C_POINT_GREEN  = '#a3e635'   // institutions
const C_POINT_CYAN   = '#22d3ee'   // bornes & points eau
const C_POINT_PURPLE = '#c084fc'   // personnel interne
const C_POINT_GRAY   = '#94a3b8'   // autres

/* Couleurs optimisées selon le fond de carte */
function secteurColorAdapt(taux: number | undefined, dark: boolean): string {
  if (dark) {
    // Couleurs vives sur fond sombre
    if (!taux || taux === 0) return '#60a5fa'
    if (taux >= 98.5) return '#4ade80'
    if (taux >= 95)   return '#fbbf24'
    if (taux >= 90)   return '#fb923c'
    return '#f87171'
  } else {
    // Couleurs saturées sur fond clair
    if (!taux || taux === 0) return '#1F3B72'
    if (taux >= 98.5) return '#22c55e'
    if (taux >= 95)   return '#ca8a04'
    if (taux >= 90)   return '#d97706'
    return '#dc2626'
  }
}

/* ═══════════════════════════════ HELPERS ══════════════════════════════════ */
export { PROFIL_CATS, profilColor, secteurColor } from './carteUtils'

/* Variantes vives pour fond sombre (map Carto Dark) */
export function profilColorDark(profil: string | null | undefined): string {
  const p = (profil ?? '').toLowerCase()
  if (p.includes('particulier')) return C_POINT_BLUE
  if (/entreprise|usine|hotel|restaurant|boulangerie|pharmacie|chantier|banque|clinique|industrie/i.test(p)) return C_POINT_AMBER
  if (/hôpital|hopital|école|ecole|université|universite|bâtiment|batiment|ambassade|organisation|municipal|administratif|parc|marché/i.test(p)) return C_POINT_GREEN
  if (/borne|bouche|edicule|potence|marai/i.test(p)) return C_POINT_CYAN
  if (/cadre|employé|retraite|local|membre|expatrie|fermier|onas|sones/i.test(p)) return C_POINT_PURPLE
  return C_POINT_GRAY
}


function getBbox(map: LMap): BBox {
  const b = map.getBounds()
  return { minLat: b.getSouth(), maxLat: b.getNorth(), minLng: b.getWest(), maxLng: b.getEast() }
}

function sectorRadius(nb: number, maxNb: number): number {
  return Math.max(10, Math.min(58, (Math.sqrt(nb) / Math.sqrt(maxNb)) * 55 + 8))
}

function fmtN(v: number) { return v.toLocaleString('fr-FR') }
function fmtF(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' MF'
  if (v >= 1_000)     return (v / 1_000).toLocaleString('fr-FR',     { maximumFractionDigits: 0 }) + ' kF'
  return v.toLocaleString('fr-FR') + ' F'
}

/* ═══════════════════════ CONTENU CARTE (hooks Leaflet) ════════════════════ */
function MapContent({ secteurs, filtreUO, filtreProfil, onStatsUpdate, onSelectClient, focusLatLng, isDark = true }: CarteMapProps & { isDark?: boolean }) {
  const [zoom,       setZoom]       = useState(ZOOM_INITIAL)
  const [points,     setPoints]     = useState<ClientPoint[]>([])
  const [loadingPts, setLoadingPts] = useState(false)
  const [capped,     setCapped]     = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const mapRef      = useRef<LMap | null>(null)

  const secteursFiltered = filtreUO ? secteurs.filter(s => s.uo === filtreUO) : secteurs
  const maxNb = Math.max(1, ...secteursFiltered.map(s => s.nb_total))

  /* Palette popup adaptative */
  const P = {
    txt:    isDark ? '#fff'                    : '#1F3B72',
    sub:    isDark ? 'rgba(255,255,255,.45)'   : 'rgba(31,59,114,.45)',
    faint:  isDark ? 'rgba(255,255,255,.28)'   : 'rgba(31,59,114,.3)',
    boxBg:  isDark ? 'rgba(255,255,255,.06)'   : 'rgba(31,59,114,.04)',
    boxBd:  isDark ? 'rgba(255,255,255,.08)'   : 'rgba(31,59,114,.09)',
    warn:   isDark ? 'rgba(248,113,113,.08)'   : 'rgba(220,38,38,.05)',
    warnBd: isDark ? 'rgba(248,113,113,.3)'    : 'rgba(220,38,38,.2)',
  }

  /* ── FlyTo quand focusLatLng change (vient du panneau risques) ── */
  const map = useMapEvents({
    moveend() {
      const z = map.getZoom(); setZoom(z); mapRef.current = map
      clearTimeout(debounceRef.current)
      if (z >= ZOOM_THRESHOLD) debounceRef.current = setTimeout(() => fetchPoints(map), 350)
      else onStatsUpdate({ nbVisible: 0, capped: false, zoom: z })
    },
    zoomend() {
      const z = map.getZoom(); setZoom(z); mapRef.current = map
      clearTimeout(debounceRef.current)
      if (z >= ZOOM_THRESHOLD) debounceRef.current = setTimeout(() => fetchPoints(map), 350)
      else { setPoints([]); onStatsUpdate({ nbVisible: 0, capped: false, zoom: z }) }
    },
  })

  useEffect(() => {
    if (focusLatLng) map.flyTo(focusLatLng, 10, { duration: 1.2 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLatLng])

  /* ── Fetch points individuels ── */
  const fetchPoints = useCallback((m: LMap) => {
    const z = m.getZoom()
    if (z < ZOOM_THRESHOLD) { setPoints([]); setCapped(false); return }
    const bbox = getBbox(m)
    setLoadingPts(true)
    const p = new URLSearchParams({
      minLat: String(bbox.minLat), maxLat: String(bbox.maxLat),
      minLng: String(bbox.minLng), maxLng: String(bbox.maxLng),
      limit:  String(MAX_POINTS),
    })
    if (filtreUO)     p.set('uo',     filtreUO)
    if (filtreProfil) p.set('profil', filtreProfil)

    fetch(`/api/carte/points?${p}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => {
        setPoints(d.points ?? [])
        setCapped(d.capped ?? false)
        onStatsUpdate({ nbVisible: d.count ?? 0, capped: d.capped ?? false, zoom: z })
      })
      .catch(() => setPoints([]))
      .finally(() => setLoadingPts(false))
  }, [filtreUO, filtreProfil, onStatsUpdate])

  useEffect(() => {
    if (mapRef.current && zoom >= ZOOM_THRESHOLD) fetchPoints(mapRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtreUO, filtreProfil])

  /* ── Vue SECTEURS (zoom < seuil) ── */
  if (zoom < ZOOM_THRESHOLD) {
    return (
      <>
        {secteursFiltered.map(s => {
          const color    = secteurColorAdapt(s.taux_recouvrement, isDark)
          const hasTaux  = (s.taux_recouvrement ?? 0) > 0
          const critique = hasTaux && s.taux_recouvrement! < 90
          const r        = sectorRadius(s.nb_total, maxNb)
          return (
            <Fragment key={s.uo}>
              {/* ── Halo glow extérieur ── */}
              <CircleMarker
                center={[s.lat, s.lng]}
                radius={r * 1.45}
                pathOptions={{
                  fillColor:   color,
                  fillOpacity: critique ? 0.22 : 0.13,
                  color:       'none',
                  weight:      0,
                }}
                interactive={false}
              />
              {/* ── Cercle principal ── */}
              <CircleMarker
                center={[s.lat, s.lng]}
                radius={r}
                pathOptions={{
                  fillColor:   color,
                  fillOpacity: 0.88,
                  color:       critique ? color : 'rgba(255,255,255,.2)',
                  weight:      critique ? 2.5 : 1.5,
                  opacity:     1,
                }}
              >
              <Popup minWidth={270}>
                <div style={{ fontFamily: "'Nunito', sans-serif", padding: '2px' }}>

                  {/* En-tête */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 0 3px ${color}44` }} />
                    <div style={{ fontWeight: 800, fontSize: 13, color: P.txt, lineHeight: 1.2, flex: 1 }}>{s.uo}</div>
                    {s.code_uo && <div style={{ fontSize: 10, color: P.sub, fontWeight: 600 }}>{s.code_uo}</div>}
                  </div>

                  {/* Stats clients — parc + période */}
                  {(() => {
                    const avecFact  = s.nb_avec_facture        ?? 0
                    const sansFact  = s.nb_sans_facture_filtre ?? 0
                    const totalLive = avecFact + sansFact || s.nb_total
                    const pctFact   = totalLive > 0 ? Math.round(avecFact  / totalLive * 100) : 0
                    const pctSans   = totalLive > 0 ? Math.round(sansFact  / totalLive * 100) : 0
                    return (
                      <>
                        {/* Parc + tournées */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', fontSize: 11 }}>
                          <div style={{ color: P.sub }}>Parc actif</div>
                          <div style={{ fontWeight: 800, color: P.txt, fontSize: 13 }}>{fmtN(s.nb_total)}</div>
                          <div style={{ color: P.sub }}>Tournées</div>
                          <div style={{ fontWeight: 700, color: P.txt }}>{fmtN(s.nb_tournees)}</div>
                        </div>

                        {/* Bloc facturés / non facturés */}
                        {totalLive > 0 && (
                          <div style={{ marginTop: 8, padding: '7px 9px', background: P.boxBg, borderRadius: 7, border: `1px solid ${P.boxBd}` }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: P.sub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                              Facturation · période sélectionnée
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                              <span style={{ fontSize: 10, color: P.sub }}>Facturés</span>
                              <span style={{ fontWeight: 800, color: '#16a34a', fontSize: 12 }}>
                                {fmtN(avecFact)}<span style={{ fontSize: 9, opacity: .7, marginLeft: 4 }}>({pctFact} %)</span>
                              </span>
                            </div>
                            {sansFact > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                <span style={{ fontSize: 10, color: P.sub }}>Non facturés</span>
                                <span style={{ fontWeight: 800, color: '#dc2626', fontSize: 12 }}>
                                  {fmtN(sansFact)}<span style={{ fontSize: 9, opacity: .7, marginLeft: 4 }}>({pctSans} %)</span>
                                </span>
                              </div>
                            )}
                            <div style={{ height: 5, borderRadius: 3, background: P.boxBd, overflow: 'hidden', display: 'flex' }}>
                              <div style={{ height: '100%', width: `${pctFact}%`, background: '#16a34a', borderRadius: 3 }} />
                              <div style={{ height: '100%', width: `${pctSans}%`, background: '#dc2626' }} />
                            </div>
                          </div>
                        )}

                        {/* Prises jamais facturées */}
                        {(s.nb_sans_facture ?? 0) > 0 && (() => {
                          const pct = Math.round((s.nb_sans_facture! / s.nb_total) * 100)
                          return (
                            <div style={{ marginTop: 6, padding: '5px 9px', background: P.warn, borderRadius: 6, border: `1px dashed ${P.warnBd}` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 9, color: P.sub, fontWeight: 600 }}>Prises jamais facturées</span>
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#dc2626' }}>
                                  {fmtN(s.nb_sans_facture!)}<span style={{ fontSize: 9, opacity: .7, marginLeft: 3 }}>({pct} %)</span>
                                </span>
                              </div>
                            </div>
                          )
                        })()}
                      </>
                    )
                  })()}

                  {/* Bloc recouvrement */}
                  {hasTaux && (
                    <div style={{ marginTop: 10, background: P.boxBg, borderRadius: 8, padding: '9px 10px', border: `1px solid ${color}44` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontSize: 10, color: P.sub, fontWeight: 600 }}>Taux recouvrement</span>
                        <span style={{ fontSize: 15, fontWeight: 900, color: color, textShadow: isDark ? `0 0 12px ${color}88` : 'none' }}>
                          {s.taux_recouvrement!.toFixed(1)} %
                        </span>
                      </div>
                      <div style={{ position: 'relative', height: 7, borderRadius: 4, background: P.boxBd, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, s.taux_recouvrement!)}%`, background: color, borderRadius: 4, boxShadow: isDark ? `0 0 8px ${color}88` : 'none' }} />
                        <div style={{ position: 'absolute', top: 0, left: '98.5%', width: 2, height: '100%', background: P.sub }} />
                      </div>
                      <div style={{ fontSize: 9, color: P.faint, marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                        <span>0 %</span><span>▲ objectif 98,5 %</span><span>100 %</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', fontSize: 11, marginTop: 8 }}>
                        <div style={{ color: P.sub }}>CA facturé</div>
                        <div style={{ fontWeight: 700, color: P.txt }}>{fmtF(s.ca_total ?? 0)}</div>
                        <div style={{ color: P.sub }}>Impayés</div>
                        <div style={{ fontWeight: 800, color: (s.imp_total ?? 0) > 0 ? '#dc2626' : '#16a34a' }}>
                          {fmtF(s.imp_total ?? 0)}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 8, fontSize: 10, color: P.faint, textAlign: 'center' }}>
                    Zoomez pour voir les clients individuels
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          </Fragment>
          )
        })}
      </>
    )
  }

  /* ── Vue POINTS individuels (zoom ≥ seuil) ── */
  return (
    <>
      {loadingPts && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000,
          background: isDark ? 'rgba(10,18,42,.92)' : 'rgba(255,255,255,.95)',
          borderRadius: 10,
          padding: '8px 16px',
          boxShadow: isDark
            ? '0 4px 24px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.08)'
            : '0 4px 20px rgba(31,59,114,.15), 0 0 0 1px rgba(31,59,114,.08)',
          fontSize: 12, fontWeight: 700, color: P.txt,
          fontFamily: "'Nunito', sans-serif",
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${P.boxBd}`, borderTopColor: '#1F3B72', animation: 'spin-carte 0.7s linear infinite', flexShrink: 0 }} />
          Chargement des clients…
        </div>
      )}

      {capped && !loadingPts && (
        <div style={{
          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'rgba(10,18,42,.92)', borderRadius: 10,
          padding: '7px 16px', fontSize: 11, fontWeight: 700, color: '#fbbf24',
          fontFamily: "'Nunito', sans-serif",
          boxShadow: '0 2px 20px rgba(0,0,0,.4), 0 0 0 1px rgba(251,191,36,.2)',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <AlertIcon size={12} strokeWidth={2.5} />
            Affichage limité à {fmtN(MAX_POINTS)} points — zoomez davantage
          </span>
        </div>
      )}

      {points.map(p => {
        const dotColor = profilColorDark(p.profil)
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={5}
            pathOptions={{ fillColor: dotColor, fillOpacity: 0.9, color: 'rgba(255,255,255,.25)', weight: 1 }}
            eventHandlers={{ click: () => onSelectClient(p) }}
          />
        )
      })}
    </>
  )
}

/* ══════════════════════════ FONDS DE CARTE ════════════════════════════════ */
const TILE_STYLES = [
  {
    id:    'dark',
    label: 'Sombre',
    icon:  '🌑',
    url:   'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    dark:  true,
  },
  {
    id:    'voyager',
    label: 'Voyager',
    icon:  '🗺',
    url:   'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    dark:  false,
  },
  {
    id:    'light',
    label: 'Clair',
    icon:  '☀',
    url:   'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    dark:  false,
  },
] as const

type TileId = typeof TILE_STYLES[number]['id']

/* ══════════════════════════ COMPOSANT EXPORTÉ ═════════════════════════════ */
export default function CarteMap(props: CarteMapProps) {
  const [tileId, setTileId] = useState<TileId>('dark')
  const tile = useMemo(() => TILE_STYLES.find(t => t.id === tileId)!, [tileId])
  const dark = tile.dark

  const css = `
    @keyframes spin-carte { to { transform: rotate(360deg); } }

    /* ── Popups glassmorphisme ── */
    .leaflet-popup-content-wrapper {
      background: ${dark ? 'rgba(10,18,42,.97)' : 'rgba(255,255,255,.97)'} !important;
      border-radius: 14px !important;
      box-shadow: ${dark
        ? '0 8px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08)'
        : '0 8px 32px rgba(31,59,114,.15), 0 0 0 1px rgba(31,59,114,.08)'} !important;
      border: none !important;
    }
    .leaflet-popup-tip-container { display: none !important; }
    .leaflet-popup-tip           { display: none !important; }
    .leaflet-popup-content       { margin: 14px 16px !important; }
    .leaflet-container           { font-family: 'Nunito', sans-serif !important; background: ${dark ? '#0a1220' : '#e8edf0'} !important; }
    .leaflet-popup-close-button  { color: ${dark ? 'rgba(255,255,255,.4)' : 'rgba(31,59,114,.4)'} !important; font-size: 18px !important; top: 8px !important; right: 10px !important; }
    .leaflet-popup-close-button:hover { color: ${dark ? '#fff' : '#1F3B72'} !important; }

    /* ── Contrôles zoom ── */
    .leaflet-control-zoom a {
      background: ${dark ? 'rgba(10,18,42,.9)' : 'rgba(255,255,255,.95)'} !important;
      border-color: ${dark ? 'rgba(255,255,255,.12)' : 'rgba(31,59,114,.15)'} !important;
      color: ${dark ? 'rgba(255,255,255,.7)' : 'rgba(31,59,114,.7)'} !important;
      font-family: monospace !important;
    }
    .leaflet-control-zoom a:hover {
      background: ${dark ? 'rgba(31,59,114,.9)' : '#1F3B72'} !important;
      color: #fff !important;
    }

    /* ── Attribution ── */
    .leaflet-control-attribution {
      background: ${dark ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.8)'} !important;
      color: ${dark ? 'rgba(255,255,255,.3)' : 'rgba(31,59,114,.4)'} !important;
      font-size: 9px !important;
    }
    .leaflet-control-attribution a { color: ${dark ? 'rgba(255,255,255,.4)' : 'rgba(31,59,114,.5)'} !important; }
  `

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <style>{css}</style>

      <MapContainer
        center={SENEGAL_CENTER}
        zoom={ZOOM_INITIAL}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          key={tileId}
          url={tile.url}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />
        <MapContent {...props} isDark={dark} />
      </MapContainer>

      {/* ── Sélecteur de fond ── */}
      <div style={{
        position: 'absolute', top: 80, right: 10, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {TILE_STYLES.map(t => (
          <button
            key={t.id}
            onClick={() => setTileId(t.id)}
            title={t.label}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
              fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 700,
              border: 'none',
              background: tileId === t.id
                ? 'rgba(31,59,114,.95)'
                : (dark ? 'rgba(10,18,42,.82)' : 'rgba(255,255,255,.92)'),
              color: tileId === t.id
                ? '#fff'
                : (dark ? 'rgba(255,255,255,.6)' : 'rgba(31,59,114,.65)'),
              boxShadow: tileId === t.id
                ? '0 2px 12px rgba(31,59,114,.4)'
                : '0 1px 6px rgba(0,0,0,.15)',
              transition: 'all .15s',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <span style={{ fontSize: 12 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
