'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { ChevronLeft, ChevronDown, ChevronRight, Search, Database, Table2, Key, Hash, Calendar, Type, ToggleLeft } from 'lucide-react'

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface Column {
  name:        string
  type:        'text' | 'int' | 'float' | 'date' | 'boolean' | 'varchar'
  pk?:         boolean
  nullable?:   boolean
  description: string
  example?:    string
  values?:     string[]   // valeurs énumérées connues
}

interface CatalogTable {
  id:          string
  schema:      string
  table:       string
  base:        'sen_dwh' | 'sen_ods'
  type:        'table' | 'vue_mat' | 'dimension' | 'fait'
  domaine:     string
  description: string
  nb_rows?:    string      // ordre de grandeur
  owner?:      string
  apis:        string[]    // routes API qui l'utilisent
  columns:     Column[]
}

/* ─── Palette ────────────────────────────────────────────────────────────────── */
const BASE_COLOR:   Record<string, string> = { sen_dwh: '#1F3B72', sen_ods: '#0891B2' }
const TYPE_COLOR:   Record<string, string> = { table: '#6b7280', vue_mat: '#8b5cf6', dimension: '#D97706', fait: '#96C11E' }
const TYPE_LABEL:   Record<string, string> = { table: 'Table', vue_mat: 'Vue mat.', dimension: 'Dimension', fait: 'Fait' }
const COL_TYPE_ICON: Record<string, React.ReactNode> = {
  text:    <Type    size={11} />,
  int:     <Hash    size={11} />,
  float:   <Hash    size={11} />,
  date:    <Calendar size={11} />,
  boolean: <ToggleLeft size={11} />,
  varchar: <Type    size={11} />,
}

