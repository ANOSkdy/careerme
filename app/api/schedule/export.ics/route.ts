import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ensureCompanyCalendarToken, listEvents, toICSFeed } from '../../../../lib/schedule'
import { trackEvent } from '../../../../lib/events'
import { icsExportQuerySchema, type ApiError } from '../../../../lib/schemas/schedule'

export const runtime = 'node'

function errorResponse(status: number, message: string, correlationId: string) {
  const body: ApiError = { error: { code: String(status), message }, correlationId }
  return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } })
}

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID()
  try {
    const parsed = icsExportQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
    if (!parsed.success) return errorResponse(400, 'Invalid query', correlationId)

    const companyToken = parsed.data.token
    const companyId = companyToken
    await ensureCompanyCalendarToken(companyId)
    const { items } = await listEvents({ status: 'scheduled' })
    const feed = toICSFeed(items, { companyName: 'Company' })
    await trackEvent({ type: 'schedule.ics.viewed', correlationId })
    return new NextResponse(feed, {
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'cache-control': 'public, s-maxage=300, stale-while-revalidate=86400',
        'x-correlation-id': correlationId,
      },
    })
  } catch (error) {
    console.error(error)
    return errorResponse(500, 'Failed to export calendar', correlationId)
  }
}
