import { type ScheduleEvent } from './schemas/schedule'

export async function suggestSchedule(input: {
  companyId: string
  windowStart?: string
  windowEnd?: string
  seed?: string
}): Promise<Array<Omit<ScheduleEvent, 'id' | 'companyId' | 'icalUid' | 'status' | 'source' | 'createdAt' | 'updatedAt'>>> {
  const now = new Date()
  const inHours = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString()

  return [
    {
      title: 'Review Session',
      description: input.seed ? `Seed: ${input.seed}` : undefined,
      startsAt: input.windowStart || inHours(48),
      endsAt: input.windowEnd || inHours(49),
      attendees: [],
      location: 'Online',
      timezone: 'UTC',
    },
    {
      title: 'Handoff Meeting',
      description: 'Coordinate project handoff',
      startsAt: input.windowStart || inHours(72),
      endsAt: input.windowEnd || inHours(73),
      attendees: [],
      location: 'Online',
      timezone: 'UTC',
    },
  ]
}