/* ═══════════════════════════════════════════════════════════════════════════
   CATALOGUE STATIQUE
════════════════════════════════════════════════════════════════════════════ */
const CATALOG: CatalogTable[] = [
  /* ── RH Dimension Personnel ──────────────────────────────────────────────── */
  {
    id: 'dim_personnel', schema: 'dwh_rh', table: 'dim_personnel',
    base: 'sen_dwh', type: 'dimension', domaine: 'RH',
    description: 'Référentiel des agents SEN\'EAU — un enregistrement par agent, actif ou sorti. Clé de liaison pour toutes les tables du domaine RH.',
    nb_rows: '~1 500', owner: 'DRH',
    apis: ['/api/rh/kpis', '/api/rh/details', '/api/rh/evolution', '/api/data-quality'],
    columns: [
      { name: 'matricule',     type: 'varchar', pk: true,  nullable: false, description: 'Identifiant unique de l\'agent', example: 'SN00423' },
      { name: 'sexe',          type: 'varchar',             nullable: true,  description: 'Genre de l\'agent', values: ['MASCULIN', 'FEMININ'] },
      { name: 'date_embauche', type: 'date',                nullable: true,  description: 'Date de prise de poste à SEN\'EAU', example: '2015-03-01' },
      { name: 'date_sortie',   type: 'date',                nullable: false, description: 'Date de fin de contrat. Valeur sentinelle 1999-12-31 = agent actif.', values: ['1999-12-31 (actif)', 'date réelle (sorti)'] },
      { name: 'type_contrat',  type: 'varchar',             nullable: true,  description: 'Nature du contrat de travail', values: ['DI (CDI)', 'DD (CDD)', 'JR (Journalier)', 'ST (Stagiaire)', 'CO (Consultant)'] },
      { name: 'code_eta',      type: 'varchar',             nullable: true,  description: 'Code de l\'établissement d\'affectation — FK vers dim_etablissement', example: 'ETA01' },
      { name: 'categorie',     type: 'varchar',             nullable: true,  description: 'Catégorie professionnelle (Cadre, Agent de Maîtrise, Employé…)' },
    ],
  },

  /* ── RH Fait Collaborateur ───────────────────────────────────────────────── */
  {
    id: 'dtm_drht_collaborateur', schema: 'dwh_rh', table: 'dtm_drht_collaborateur',
    base: 'sen_dwh', type: 'fait', domaine: 'RH',
    description: 'Table de faits mensuelle DRH — contient les données de paie, heures supplémentaires et formation par agent, par mois et par établissement.',
    nb_rows: '~200 000', owner: 'DRH',
    apis: ['/api/rh/kpis', '/api/rh/details', '/api/rh/evolution', '/api/rh/hs-topn'],
    columns: [
      { name: 'matricule',       type: 'varchar', pk: true,  nullable: false, description: 'Identifiant agent — FK vers dim_personnel' },
      { name: 'annee',           type: 'int',     pk: true,  nullable: false, description: 'Année de la paie', example: '2024' },
      { name: 'mois',            type: 'int',     pk: true,  nullable: false, description: 'Mois de la paie (1–12)', example: '3' },
      { name: 'code_eta',        type: 'varchar',             nullable: true,  description: 'Code établissement — FK vers dim_etablissement' },
      { name: 'code_quali',      type: 'varchar',             nullable: true,  description: 'Code qualification — FK vers dim_qualification' },
      { name: 'categorie',       type: 'varchar',             nullable: true,  description: 'Catégorie professionnelle ce mois-ci' },
      { name: 'rubrique',        type: 'varchar',             nullable: true,  description: 'Code rubrique de paie. Préfixe A03 = salaire de base pour la masse salariale.', example: 'A03100' },
      { name: 'revenu',          type: 'float',               nullable: true,  description: 'Montant de la rubrique en FCFA', example: '450000' },
      { name: 'heure_sup',       type: 'float',               nullable: true,  description: 'Nombre d\'heures supplémentaires effectuées', example: '12.5' },
      { name: 'heure_sup_mont',  type: 'float',               nullable: true,  description: 'Montant en FCFA des heures supplémentaires' },
      { name: 'heure_formation', type: 'float',               nullable: true,  description: 'Heures de formation reçues ce mois-ci' },
      { name: 'id_formation',    type: 'int',                 nullable: true,  description: 'Identifiant du programme de formation — FK vers dim_formation' },
    ],
  },

  /* ── RH Dimension Établissement ─────────────────────────────────────────── */
  {
    id: 'dim_etablissement', schema: 'dwh_rh', table: 'dim_etablissement',
    base: 'sen_dwh', type: 'dimension', domaine: 'RH',
    description: 'Référentiel des établissements SEN\'EAU (sites, agences, directions). Utilisé pour regrouper les effectifs par entité géographique ou fonctionnelle.',
    nb_rows: '~30', owner: 'DRH',
    apis: ['/api/rh/filtres', '/api/rh/details', '/api/rh/hs-topn'],
    columns: [
      { name: 'code_eta',      type: 'varchar', pk: true, nullable: false, description: 'Code établissement (clé primaire)', example: 'ETA01' },
      { name: 'libelle_eta',   type: 'varchar',           nullable: true,  description: 'Libellé complet de l\'établissement', example: 'Direction Générale Dakar' },
    ],
  },

  /* ── RH Dimension Qualification ─────────────────────────────────────────── */
  {
    id: 'dim_qualification', schema: 'dwh_rh', table: 'dim_qualification',
    base: 'sen_dwh', type: 'dimension', domaine: 'RH',
    description: 'Référentiel des qualifications professionnelles — niveaux de poste et grilles de compétence.',
    nb_rows: '~50', owner: 'DRH',
    apis: ['/api/rh/filtres', '/api/rh/details', '/api/rh/hs-topn'],
    columns: [
      { name: 'code_quali',    type: 'varchar', pk: true, nullable: false, description: 'Code qualification (clé primaire)', example: 'Q10' },
      { name: 'libelle_quali', type: 'varchar',           nullable: true,  description: 'Libellé de la qualification', example: 'Ingénieur Principal' },
    ],
  },

  /* ── RH Dimension Formation ─────────────────────────────────────────────── */
  {
    id: 'dim_formation', schema: 'dwh_rh', table: 'dim_formation',
    base: 'sen_dwh', type: 'dimension', domaine: 'RH',
    description: 'Catalogue des formations suivies par les collaborateurs SEN\'EAU.',
    nb_rows: '~200', owner: 'DRH',
    apis: ['/api/rh/details'],
    columns: [
      { name: 'id_formation',      type: 'int',     pk: true, nullable: false, description: 'Identifiant unique de la formation' },
      { name: 'libelle_formation', type: 'varchar',           nullable: true,  description: 'Intitulé du programme de formation', example: 'Sécurité électrique – niveau 2' },
    ],
  },

  /* ── Facturation mv_recouvrement ─────────────────────────────────────────── */
  {
    id: 'mv_recouvrement', schema: 'public', table: 'mv_recouvrement',
    base: 'sen_ods', type: 'vue_mat', domaine: 'Facturation',
    description: 'Vue matérialisée centrale — consolidation de toutes les factures clients avec montants, statuts et indicateurs de recouvrement. Source unique pour tous les KPIs facturation de la plateforme.',
    nb_rows: '~3 000 000', owner: 'DSI / Finance',
    apis: ['/api/kpis', '/api/facturation/kpis', '/api/rapports', '/api/carte/*', '/api/data-quality'],
    columns: [
      { name: 'CODE_CLIENT',          type: 'varchar', pk: true,  nullable: false, description: 'Identifiant unique de l\'abonné', example: 'CL00012345' },
      { name: 'PERIODE_FACTURATION',  type: 'varchar', pk: true,  nullable: false, description: 'Période au format MM/YYYY', example: '03/2025', values: ['MM/YYYY'] },
      { name: 'DR',                   type: 'varchar',             nullable: true,  description: 'Direction Régionale', example: 'DR DAKAR' },
      { name: 'UO',                   type: 'varchar',             nullable: true,  description: 'Unité Opérationnelle (sous-direction)', example: 'UO DAKAR-NORD' },
      { name: 'DIRECTION_TERRITORIALE', type: 'varchar',           nullable: true,  description: 'Direction Territoriale de rattachement' },
      { name: 'GROUPE_FACTURATION',   type: 'varchar',             nullable: true,  description: 'Groupe de facturation (regroupement tarifaire)' },
      { name: 'TYPE_FACTURE',         type: 'varchar',             nullable: true,  description: 'Type de facture (Relevée, Estimée, Avoir…)' },
      { name: 'CAT_BRANCHEMENT',      type: 'varchar',             nullable: true,  description: 'Catégorie de branchement (diamètre, usage)' },
      { name: 'MONTANT_FACTURE',      type: 'float',               nullable: true,  description: 'Montant facturé en FCFA', example: '25000' },
      { name: 'MONTANT_REGLE',        type: 'float',               nullable: true,  description: 'Montant encaissé en FCFA à date' },
      { name: 'chiffre_affaire',      type: 'float',               nullable: true,  description: 'CA net de la facture (minuscule)', example: '25000' },
      { name: 'montant_regle',        type: 'float',               nullable: true,  description: 'Encaissement net (minuscule)' },
      { name: 'impaye',               type: 'float',               nullable: true,  description: 'Solde impayé = chiffre_affaire – montant_regle' },
      { name: 'taux_recouvrement',    type: 'float',               nullable: true,  description: 'Taux de recouvrement calculé (0–100)', example: '97.3' },
      { name: 'statut_facture',       type: 'varchar',             nullable: true,  description: 'Statut de la facture', values: ['Soldée', 'Partiellement réglée', 'Impayée'] },
      { name: 'categorie_rgp',        type: 'varchar',             nullable: true,  description: 'Catégorie regroupée pour analyses croisées' },
      { name: 'j / jp15..js90',       type: 'float',               nullable: true,  description: 'Buckets d\'ancienneté d\'impayé : j=courant, jp15=1–15j, jp30=16–30j, …, js90=>90j' },
    ],
  },
]

