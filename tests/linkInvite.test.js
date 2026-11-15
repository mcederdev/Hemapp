import { describe, it, expect } from 'vitest'
import { linkInviteVerdict, isMissingFunction } from '../src/lib/linkInvite.js'

describe('Delad vårdnad: kontroll av D-kod', () => {
  it('fel eller använd kod ger fel innan hushållet skapas', () => {
    expect(linkInviteVerdict({ ok: false, error: 'Koden är redan använd. Be om en ny.' }))
      .toEqual({ error: 'Koden är redan använd. Be om en ny.' })
  })
  it('ny koppling utan andra hem ger ingen varning', () => {
    expect(linkInviteVerdict({ ok: true, children: 'Juhani', already_linked: [] })).toEqual({})
  })
  it('Fixad bugg: barnet delas redan med ett hem → varna och föreslå Gå med i min familj', () => {
    const v = linkInviteVerdict({ ok: true, children: 'Juhani', already_linked: ['Familjen Åberg'] })
    expect(v.warning).toContain('Juhani delas redan med Familjen Åberg')
    expect(v.warning).toContain('Gå med i min familj')
  })
  it('saknad databasfunktion känns igen så att appen fungerar som förut', () => {
    expect(isMissingFunction({ code: 'PGRST202' })).toBe(true)
    expect(isMissingFunction({ code: '42501' })).toBe(false)
    expect(isMissingFunction(null)).toBe(false)
  })
})
