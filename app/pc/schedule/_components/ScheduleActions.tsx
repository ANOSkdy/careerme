'use client'

import { useState } from 'react'

export function ScheduleActions() {
  const [proposals, setProposals] = useState<any[]>([])
  const [message, setMessage] = useState<string | null>(null)

  async function handleSuggest() {
    setMessage(null)
    const res = await fetch('/api/schedule/suggest', { method: 'POST' })
    if (!res.ok) {
      setMessage('提案取得に失敗しました')
      return
    }
    const data = await res.json()
    setProposals(data.proposals)
  }

  async function accept(proposal: any) {
    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(proposal),
    })
    setMessage('追加しました')
  }

  async function copyFeedUrl() {
    const url = `${window.location.origin}/api/schedule/export.ics?token=default-company`
    await navigator.clipboard.writeText(url)
    setMessage('ICS URL をコピーしました')
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={handleSuggest} style={{ minHeight: 44 }}>
          Auto-generate
        </button>
        <button onClick={copyFeedUrl} style={{ minHeight: 44 }}>
          ICS URL をコピー
        </button>
      </div>
      {message ? <p aria-live="polite">{message}</p> : null}
      {proposals.length ? (
        <div>
          <h3>提案</h3>
          <ul style={{ display: 'grid', gap: 8 }}>
            {proposals.map((proposal, idx) => (
              <li key={idx} style={{ border: '1px solid #ddd', padding: 8 }}>
                <div>{proposal.title}</div>
                <div>
                  {new Date(proposal.startsAt).toLocaleString()} - {new Date(proposal.endsAt).toLocaleString()}
                </div>
                <button onClick={() => accept(proposal)} style={{ minHeight: 44 }}>
                  追加
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
