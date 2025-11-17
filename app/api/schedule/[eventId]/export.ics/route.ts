import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getEventById, toICS } from '../../../../../lib/schedule'
import { icsExportQuerySchema, type ApiError } from '../../../../../lib/schemas/schedule'
import { trackEvent } from '../../../../../lib/events'

export const runtime = 'nodejs'

function errorResponse(status: number, message: string, correlationId: string) {
  const body: ApiError = { error: { code: String(status), message }, correlationId }
  return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const correlationId = crypto.randomUUID()
  try {
    const { eventId } = await params
    const parsed = icsExportQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
    if (!parsed.success) return errorResponse(400, 'Invalid query', correlationId)

    const event = await getEventById(eventId)
    if (!event) return errorResponse(404, 'Not found', correlationId)

    const body = toICS(event)
    await trackEvent({ type: 'schedule.ics.viewed', correlationId, payload: { eventId } })
    return new NextResponse(body + '\r\n', {
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'x-correlation-id': correlationId,
      },
    })
  } catch (error) {
    console.error(error)
    return errorResponse(500, 'Failed to export event', correlationId)
  }
}
