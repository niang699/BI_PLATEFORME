/**
 * PUT    /api/scheduler/plans/[id]  — met à jour une planification
 * DELETE /api/scheduler/plans/[id]  — supprime une planification
 */
import { NextResponse } from 'next/server'
import { updatePlan, deletePlan } from '@/lib/schedulerDb'

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id   = parseInt(params.id, 10)
    const body = await req.json()
    const plan = await updatePlan(id, body)
    if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(plan)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    const ok = await deletePlan(id)
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
