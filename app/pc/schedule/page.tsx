import { listEvents } from '../../../lib/schedule'
import { ScheduleList } from './_components/ScheduleList'
import { EventEditor } from './_components/EventEditor'
import { ScheduleActions } from './_components/ScheduleActions'

export default async function SchedulePage() {
  let items = [] as Awaited<ReturnType<typeof listEvents>>['items']
  try {
    const result = await listEvents({})
    items = result.items
  } catch (error) {
    console.error('Failed to load schedule', error)
  }

  return (
    <main style={{ display: 'grid', gap: 24 }}>
      <header>
        <h1>スケジュール</h1>
        <p>予定の一覧と作成、提案受け入れができます。</p>
      </header>
      <ScheduleActions />
      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: '1fr 1fr' }}>
        <ScheduleList initialData={items} />
        <EventEditor />
      </div>
    </main>
  )
}
