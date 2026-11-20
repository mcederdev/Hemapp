import { describe, it, expect } from 'vitest'
import { guessSection } from '../src/lib/sections.js'
import { pantryPlace, isPantryStaple } from '../src/lib/refill.js'
import { placeFromCategories } from '../src/lib/barcode.js'
import { PANTRY_WORDS, PANTRY_GROUPS } from '../src/lib/pantryStaples.js'

const place = (name, section) => pantryPlace({ name, section })?.place ?? null

describe('Skafferivaror', () => {
  it('Magnus lista räknas som skafferivaror', () => {
    const names = [
      'Pasta', 'Spaghetti', 'Nudlar', 'Ris', 'Basmatiris', 'Bulgur', 'Couscous', 'Matvete', 'Havregryn', 'Rågflingor', 'Müsli', 'Frukostflingor',
      'Vetemjöl', 'Torrjäst', 'Knäckebröd', 'Skorpor', 'Kex', 'Tortillabröd',
      'Linser', 'Kidneybönor', 'Kikärtor', 'Krossade tomater', 'Passerade tomater', 'Hela tomater', 'Tomatpuré', 'Kokosmjölk', 'Majs på burk', 'Svamp på burk', 'Tonfisk', 'Makrill i tomatsås',
      'Valnötter', 'Hasselnötter', 'Mandlar', 'Solrosfrön', 'Pumpafrön', 'Sesamfrön', 'Chiafrön', 'Russin',
      'Rapsolja', 'Olivolja', 'Vinäger', 'Balsamico', 'Buljongtärningar', 'Senap', 'Ketchup', 'Oliver', 'Kapris', 'Cornichons',
      'Socker', 'Honung', 'Kakao', 'Bakchoklad', 'Kaffe', 'Te'
    ]
    for (const n of names) {
      expect(guessSection(n), n).toBe('Skafferi')
      expect(place(n), n).toBe('skafferi')
    }
  })

  it('alla sorters mjöl, sirap och kokos', () => {
    for (const n of ['Potatismjöl', 'Mandelmjöl', 'Kokosmjöl', 'Rågmjöl', 'Grahamsmjöl', 'Dinkelmjöl', 'Rismjöl', 'Bovetemjöl', 'Majsstärkelse', 'Maizena',
      'Ljus sirap', 'Mörk sirap', 'Lönnsirap', 'Agavesirap', 'Riven kokos', 'Kokosflingor', 'Kokosgrädde', 'Florsocker', 'Bakpulver', 'Ströbröd']) {
      expect(place(n), n).toBe('skafferi')
    }
  })

  it('torkat, på burk, konserv och tetra gör vilken vara som helst till skafferivara', () => {
    for (const n of ['Torkade aprikoser', 'Torkad mango', 'Ananas på burk', 'Bönor tetra', 'Ärtor konserv']) expect(place(n), n).toBe('skafferi')
  })

  it('knäckebröd får inget bäst före som färskt bröd, även om den sparade avdelningen är Bröd', () => {
    expect(pantryPlace({ name: 'Knäckebröd', section: 'Bröd' })).toEqual({ place: 'skafferi', days: null })
    expect(pantryPlace({ name: 'Formbröd', section: 'Bröd' })).toEqual({ place: 'skafferi', days: 4 })
  })

  it('kokosmjölk och jordnötssmör hamnar inte i kylen', () => {
    expect(place('Kokosmjölk', 'Mejeri')).toBe('skafferi')
    expect(place('Jordnötssmör')).toBe('skafferi')
  })

  it('färskvaror räknas inte', () => {
    for (const n of ['Mjölk', 'Mandelmjölk', 'Smör', 'Tomater', 'Gurka', 'Majs', 'Svamp', 'Bananer', 'Lax']) expect(isPantryStaple(n), n).toBe(false)
    expect(isPantryStaple('Färsk pasta')).toBe(false)
    expect(place('Frysta ärtor')).toBe('frys')
  })

  it('kryddor hamnar fortfarande under Kryddor', () => {
    for (const n of ['Salt', 'Svartpeppar', 'Kanel', 'Tacokrydda', 'Torkad basilika']) expect(place(n), n).toBe('kryddor')
  })

  it('streckkoder: konserver, nötter och mjöl från Open Food Facts hamnar i skafferiet', () => {
    expect(placeFromCategories(['en:canned-foods', 'en:canned-fishes', 'en:tunas'])).toBe('skafferi')
    expect(placeFromCategories(['en:plant-based-foods', 'en:coconut-milks'])).toBe('skafferi')
    expect(placeFromCategories(['en:nuts', 'en:walnuts'])).toBe('skafferi')
    expect(placeFromCategories(['en:flours', 'en:potato-starches'])).toBe('skafferi')
    expect(placeFromCategories(['en:dairies', 'en:milks'])).toBe('kyl')
  })

  it('listan i appen och orden hänger ihop', () => {
    expect(PANTRY_GROUPS.length).toBeGreaterThan(5)
    expect(new Set(PANTRY_WORDS).size).toBe(PANTRY_WORDS.length)
    for (const w of PANTRY_WORDS) expect(w, w).toBe(w.toLowerCase())
  })
})