/* ─── Domaines & couleurs ────────────────────────────────────────────────────── */
const DOMAINE_COLOR: Record<string, string> = {
  RH:           '#96C11E',
  Facturation:  '#D97706',
  Releveurs:    '#8b5cf6',
  Référentiel:  '#0891B2',
}

/* ═══════════════════════════════════════════════════════════════════════════
   SOUS-COMPOSANTS
════════════════════════════════════════════════════════════════════════════ */
function ColumnRow({ col }: { col: Column }) {
  return (
    <tr style={{ borderBottom: '1px solid rgba(31,59,114,.04)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(31,59,114,.02)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}>
      <td style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {col.pk && (
          <Key size={10} style={{ color: '#D97706', flexShrink: 0 }} />
        )}
        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600,
          color: col.pk ? '#D97706' : '#1F3B72' }}>
          {col.name}
        </span>
      </td>
      <td style={{ padding: '8px 12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'rgba(31,59,114,.06)', borderRadius: 5,
          padding: '2px 7px', fontSize: 10, fontWeight: 600,
          color: 'rgba(31,59,114,.6)', fontFamily: 'monospace' }}>
          {COL_TYPE_ICON[col.type]} {col.type}
        </span>
      </td>
      <td style={{ padding: '8px 12px', fontSize: 11, color: 'rgba(31,59,114,.6)', lineHeight: 1.5 }}>
        {col.description}
        {col.values && (
          <div style={{ marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {col.values.map(v => (
              <span key={v} style={{ background: 'rgba(150,193,30,.12)', borderRadius: 4,
                padding: '1px 6px', fontSize: 9.5, fontWeight: 600, color: '#5a7a10' }}>{v}</span>
            ))}
          </div>
        )}
      </td>
      <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: 'monospace',
        color: 'rgba(31,59,114,.4)', whiteSpace: 'nowrap' }}>
        {col.example ?? ''}
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 600,
          color: col.nullable === false ? '#96C11E' : 'rgba(31,59,114,.35)' }}>
          {col.nullable === false ? 'NON NULL' : 'nullable'}
        </span>
      </td>
    </tr>
  )
}

