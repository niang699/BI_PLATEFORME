'use client'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import Map, {
  Source, Layer, Popup, NavigationControl, Marker,
  type MapRef, type MapMouseEvent as MapClickEvent, type ViewStateChangeEvent,
} from 'react-map-gl/mapbox'
import { AlertTriangle as AlertIcon } from 'lucide-react'

/* ═══════════════════════════════ TYPES ════════════════════════════════════ */
export interface SecteurPoint {
  uo: string; code_uo: string; nb_total: number; nb_actif: number
  lat: number; lng: number; nb_tournees: number
  nb_sans_facture?: number
  nb_total_live?: number
  nb_avec_facture?: number
  nb_sans_facture_filtre?: number
  nb_factures?: number; ca_total?: number; enc_total?: number
  imp_total?: number; taux_recouvrement?: number
}

export interface ClientPoint {
  id: string; ref: string; nom: string; prenom: string
  profil: string; uo: string; code_uo: string
  tournee: string; adresse: string; telephone: string
  compteur: string; diametre: string; lat: number; lng: number
}

interface Stats { nbVisible: number; capped: boolean; zoom: number }

interface CarteMapProps {
  secteurs:       SecteurPoint[]
  filtreUO:       string
  filtreProfil:   string
  onStatsUpdate:  (s: Stats) => void
  onSelectClient: (c: ClientPoint) => void
  focusLatLng?:   [number, number] | null
}

/* ─── Re-exports carteUtils ──────────────────────────────────────────────── */
export { PROFIL_CATS, profilColor, secteurColor } from './carteUtils'

/* ═══════════════════════════ CONSTANTES ═══════════════════════════════════ */
const MAPBOX_TOKEN   = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
const SENEGAL_CENTER = { longitude: -14.4, latitude: 14.5, zoom: 6.5 }
const ZOOM_THRESHOLD = 13
const MAX_POINTS     = 3000

const MAP_STYLES = [
  { id: 'streets',   label: 'Carte',     icon: '🗺️', style: 'mapbox://styles/mapbox/streets-v12',           dark: false },
  { id: 'dark',      label: 'Sombre',    icon: '🌑', style: 'mapbox://styles/mapbox/dark-v11',              dark: true  },
  { id: 'satellite', label: 'Satellite', icon: '🛰️', style: 'mapbox://styles/mapbox/satellite-streets-v12', dark: true  },
] as const
type StyleId = typeof MAP_STYLES[number]['id']

/* ═══════════════════════════ HELPERS ══════════════════════════════════════ */
function secteurColor(taux: number | undefined): string {
  if (!taux || taux === 0) return '#1F3B72'
  if (taux >= 98.5) return '#22c55e'
  if (taux >= 95)   return '#ca8a04'
  if (taux >= 90)   return '#d97706'
  return '#E84040'
}

function profilColorForMap(profil: string): string {
  const p = profil.toLowerCase()
  if (p.includes('particulier')) return '#60a5fa'
  if (/entreprise|usine|hotel|restaurant|boulangerie|pharmacie|chantier|banque|clinique|industrie/i.test(p)) return '#fbbf24'
  if (/hôpital|hopital|école|ecole|université|universite|bâtiment|batiment|ambassade|organisation|municipal|administratif/i.test(p)) return '#a3e635'
  if (/borne|bouche|edicule|potence|marai/i.test(p)) return '#22d3ee'
  if (/cadre|employé|retraite|local|membre/i.test(p)) return '#c084fc'
  return '#94a3b8'
}

function fmtN(v: number) { return v.toLocaleString('fr-FR') }
function fmtF(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' MF'
  if (v >= 1_000)     return (v / 1_000).toLocaleString('fr-FR',     { maximumFractionDigits: 0 }) + ' kF'
  return v.toLocaleString('fr-FR') + ' F'
}

