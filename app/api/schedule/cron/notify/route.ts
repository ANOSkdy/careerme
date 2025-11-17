import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { listEvents, updateEvent } from '../../../../../lib/schedule'
import { trackEvent } from '../../../../../lib/events'
import { type ApiError } from '../../../../../lib/schemas/schedule'

export const runtime = 'node'

function errorResponse(status: number, message: string, correlationId: string) {
  const body: ApiError = { error: { code: String(status), message }, correlationId }
  return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } })
}

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID()
  if (!request.headers.get('x-vercel-cron')) {
    return errorResponse(401, 'Unauthorized', correlationId)
  }

  try {
    const now = new Date()
    const from = new Date(now.getTime() + 60 * 60 * 1000)
    const to = new Date(now.getTime() + 120 * 60 * 1000)
    const { items } = await listEvents({ from: from.toISOString(), to: to.toISOString(), status: 'scheduled' })
    const pending = items.filter((event) => !event.lastNotifiedAt)

    for (const event of pending) {
      await trackEvent({ type: 'schedule.notify.sent', correlationId, payload: { eventId: event.id } })
      await updateEvent(event.id, { lastNotifiedAt: new Date().toISOString() })
    }

    return NextResponse.json({ sent: pending.length, correlationId }, { headers: { 'x-correlation-id': correlationId } })
  } catch (error) {
    console.error(error)
    return errorResponse(500, 'Failed to send notifications', correlationId)
  }
}