function TableCard({ t }: { t: CatalogTable }) {
  const [open, setOpen] = useState(false)
  const baseColor   = BASE_COLOR[t.base]   ?? '#1F3B72'
  const typeColor   = TYPE_COLOR[t.type]   ?? '#6b7280'
  const domaineColor = DOMAINE_COLOR[t.domaine] ?? '#1F3B72'

  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden',
      border: '1px solid rgba(31,59,114,.08)', boxShadow: '0 2px 12px rgba(31,59,114,.05)' }}>

      {/* ── Header ── */}
      <div style={{ padding: '16px 20px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>

          {/* Icône DB */}
          <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: `${baseColor}12`, border: `1px solid ${baseColor}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Table2 size={18} style={{ color: baseColor }} />
          </div>

          {/* Infos principales */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
                color: '#1F3B72' }}>
                {t.schema}.{t.table}
              </span>
              {/* Tags */}
              <span style={{ background: `${baseColor}12`, borderRadius: 6,
                padding: '2px 8px', fontSize: 9.5, fontWeight: 800,
                color: baseColor, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                {t.base}
              </span>
              <span style={{ background: `${typeColor}18`, borderRadius: 6,
                padding: '2px 8px', fontSize: 9.5, fontWeight: 700, color: typeColor }}>
                {TYPE_LABEL[t.type]}
              </span>
              <span style={{ background: `${domaineColor}12`, borderRadius: 6,
                padding: '2px 8px', fontSize: 9.5, fontWeight: 700, color: domaineColor }}>
                {t.domaine}
              </span>
              {t.nb_rows && (
                <span style={{ fontSize: 10, color: 'rgba(31,59,114,.35)', fontWeight: 500 }}>
                  {t.nb_rows} lignes
                </span>
              )}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'rgba(31,59,114,.6)',
              lineHeight: 1.55, maxWidth: 720 }}>
              {t.description}
            </p>

            {/* APIs */}
            <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
              {t.apis.map(api => (
                <span key={api} style={{ background: 'rgba(8,145,178,.08)', borderRadius: 5,
                  padding: '2px 7px', fontSize: 10, fontWeight: 600, color: '#0891B2',
                  fontFamily: 'monospace' }}>
                  {api}
                </span>
              ))}
            </div>
          </div>

          {/* Métadonnées droite */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
            gap: 6, flexShrink: 0 }}>
            {t.owner && (
              <span style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', fontWeight: 500 }}>
                Owner : <strong>{t.owner}</strong>
              </span>
            )}
            <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(31,59,114,.4)' }}>
              {t.columns.length} colonnes
            </span>
            <div style={{ color: 'rgba(31,59,114,.4)', transition: 'transform .2s',
              transform: open ? 'rotate(0deg)' : 'rotate(0deg)' }}>
              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Colonnes (dépliable) ── */}
      {open && (
        <div style={{ borderTop: '1px solid rgba(31,59,114,.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(31,59,114,.03)' }}>
                {['Colonne', 'Type', 'Description', 'Exemple', 'Contrainte'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left',
                    fontSize: 9, fontWeight: 800, letterSpacing: '.1em',
                    textTransform: 'uppercase', color: 'rgba(31,59,114,.4)',
                    borderBottom: '1px solid rgba(31,59,114,.06)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.columns.map(col => <ColumnRow key={col.name} col={col} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
════════════════════════════════════════════════════════════════════════════ */
export default function CatalogPage() {
  const [search,  setSearch]  = useState('')
  const [base,    setBase]    = useState<string>('all')
  const [domaine, setDomaine] = useState<string>('all')
  const [monthLabel, setMonthLabel] = useState('')
  useEffect(() => {
    setMonthLabel(new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))
  }, [])

  const bases    = Array.from(new Set(CATALOG.map(t => t.base)))
  const domaines = Array.from(new Set(CATALOG.map(t => t.domaine)))

  const filtered = CATALOG.filter(t => {
    const q = search.toLowerCase()
    const matchSearch = !q || t.table.toLowerCase().includes(q)
      || t.schema.toLowerCase().includes(q)
      || t.description.toLowerCase().includes(q)
      || t.columns.some(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    const matchBase    = base    === 'all' || t.base    === base
    const matchDomaine = domaine === 'all' || t.domaine === domaine
    return matchSearch && matchBase && matchDomaine
  })

  return (
    <>
      <TopBar title="Catalogue de Données"
        subtitle="Inventaire des tables · Colonnes · Sources · APIs" />

      <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '24px 28px' }}>

        {/* ── Fil d'ariane ── */}
        <div style={{ marginBottom: 20 }}>
          <Link href="/dashboard/gouvernance"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: 'rgba(31,59,114,.5)', textDecoration: 'none', fontWeight: 600 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#1F3B72')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(31,59,114,.5)')}>
            <ChevronLeft size={14} /> Data Gouvernance
          </Link>
        </div>

        {/* ── Hero ── */}
        <div style={{ background: 'linear-gradient(135deg,#1F3B72 0%,#162c58 100%)',
          borderRadius: 16, padding: '24px 28px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 20,
          boxShadow: '0 4px 20px rgba(31,59,114,.18)' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: 'rgba(150,193,30,.15)', border: '1px solid rgba(150,193,30,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={24} style={{ color: '#96C11E' }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-.01em' }}>
              Catalogue de Données SEN'EAU
            </div>
            <div style={{ fontSize: 11, color: 'rgba(232,237,248,.5)', marginTop: 3 }}>
              {CATALOG.length} tables documentées · {CATALOG.reduce((s,t)=>s+t.columns.length,0)} colonnes · 2 bases de données
            </div>
          </div>
          {/* Compteurs */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 24 }}>
            {[
              { label: 'sen_dwh', value: CATALOG.filter(t=>t.base==='sen_dwh').length, color: '#1F3B72' },
              { label: 'sen_ods', value: CATALOG.filter(t=>t.base==='sen_ods').length, color: '#0891B2' },
              { label: 'Domaines', value: domaines.length, color: '#96C11E' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 9, color: 'rgba(232,237,248,.4)', fontWeight: 600,
                  letterSpacing: '.05em', textTransform: 'uppercase' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filtres ── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)', color: 'rgba(31,59,114,.35)', pointerEvents: 'none' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher table, colonne, description…"
              style={{ width: '100%', boxSizing: 'border-box',
                padding: '9px 12px 9px 34px', borderRadius: 10,
                border: '1px solid rgba(31,59,114,.14)', fontSize: 12,
                color: '#1F3B72', background: '#fff', outline: 'none',
                fontFamily: "'Nunito', sans-serif" }} />
          </div>
          {/* Filtre base */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {['all', ...bases].map(b => (
              <button key={b} onClick={() => setBase(b)}
                style={{ padding: '7px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', border: '1px solid',
                  borderColor: base === b ? '#1F3B72' : 'rgba(31,59,114,.15)',
                  background: base === b ? '#1F3B72' : '#fff',
                  color: base === b ? '#fff' : 'rgba(31,59,114,.5)',
                  fontFamily: "'Nunito', sans-serif" }}>
                {b === 'all' ? 'Toutes les bases' : b}
              </button>
            ))}
          </div>
          {/* Filtre domaine */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {['all', ...domaines].map(d => (
              <button key={d} onClick={() => setDomaine(d)}
                style={{ padding: '7px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', border: '1px solid',
                  borderColor: domaine === d ? (DOMAINE_COLOR[d] ?? '#1F3B72') : 'rgba(31,59,114,.15)',
                  background: domaine === d ? (DOMAINE_COLOR[d] ?? '#1F3B72') : '#fff',
                  color: domaine === d ? '#fff' : 'rgba(31,59,114,.5)',
                  fontFamily: "'Nunito', sans-serif" }}>
                {d === 'all' ? 'Tous les domaines' : d}
              </button>
            ))}
          </div>
        </div>

        {/* ── Résultats ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0',
              color: 'rgba(31,59,114,.35)', fontSize: 13 }}>
              Aucune table ne correspond à votre recherche.
            </div>
          ) : (
            filtered.map(t => <TableCard key={t.id} t={t} />)
          )}
        </div>

        {/* ── Note bas de page ── */}
        <div style={{ marginTop: 32, padding: '14px 20px', borderRadius: 10,
          background: 'rgba(31,59,114,.04)', border: '1px solid rgba(31,59,114,.08)' }}>
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(31,59,114,.45)', lineHeight: 1.6 }}>
            <strong>Note :</strong> Ce catalogue est maintenu manuellement et reflète l'état documenté au{' '}
            {monthLabel || '…'}.
            Les cardinalités (nb_rows) sont des estimations. Pour les schémas exacts, consulter
            <code style={{ margin: '0 4px', background: 'rgba(31,59,114,.08)', borderRadius: 4,
              padding: '1px 5px', fontFamily: 'monospace' }}>information_schema.columns</code>
            sur chaque base.
          </p>
        </div>
      </div>
    </>
  )
}
