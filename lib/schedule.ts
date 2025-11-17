import crypto from 'node:crypto'
import { listAirtableRecords, updateAirtableRecords, createAirtableRecords } from './db/airtable'
import { scheduleEventSchema, type ScheduleEvent, type CreateEventRequest, type UpdateEventRequest, type ListEventsQuery } from './schemas/schedule'

const DEFAULT_EVENT_TABLE = 'CalendarEvents'
const DEFAULT_COMPANY_TABLE = 'Companies'

function getEventTable() {
  return process.env.AIRTABLE_TABLE_CALENDAR_EVENTS || DEFAULT_EVENT_TABLE
}

function getCompanyTable() {
  return process.env.AIRTABLE_TABLE_COMPANIES || DEFAULT_COMPANY_TABLE
}

function toIsoDate(date: string | Date): string {
  if (!date) throw new Error('Invalid date')
  return typeof date === 'string' ? new Date(date).toISOString() : date.toISOString()
}

function mapEvent(record: { id: string; fields: Record<string, any> }): ScheduleEvent {
  const event: ScheduleEvent = {
    id: record.id,
    companyId: record.fields.companyId,
    title: record.fields.title,
    description: record.fields.description,
    startsAt: record.fields.startsAt,
    endsAt: record.fields.endsAt,
    timezone: record.fields.timezone,
    location: record.fields.location,
    attendees: record.fields.attendees,
    status: record.fields.status || 'scheduled',
    source: record.fields.source || 'manual',
    icalUid: record.fields.icalUid || `${record.id}@clas-z`,
    lastNotifiedAt: record.fields.lastNotifiedAt,
  }
  return scheduleEventSchema.parse(event)
}

export async function ensureCompanyCalendarToken(companyId: string): Promise<string> {
  const table = getCompanyTable()
  const records = await listAirtableRecords<{ calendarToken?: string }>(table, {
    filterByFormula: `{id}='${companyId}'`,
    fields: ['calendarToken'],
    maxRecords: 1,
  })

  const token = records[0]?.fields.calendarToken
  if (token) return token

  const newToken = crypto.randomUUID()
  await updateAirtableRecords(table, [
    {
      id: companyId,
      fields: { calendarToken: newToken },
    },
  ])
  return newToken
}

function formatICSDate(dateIso: string): string {
  const date = new Date(dateIso)
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export function toICS(event: ScheduleEvent, opts?: { prodId?: string }): string {
  const dtstamp = formatICSDate(new Date().toISOString())
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.icalUid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${formatICSDate(event.startsAt)}`,
    `DTEND:${formatICSDate(event.endsAt)}`,
    `SUMMARY:${event.title}`,
  ]
  if (event.description) lines.push(`DESCRIPTION:${event.description}`)
  if (event.location) lines.push(`LOCATION:${event.location}`)
  lines.push('END:VEVENT')
  return lines.join('\r\n')
}

export function toICSFeed(events: ScheduleEvent[], input: { companyName: string; timezone?: string }): string {
  const prodId = '-//careerme//schedule//EN'
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${prodId}`]
  events.forEach((event) => {
    lines.push(toICS(event, { prodId }))
  })
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

export async function listEvents(query: ListEventsQuery): Promise<{ items: ScheduleEvent[]; nextCursor?: string }> {
  const table = getEventTable()
  const filters: string[] = []
  if (query.from) filters.push(`IS_AFTER({startsAt}, '${query.from}')`)
  if (query.to) filters.push(`IS_BEFORE({startsAt}, '${query.to}')`)
  if (query.status && query.status !== 'all') filters.push(`{status}='${query.status}'`)

  const records = await listAirtableRecords<Record<string, any>>(table, {
    filterByFormula: filters.length ? `AND(${filters.join(',')})` : undefined,
    pageSize: query.limit ?? 25,
    fields: [
      'companyId',
      'title',
      'description',
      'startsAt',
      'endsAt',
      'timezone',
      'location',
      'attendees',
      'status',
      'source',
      'icalUid',
      'lastNotifiedAt',
    ],
  })

  const items = records.map(mapEvent)
  return { items }
}

export async function createEvent(companyId: string, payload: CreateEventRequest): Promise<string> {
  const table = getEventTable()
  const [record] = await createAirtableRecords<Record<string, any>>(table, [
    {
      fields: {
        companyId,
        title: payload.title,
        description: payload.description,
        startsAt: toIsoDate(payload.startsAt),
        endsAt: toIsoDate(payload.endsAt),
        timezone: payload.timezone,
        location: payload.location,
        attendees: payload.attendees,
        status: 'scheduled',
        source: 'manual',
      },
    },
  ])

  await updateAirtableRecords(table, [
    {
      id: record.id,
      fields: { icalUid: `${record.id}@clas-z` },
    },
  ])

  return record.id
}

export async function updateEvent(eventId: string, payload: UpdateEventRequest): Promise<void> {
  const table = getEventTable()
  await updateAirtableRecords<Record<string, any>>(table, [
    {
      id: eventId,
      fields: {
        ...payload,
        startsAt: payload.startsAt ? toIsoDate(payload.startsAt) : undefined,
        endsAt: payload.endsAt ? toIsoDate(payload.endsAt) : undefined,
      },
    },
  ])
}

export async function getEventById(eventId: string): Promise<ScheduleEvent | null> {
  const table = getEventTable()
  const records = await listAirtableRecords<Record<string, any>>(table, {
    filterByFormula: `{id}='${eventId}'`,
    maxRecords: 1,
  })
  if (!records.length) return null
  return mapEvent(records[0])
}

export async function softDeleteEvent(eventId: string): Promise<void> {
  await updateEvent(eventId, { status: 'cancelled' })
}
