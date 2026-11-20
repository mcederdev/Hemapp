// Sidan Lämna och hämta ska gå att rita upp, även en dag med VAB (kraschade 2026-11-20).
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

const DAY = new Date().toLocaleDateString('sv-SE')
const tables = {
  pickups: [],
  vab_days: [{ id: 'v', kind: 'vab', child_id: 'juhani', day: DAY, parent_id: 'magnus', full_day: true }],
  events: [{ id: 's', member_id: 'juhani', title: 'Skola', category: 'skola', starts_at: `${DAY}T08:15:00`, ends_at: `${DAY}T14:00:00` }],
}
vi.mock('../src/useTable', () => ({ useTable: (t) => ({ rows: tables[t] || [], insert: vi.fn(), update: vi.fn() }) }))
vi.mock('../src/supabase', () => ({ supabase: {} }))
const { PickupsPage, default: Pickups } = await import('../src/components/Pickups.jsx')

const members = [
  { id: 'magnus', name: 'Magnus', role: 'parent', household_id: 'h' },
  { id: 'juhani', name: 'Juhani', role: 'child', household_id: 'h' },
]
const props = { householdId: 'h', members, people: members, me: members[0], custody: [], go: () => {} }

describe('sidan Lämna och hämta', () => {
  it('visar "Juhani är hemma, Magnus vabbar" utan att krascha', () => {
    const html = renderToString(createElement(PickupsPage, props))
    expect(html).toContain('Juhani är hemma, Magnus vabbar')
    expect(html).not.toContain('Hämta 14:00')
  })
  it('rutan på Idag kraschar inte heller', () => {
    expect(() => renderToString(createElement(Pickups, { ...props, events: tables.events }))).not.toThrow()
  })
})
