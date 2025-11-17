import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getEventById, updateEvent, softDeleteEvent } from '../../../../lib/schedule'
import { trackEvent } from '../../../../lib/events'
import { updateEventRequestSchema, type ApiError } from '../../../../lib/schemas/schedule'

export const runtime = 'node'

function errorResponse(status: number, message: string, correlationId: string) {
  const body: ApiError = { error: { code: String(status), message }, correlationId }
  return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } })
}

export async function GET(_request: NextRequest, { params }: { params: { eventId: string } }) {
  const correlationId = crypto.randomUUID()
  try {
    const event = await getEventById(params.eventId)
    if (!event) return errorResponse(404, 'Not found', correlationId)
    return NextResponse.json({ event, correlationId }, { headers: { 'x-correlation-id': correlationId } })
  } catch (error) {
    console.error(error)
    return errorResponse(500, 'Failed to fetch event', correlationId)
  }
}

export async function PUT(request: NextRequest, { params }: { params: { eventId: string } }) {
  const correlationId = crypto.randomUUID()
  try {
    const body = await request.json()
    const parsed = updateEventRequestSchema.safeParse(body)
    if (!parsed.success) return errorResponse(400, 'Invalid payload', correlationId)
    await updateEvent(params.eventId, parsed.data)
    await trackEvent({ type: 'schedule.updated', correlationId, payload: { eventId: params.eventId } })
    return NextResponse.json({ ok: true, correlationId }, { headers: { 'x-correlation-id': correlationId } })
  } catch (error) {
    console.error(error)
    return errorResponse(500, 'Failed to update event', correlationId)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { eventId: string } }) {
  const correlationId = crypto.randomUUID()
  try {
    await softDeleteEvent(params.eventId)
    await trackEvent({ type: 'schedule.cancelled', correlationId, payload: { eventId: params.eventId } })
    return NextResponse.json({ ok: true, correlationId }, { headers: { 'x-correlation-id': correlationId } })
  } catch (error) {
    console.error(error)
    return errorResponse(500, 'Failed to delete event', correlationId)
  }
}
