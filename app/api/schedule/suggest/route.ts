import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { suggestSchedule } from '../../../../lib/ai'
import { trackEvent } from '../../../../lib/events'
import { suggestScheduleRequestSchema, type ApiError } from '../../../../lib/schemas/schedule'

export const runtime = 'node'

function errorResponse(status: number, message: string, correlationId: string) {
  const body: ApiError = { error: { code: String(status), message }, correlationId }
  return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } })
}

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID()
  try {
    const body = await request.json()
    const parsed = suggestScheduleRequestSchema.safeParse(body)
    if (!parsed.success) return errorResponse(400, 'Invalid payload', correlationId)
    const companyId = request.headers.get('x-company-id') || 'default-company'
    const proposals = await suggestSchedule({ ...parsed.data, companyId })
    await trackEvent({ type: 'schedule.suggested', correlationId })
    return NextResponse.json({ proposals, correlationId }, { headers: { 'x-correlation-id': correlationId } })
  } catch (error) {
    console.error(error)
    return errorResponse(500, 'Failed to suggest schedule', correlationId)
  }
}
