/**
 * POST /api/alerts/run
 * Déclenche le moteur de détection des alertes.
 * Appelé automatiquement depuis POST /api/scheduler/run (quotidien à 7h)
 * ou manuellement depuis l'interface d'administration.
 *
 * Sécurisé par le même SCHEDULER_SECRET que le scheduler.
 *
 * Appel cron exemple (en plus du scheduler) :
 *   0 7 * * * curl -X POST http://portal.seneau.sn/api/alerts/run \
 *     -H "Authorization: Bearer $SCHEDULER_SECRET"
 */
import { NextResponse } from 'next/server'
import { runAlertEngine } from '@/lib/alertEngine'

export async function POST(req: Request) {
  /* Vérification token (optionnel si appelé en interne) */
  const secret = process.env.SCHEDULER_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const result = await runAlertEngine()
    return NextResponse.json({
      ok:      true,
      checked: result.checked,
      errors:  result.errors,
      ran_at:  new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/alerts/run]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
