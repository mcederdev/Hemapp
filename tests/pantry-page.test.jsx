// Skafferi-fliken ska gå att rita upp med länken till listan över skafferivaror.
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

vi.mock('../src/useTable', () => ({ useTable: () => ({ rows: [{ id: 'p', name: 'Pasta', place: 'skafferi' }], insert: vi.fn(), update: vi.fn(), remove: vi.fn() }) }))
vi.mock('../src/supabase', () => ({ supabase: {} }))
const { default: Pantry } = await import('../src/components/Pantry.jsx')

describe('sidan Skafferi', () => {
  it('ritas upp med länken "Vad räknas som skafferivaror?"', () => {
    const html = renderToString(createElement(Pantry, { householdId: 'h', onOut: () => {} }))
    expect(html).toContain('Pasta')
    expect(html).toContain('Vad räknas som skafferivaror?')
  })
})
