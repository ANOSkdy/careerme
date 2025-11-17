import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getEventById, updateEvent, softDeleteEvent } from '../../../../lib/schedule'
import { trackEvent } from '../../../../lib/events'
import { updateEventRequestSchema, type ApiError } from '../../../../lib/schemas/schedule'

export const runtime = 'nodejs'

function errorResponse(status: number, message: string, correlationId: string) {
  const body: ApiError = { error: { code: String(status), message }, correlationId }
  return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const correlationId = crypto.randomUUID()
  try {
    const { eventId } = await params
    const event = await getEventById(eventId)
    if (!event) return errorResponse(404, 'Not found', correlationId)
    return NextResponse.json({ event, correlationId }, { headers: { 'x-correlation-id': correlationId } })
  } catch (error) {
    console.error(error)
    return errorResponse(500, 'Failed to fetch event', correlationId)
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const correlationId = crypto.randomUUID()
  try {
    const { eventId } = await params
    const body = await request.json()
    const parsed = updateEventRequestSchema.safeParse(body)
    if (!parsed.success) return errorResponse(400, 'Invalid payload', correlationId)
    await updateEvent(eventId, parsed.data)
    await trackEvent({ type: 'schedule.updated', correlationId, payload: { eventId } })
    return NextResponse.json({ ok: true, correlationId }, { headers: { 'x-correlation-id': correlationId } })
  } catch (error) {
    console.error(error)
    return errorResponse(500, 'Failed to update event', correlationId)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const correlationId = crypto.randomUUID()
  try {
    const { eventId } = await params
    await softDeleteEvent(eventId)
    await trackEvent({ type: 'schedule.cancelled', correlationId, payload: { eventId } })
    return NextResponse.json({ ok: true, correlationId }, { headers: { 'x-correlation-id': correlationId } })
  } catch (error) {
    console.error(error)
    return errorResponse(500, 'Failed to delete event', correlationId)
  }
}
