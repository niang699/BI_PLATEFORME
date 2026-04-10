/**
 * GET  /api/scheduler/plans  — liste toutes les planifications
 * POST /api/scheduler/plans  — crée une nouvelle planification
 */
import { NextResponse } from 'next/server'
import { listPlans, createPlan } from '@/lib/schedulerDb'
import type { ReportFrequence } from '@/lib/schedulerDb'

/* Correspondance fréquence → expression cron */
const CRON_MAP: Record<ReportFrequence, string> = {
  daily:   '0 7 * * *',
  weekly:  '0 7 * * 1',
  monthly: '0 7 1 * *',
}

export async function GET() {
  try {
    const plans = await listPlans()
    return NextResponse.json(plans)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const frequence: ReportFrequence = body.frequence ?? 'monthly'
    const cron_expr = CRON_MAP[frequence] ?? CRON_MAP.monthly

    const plan = await createPlan({
      name:           body.name,
      rapport_id:     body.rapport_id,
      filtres:        body.filtres ?? {},
      format:         body.format ?? 'xlsx',
      frequence,
      cron_expr,
      destinataires:  body.destinataires ?? [],
      sujet:          body.sujet ?? body.name,
      actif:          body.actif ?? true,
      created_by:     body.created_by ?? 'admin',
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
