'use client'

import { useState } from 'react'
import type { CreateEventRequest } from '../../../../lib/schemas/schedule'

export function EventEditor() {
  const [form, setForm] = useState<CreateEventRequest>({
    title: '',
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    description: '',
    location: '',
    attendees: [],
  })

  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setMessage('作成しました')
    } else {
      setMessage('作成に失敗しました')
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 8 }} aria-live="polite">
      <h2>予定を追加</h2>
      <label>
        タイトル
        <input
          required
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          style={{ minHeight: 44 }}
        />
      </label>
      <label>
        開始
        <input
          type="datetime-local"
          value={form.startsAt.slice(0, 16)}
          onChange={(e) => setForm((f) => ({ ...f, startsAt: new Date(e.target.value).toISOString() }))}
          style={{ minHeight: 44 }}
        />
      </label>
      <label>
        終了
        <input
          type="datetime-local"
          value={form.endsAt.slice(0, 16)}
          onChange={(e) => setForm((f) => ({ ...f, endsAt: new Date(e.target.value).toISOString() }))}
          style={{ minHeight: 44 }}
        />
      </label>
      <label>
        説明
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          style={{ minHeight: 80 }}
        />
      </label>
      <button type="submit" style={{ minHeight: 44 }}>
        追加
      </button>
      {message ? <p>{message}</p> : null}
    </form>
  )
}
