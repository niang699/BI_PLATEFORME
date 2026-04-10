/**
 * POST /api/scheduler/run
 * Point d'entrée appelé par un cron Linux externe (ou manuellement).
 * Exécute toutes les planifications actives dont la fréquence correspond
 * à la période courante (daily = tous les jours, weekly = lundi, monthly = 1er du mois).
 *
 * Sécurisé par bearer token : SCHEDULER_SECRET
 *
 * Appel cron Linux exemple :
 *   0 7 * * * curl -X POST https://portal.seneau.sn/api/scheduler/run \
 *     -H "Authorization: Bearer $SCHEDULER_SECRET"
 */
import { NextResponse } from 'next/server'
import { getActivePlans, updatePlan } from '@/lib/schedulerDb'
import { generateExcel, emailHtml } from '@/lib/reportExcel'
import transporter, { FROM } from '@/lib/mailer'

/* ─── Génère le HTML PDF-ready via la route /api/rapports/generate ──────── */
async function generatePdfHtml(
  rapportId: string,
  filtres: Record<string, string>,
  baseUrl: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/rapports/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ rapport_id: rapportId, filtres }),
  })
  if (!res.ok) throw new Error(`Génération PDF échouée : ${await res.text()}`)
  return res.text()
}

/* ─── Détermine si un plan doit tourner maintenant ────────────────────────── */
function shouldRun(frequence: string): boolean {
  const now = new Date()
  if (frequence === 'daily')   return true
  if (frequence === 'weekly')  return now.getDay() === 1   // lundi
  if (frequence === 'monthly') return now.getDate() === 1  // 1er du mois
  return false
}

/* ─── Exécute un plan ────────────────────────────────────────────────────── */
async function runPlan(plan: Awaited<ReturnType<typeof getActivePlans>>[number], baseUrl: string) {
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).replace(/\//g, '-')

  const subject = plan.sujet
    .replace('{date}', dateStr)
    .replace('{annee}', plan.filtres.annee ?? String(new Date().getFullYear()))

  if (plan.format === 'pdf') {
    /* ── Format PDF : HTML stylé en pièce jointe ── */
    const pdfHtml = await generatePdfHtml(plan.rapport_id, plan.filtres, baseUrl)
    const filename = `${plan.rapport_id}_${dateStr}.html`
    const bodyHtml = emailHtml(plan.name, plan.rapport_id, plan.filtres, plan.format)

    await transporter.sendMail({
      from:        FROM,
      to:          plan.destinataires.join(', '),
      subject,
      html:        bodyHtml,
      attachments: [{
        filename,
        content:     Buffer.from(pdfHtml, 'utf-8'),
        contentType: 'text/html; charset=utf-8',
      }],
    })
  } else {
    /* ── Format Excel (défaut) ── */
    const filename = `${plan.rapport_id}_${dateStr}.xlsx`
    const buffer   = await generateExcel(plan.rapport_id, plan.filtres, baseUrl)
    const bodyHtml = emailHtml(plan.name, plan.rapport_id, plan.filtres, plan.format)

    await transporter.sendMail({
      from:        FROM,
      to:          plan.destinataires.join(', '),
      subject,
      html:        bodyHtml,
      attachments: [{
        filename,
        content:     buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }],
    })
  }
}

/* ─── Handler ────────────────────────────────────────────────────────────── */
export async function POST(req: Request) {
  /* Vérification du token */
  const secret = process.env.SCHEDULER_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    ?? `http://localhost:${process.env.PORT ?? 3000}`

  let plans: Awaited<ReturnType<typeof getActivePlans>>
  try {
    plans = await getActivePlans()
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const due     = plans.filter(p => shouldRun(p.frequence))
  const results: { id: number; name: string; status: 'ok' | 'error'; error?: string }[] = []

  for (const plan of due) {
    try {
      await runPlan(plan, baseUrl)
      await updatePlan(plan.id, {
        derniere_exec:  new Date().toISOString(),
        dernier_statut: 'ok',
      })
      results.push({ id: plan.id, name: plan.name, status: 'ok' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await updatePlan(plan.id, {
        derniere_exec:  new Date().toISOString(),
        dernier_statut: 'error',
      }).catch(() => {})
      results.push({ id: plan.id, name: plan.name, status: 'error', error: msg })
    }
  }

  /* ── Déclencher le moteur d'alertes après les rapports planifiés ── */
  let alertsResult: { checked?: string[]; errors?: string[] } = {}
  try {
    const alertRes = await fetch(`${baseUrl}/api/alerts/run`, {
      method:  'POST',
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    })
    if (alertRes.ok) alertsResult = await alertRes.json()
  } catch { /* non bloquant */ }

  return NextResponse.json({
    ran:           results.length,
    total:         plans.length,
    due:           due.length,
    results,
    alerts_engine: alertsResult,
  })
}
