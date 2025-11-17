'use client'

import { useEffect, useState } from 'react'
import type { ScheduleEvent } from '../../../../lib/schemas/schedule'

interface Props {
  initialData: ScheduleEvent[]
}

export function ScheduleList({ initialData }: Props) {
  const [items, setItems] = useState<ScheduleEvent[]>(initialData)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/schedule')
      if (!res.ok) return
      const data = await res.json()
      setItems(data.items)
    }
    load()
  }, [])

  async function handleDelete(id: string) {
    await fetch(`/api/schedule/${id}`, { method: 'DELETE' })
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div>
      <h2>予定一覧</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>タイトル</th>
            <th>開始</th>
            <th>終了</th>
            <th>ステータス</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td>{new Date(item.startsAt).toLocaleString()}</td>
              <td>{new Date(item.endsAt).toLocaleString()}</td>
              <td>{item.status}</td>
              <td>
                <button onClick={() => handleDelete(item.id)} aria-label={`${item.title} を削除`} style={{ minHeight: 44 }}>
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
