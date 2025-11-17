import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { trackEvent } from '../../../lib/events'
import { listEvents, createEvent } from '../../../lib/schedule'
import {
  listEventsQuerySchema,
  createEventRequestSchema,
  type ApiError,
} from '../../../lib/schemas/schedule'

export const runtime = 'node'

function errorResponse(status: number, message: string, correlationId: string) {
  const body: ApiError = {
    error: { code: String(status), message },
    correlationId,
  }
  return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } })
}

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID()
  try {
    const parsed = listEventsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
    if (!parsed.success) {
      return errorResponse(400, 'Invalid query', correlationId)
    }

    const result = await listEvents(parsed.data)
    return NextResponse.json(result, { headers: { 'x-correlation-id': correlationId } })
  } catch (error) {
    console.error(error)
    return errorResponse(500, 'Failed to list events', correlationId)
  }
}

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID()
  try {
    const body = await request.json()
    const parsed = createEventRequestSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(400, 'Invalid payload', correlationId)
    }

    const companyId = request.headers.get('x-company-id') || 'default-company'
    const eventId = await createEvent(companyId, parsed.data)
    await trackEvent({ type: 'schedule.created', correlationId, payload: { eventId } })
    return NextResponse.json({ eventId, correlationId }, { headers: { 'x-correlation-id': correlationId } })
  } catch (error) {
    console.error(error)
    return errorResponse(500, 'Failed to create event', correlationId)
  }
}
