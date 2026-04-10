'use client'
import TopBar from '@/components/TopBar'
import RapportsPlanifiesPanel from '@/components/RapportsPlanifiesPanel'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function RapportsPlanifiesPage() {
  return (
    <>
      <TopBar title="Rapports Planifiés" subtitle="Envoi automatique · PDF/Excel · Email" />

      <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '24px 28px', fontFamily: "'Nunito', sans-serif" }}>

        {/* Fil d'ariane */}
        <div style={{ marginBottom: 20 }}>
          <Link href="/dashboard/admin"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: 'rgba(31,59,114,.45)', textDecoration: 'none', fontWeight: 600 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#1F3B72')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(31,59,114,.45)')}>
            <ChevronLeft size={14} /> Administration
          </Link>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1F3B72', margin: 0 }}>
            Rapports Planifiés
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(31,59,114,.42)' }}>
            Vue d'ensemble de toutes les planifications actives sur la plateforme
          </p>
        </div>

        <RapportsPlanifiesPanel />
      </div>
    </>
  )
}