/* ═══════════════════════ POPUP SECTEUR ════════════════════════════════════ */
function SecteurPopup({ s, isDark }: { s: SecteurPoint; isDark: boolean }) {
  const color   = secteurColor(s.taux_recouvrement)
  const hasTaux = (s.taux_recouvrement ?? 0) > 0
  const avecFact  = s.nb_avec_facture        ?? 0
  const sansFact  = s.nb_sans_facture_filtre ?? 0
  const totalLive = avecFact + sansFact || s.nb_total
  const pctFact   = totalLive > 0 ? Math.round(avecFact / totalLive * 100) : 0
  const pctSans   = totalLive > 0 ? Math.round(sansFact / totalLive * 100) : 0
  const P = {
    txt:   isDark ? '#fff'                    : '#1F3B72',
    sub:   isDark ? 'rgba(255,255,255,.45)'   : 'rgba(31,59,114,.45)',
    faint: isDark ? 'rgba(255,255,255,.28)'   : 'rgba(31,59,114,.3)',
    boxBg: isDark ? 'rgba(255,255,255,.06)'   : 'rgba(31,59,114,.04)',
    boxBd: isDark ? 'rgba(255,255,255,.08)'   : 'rgba(31,59,114,.09)',
    warn:  isDark ? 'rgba(248,113,113,.08)'   : 'rgba(220,38,38,.05)',
    warnBd:isDark ? 'rgba(248,113,113,.3)'    : 'rgba(220,38,38,.2)',
  }

  const jfPct = s.nb_total > 0 ? Math.round((s.nb_sans_facture ?? 0) / s.nb_total * 100) : 0

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif", minWidth: 240 }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 0 3px ${color}44` }} />
        <div style={{ fontWeight: 800, fontSize: 13, color: P.txt, flex: 1 }}>{s.uo}</div>
        {s.code_uo && <div style={{ fontSize: 10, color: P.sub, fontWeight: 600 }}>{s.code_uo}</div>}
      </div>

      {/* Parc */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', fontSize: 11, marginBottom: 8 }}>
        <div style={{ color: P.sub }}>Parc actif</div>
        <div style={{ fontWeight: 800, color: P.txt, fontSize: 13 }}>{fmtN(s.nb_total)}</div>
        <div style={{ color: P.sub }}>Tournées</div>
        <div style={{ fontWeight: 700, color: P.txt }}>{fmtN(s.nb_tournees)}</div>
      </div>

      {/* Facturation période */}
      {totalLive > 0 && (
        <div style={{ padding: '7px 9px', background: P.boxBg, borderRadius: 7, border: `1px solid ${P.boxBd}`, marginBottom: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: P.sub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
            Facturation · période sélectionnée
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: P.sub }}>Facturés</span>
            <span style={{ fontWeight: 800, color: '#16a34a', fontSize: 12 }}>
              {fmtN(avecFact)}<span style={{ fontSize: 9, opacity: .7, marginLeft: 4 }}>({pctFact} %)</span>
            </span>
          </div>
          {sansFact > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
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
      {(s.nb_sans_facture ?? 0) > 0 && (
        <div style={{ padding: '5px 9px', background: P.warn, borderRadius: 6, border: `1px dashed ${P.warnBd}`, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, color: P.sub, fontWeight: 600 }}>Prises jamais facturées</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#dc2626' }}>
              {fmtN(s.nb_sans_facture!)}<span style={{ fontSize: 9, opacity: .7, marginLeft: 3 }}>({jfPct} %)</span>
            </span>
          </div>
        </div>
      )}

      {/* Recouvrement */}
      {hasTaux && (
        <div style={{ background: P.boxBg, borderRadius: 8, padding: '9px 10px', border: `1px solid ${color}44` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: P.sub, fontWeight: 600 }}>Taux recouvrement</span>
            <span style={{ fontSize: 15, fontWeight: 900, color }}>{s.taux_recouvrement!.toFixed(1)} %</span>
          </div>
          <div style={{ position: 'relative', height: 7, borderRadius: 4, background: P.boxBd, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, s.taux_recouvrement!)}%`, background: color, borderRadius: 4 }} />
            <div style={{ position: 'absolute', top: 0, left: '98.5%', width: 2, height: '100%', background: P.sub }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', fontSize: 11, marginTop: 8 }}>
            <div style={{ color: P.sub }}>CA facturé</div>
            <div style={{ fontWeight: 700, color: P.txt }}>{fmtF(s.ca_total ?? 0)}</div>
            <div style={{ color: P.sub }}>Impayés</div>
            <div style={{ fontWeight: 800, color: (s.imp_total ?? 0) > 0 ? '#dc2626' : '#16a34a' }}>{fmtF(s.imp_total ?? 0)}</div>
          </div>
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 10, color: P.faint, textAlign: 'center' }}>
        Zoomez pour voir les clients individuels
      </div>
    </div>
  )
}

/* ══════════════════════════ COMPOSANT PRINCIPAL ═══════════════════════════ */
export default function CarteMap({
  secteurs, filtreUO, filtreProfil, onStatsUpdate, onSelectClient, focusLatLng,
}: CarteMapProps) {
  const mapRef      = useRef<MapRef>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const [styleId,    setStyleId]    = useState<StyleId>('streets')
  const [zoom,       setZoom]       = useState(SENEGAL_CENTER.zoom)
  const [points,     setPoints]     = useState<ClientPoint[]>([])
  const [loadingPts, setLoadingPts] = useState(false)
  const [capped,     setCapped]     = useState(false)
  const [cursor,     setCursor]     = useState('auto')
  const [popupInfo,  setPopupInfo]  = useState<{ s: SecteurPoint; lng: number; lat: number } | null>(null)

  const isDark = MAP_STYLES.find(t => t.id === styleId)!.dark
  const style  = MAP_STYLES.find(t => t.id === styleId)!.style
  const isZoomDetail = zoom >= ZOOM_THRESHOLD

  /* ── GeoJSON secteurs ── */
  const secteursFiltered = filtreUO ? secteurs.filter(s => s.uo === filtreUO) : secteurs
  const maxNb = Math.max(1, ...secteursFiltered.map(s => s.nb_total))

/* ── GeoJSON points clients ── */
  const pointsGeoJSON: GeoJSON.FeatureCollection = useMemo(() => ({
    type: 'FeatureCollection',
    features: points.map(p => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      properties: { id: p.id, color: profilColorForMap(p.profil) },
    })),
  }), [points])

  /* ── FlyTo sur focusLatLng ── */
  useEffect(() => {
    if (focusLatLng && mapRef.current) {
      mapRef.current.flyTo({ center: [focusLatLng[1], focusLatLng[0]], zoom: 10, duration: 1200 })
    }
  }, [focusLatLng])

  /* ── Fetch points individuels ── */
  const fetchPoints = useCallback((map: MapRef) => {
    const z = map.getZoom()
    if (z < ZOOM_THRESHOLD) { setPoints([]); setCapped(false); return }
    const bounds = map.getBounds()
    if (!bounds) return
    setLoadingPts(true)
    const p = new URLSearchParams({
      minLat: String(bounds.getSouth()), maxLat: String(bounds.getNorth()),
      minLng: String(bounds.getWest()),  maxLng: String(bounds.getEast()),
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

  /* ── onMove — debounced fetch points ── */
  const handleMove = useCallback((e: ViewStateChangeEvent) => {
    const z = e.viewState.zoom
    setZoom(z)
    clearTimeout(debounceRef.current)
    if (z >= ZOOM_THRESHOLD && mapRef.current) {
      debounceRef.current = setTimeout(() => fetchPoints(mapRef.current!), 350)
    } else {
      setPoints([])
      onStatsUpdate({ nbVisible: 0, capped: false, zoom: z })
    }
  }, [fetchPoints, onStatsUpdate])

  /* ── Re-fetch quand filtres changent ── */
  useEffect(() => {
    if (mapRef.current && zoom >= ZOOM_THRESHOLD) fetchPoints(mapRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtreUO, filtreProfil])

  /* ── Click sur la carte ── */
  const handleClick = useCallback((e: MapClickEvent) => {
    if (!e.features || e.features.length === 0) { setPopupInfo(null); return }
    const f = e.features[0]
    if (!f.properties || !f.geometry) return
    const coords = (f.geometry as GeoJSON.Point).coordinates

    if (isZoomDetail) {
      /* Point client — chercher dans le tableau local */
      const pt = points.find(p => p.id === f.properties!.id)
      if (pt) onSelectClient(pt)
    } else {
      /* Secteur — ouvrir popup */
      const secteur = secteursFiltered.find(s => s.uo === f.properties!.uo)
      if (secteur) setPopupInfo({ s: secteur, lng: coords[0], lat: coords[1] })
    }
  }, [isZoomDetail, points, secteursFiltered, onSelectClient])

  const interactiveLayers = isZoomDetail ? ['points-layer'] : []

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <style>{`
        @keyframes spin-carte  { to { transform: rotate(360deg); } }
        @keyframes pulse-ring {
          0%   { transform: translate(-50%,-50%) scale(1);   opacity: .6; }
          80%  { transform: translate(-50%,-50%) scale(2.8); opacity: 0;  }
          100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0;  }
        }
        .pulse-marker      { position: relative; cursor: pointer; }
        .pulse-dot         { border-radius: 50%; border: 2.5px solid rgba(255,255,255,.7); box-shadow: 0 2px 14px rgba(0,0,0,.28); transition: transform .15s; position: relative; z-index: 2; }
        .pulse-marker:hover .pulse-dot { transform: scale(1.15); }
        .pulse-ring        { position: absolute; top: 50%; left: 50%; border-radius: 50%; animation: pulse-ring 2.4s ease-out infinite; pointer-events: none; }
        .mapboxgl-popup-content {
          background: ${isDark ? 'rgba(10,18,42,.97)' : 'rgba(255,255,255,.97)'} !important;
          border-radius: 14px !important;
          box-shadow: ${isDark
            ? '0 8px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08)'
            : '0 8px 32px rgba(31,59,114,.15), 0 0 0 1px rgba(31,59,114,.08)'} !important;
          padding: 14px 16px !important;
        }
        .mapboxgl-popup-tip          { display: none !important; }
        .mapboxgl-popup-close-button {
          color: ${isDark ? 'rgba(255,255,255,.5)' : 'rgba(31,59,114,.4)'} !important;
          font-size: 20px !important; top: 6px !important; right: 10px !important;
          background: none !important;
        }
        .mapboxgl-ctrl-group         { border-radius: 10px !important; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.15) !important; }
        .mapboxgl-ctrl-group button  { width: 32px !important; height: 32px !important; }
        .mapboxgl-ctrl-attrib        { font-size: 9px !important; }
      `}</style>

      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={style}
        initialViewState={SENEGAL_CENTER}
        style={{ width: '100%', height: '100%' }}
        projection="mercator"
        onMove={handleMove}
        onClick={handleClick}
        onMouseEnter={() => setCursor('pointer')}
        onMouseLeave={() => setCursor('auto')}
        interactiveLayerIds={interactiveLayers}
        cursor={cursor}
      >
        <NavigationControl position="bottom-right" />

        {/* ── Secteurs — Markers pulse HTML (zoom < seuil) ── */}
        {!isZoomDetail && secteursFiltered.map((s, idx) => {
          const color    = secteurColor(s.taux_recouvrement)
          const size     = Math.max(14, Math.min(48, (Math.sqrt(s.nb_total) / Math.sqrt(maxNb)) * 44 + 12))
          const critique = (s.taux_recouvrement ?? 0) > 0 && s.taux_recouvrement! < 90
          const delay    = `${(idx * 0.17) % 2.4}s`
          const duration = critique ? '1.5s' : '2.4s'
          return (
            <Marker
              key={s.uo}
              longitude={s.lng}
              latitude={s.lat}
              anchor="center"
              onClick={() => setPopupInfo({ s, lng: s.lng, lat: s.lat })}
            >
              <div className="pulse-marker" style={{ width: size, height: size }}>
                {/* Anneau pulse */}
                <div className="pulse-ring" style={{
                  width: size, height: size,
                  background: color,
                  opacity: critique ? 0.55 : 0.4,
                  animationDuration: duration,
                  animationDelay: delay,
                }} />
                {/* Deuxième anneau décalé pour les critiques */}
                {critique && (
                  <div className="pulse-ring" style={{
                    width: size, height: size,
                    background: color,
                    opacity: 0.3,
                    animationDuration: duration,
                    animationDelay: `calc(${delay} + 0.6s)`,
                  }} />
                )}
                {/* Point fixe */}
                <div className="pulse-dot" style={{
                  width: size, height: size,
                  background: color,
                }} />
              </div>
            </Marker>
          )
        })}

        {/* ── Points clients (zoom ≥ seuil) ── */}
        <Source id="points" type="geojson" data={pointsGeoJSON}>
          <Layer
            id="points-layer"
            type="circle"
            layout={{ visibility: isZoomDetail ? 'visible' : 'none' }}
            paint={{
              'circle-radius':       5,
              'circle-color':        ['get', 'color'],
              'circle-opacity':      0.9,
              'circle-stroke-color': 'rgba(255,255,255,.25)',
              'circle-stroke-width': 1,
            }}
          />
        </Source>

        {/* ── Popup secteur ── */}
        {popupInfo && !isZoomDetail && (
          <Popup
            longitude={popupInfo.lng}
            latitude={popupInfo.lat}
            onClose={() => setPopupInfo(null)}
            closeOnClick={false}
            maxWidth="300px"
            offset={12}
          >
            <SecteurPopup s={popupInfo.s} isDark={isDark} />
          </Popup>
        )}
      </Map>

      {/* ── Sélecteur style ── */}
      <div style={{
        position: 'absolute', top: 80, right: 12, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {MAP_STYLES.map(t => (
          <button key={t.id} onClick={() => setStyleId(t.id)} title={t.label} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 11px', borderRadius: 8, cursor: 'pointer', border: 'none',
            fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 700,
            background: styleId === t.id
              ? 'rgba(31,59,114,.95)'
              : isDark ? 'rgba(10,18,42,.82)' : 'rgba(255,255,255,.92)',
            color: styleId === t.id
              ? '#fff'
              : isDark ? 'rgba(255,255,255,.65)' : 'rgba(31,59,114,.65)',
            boxShadow: styleId === t.id
              ? '0 2px 12px rgba(31,59,114,.35)'
              : '0 1px 6px rgba(0,0,0,.14)',
            transition: 'all .15s',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ── Spinner chargement points ── */}
      {loadingPts && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10,
          background: isDark ? 'rgba(10,18,42,.92)' : 'rgba(255,255,255,.95)',
          borderRadius: 10, padding: '8px 18px',
          boxShadow: '0 4px 24px rgba(0,0,0,.3)',
          fontSize: 12, fontWeight: 700,
          color: isDark ? 'rgba(255,255,255,.85)' : '#1F3B72',
          fontFamily: "'Nunito', sans-serif",
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(31,59,114,.2)', borderTopColor: '#1F3B72', animation: 'spin-carte 0.7s linear infinite', flexShrink: 0 }} />
          Chargement des clients…
        </div>
      )}

      {/* ── Avertissement cap ── */}
      {capped && !loadingPts && (
        <div style={{
          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, background: 'rgba(10,18,42,.92)', borderRadius: 10,
          padding: '7px 16px', fontSize: 11, fontWeight: 700, color: '#fbbf24',
          fontFamily: "'Nunito', sans-serif",
          display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: '0 2px 20px rgba(0,0,0,.4), 0 0 0 1px rgba(251,191,36,.2)',
        }}>
          <AlertIcon size={12} strokeWidth={2.5} />
          Affichage limité à {fmtN(MAX_POINTS)} points — zoomez davantage
        </div>
      )}
    </div>
  )
}
