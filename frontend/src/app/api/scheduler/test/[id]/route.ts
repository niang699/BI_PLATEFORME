/**
 * POST /api/scheduler/test/[id]
 * Envoie immédiatement le rapport sans attendre la planification.
 * Utile pour valider la configuration avant activation.
 */
import { NextResponse } from 'next/server'
import { getPlan, updatePlan } from '@/lib/schedulerDb'
import { generateExcel, emailHtml } from '@/lib/reportExcel'
import transporter, { FROM } from '@/lib/mailer'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id   = parseInt(params.id, 10)
    const plan = await getPlan(id)
    if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      ?? `http://localhost:${process.env.PORT ?? 3000}`

    const dateStr = new Date().toLocaleDateString('fr-FR',
      { day:'2-digit', month:'2-digit', year:'numeric' }).replace(/\//g, '-')

    const bodyHtml = emailHtml(plan.name, plan.rapport_id, plan.filtres, plan.format)

    let filename: string
    let content: Buffer
    let contentType: string

    if (plan.format === 'pdf') {
      /* ── Format PDF ── */
      const res = await fetch(`${baseUrl}/api/rapports/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rapport_id: plan.rapport_id, filtres: plan.filtres }),
      })
      if (!res.ok) throw new Error(`Génération PDF échouée : ${await res.text()}`)
      const pdfHtml = await res.text()
      filename    = `${plan.rapport_id}_test_${dateStr}.html`
      content     = Buffer.from(pdfHtml, 'utf-8')
      contentType = 'text/html; charset=utf-8'
    } else {
      /* ── Format Excel (défaut) ── */
      filename    = `${plan.rapport_id}_test_${dateStr}.xlsx`
      content     = await generateExcel(plan.rapport_id, plan.filtres, baseUrl)
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }

    await transporter.sendMail({
      from:    FROM,
      to:      plan.destinataires.join(', '),
      subject: `[TEST] ${plan.sujet}`,
      html:    bodyHtml,
      attachments: [{ filename, content, contentType }],
    })

    await updatePlan(id, {
      derniere_exec:  new Date().toISOString(),
      dernier_statut: 'ok',
    })

    return NextResponse.json({ success: true, to: plan.destinataires, filename })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
