// Bilens kostnader och hur de delas mellan två hushåll
export const CAR_KINDS = [
  { id: 'bransle', label: 'Bensin & laddning', emoji: '⛽', shared: false, quick: true },
  { id: 'forsakring', label: 'Försäkring', emoji: '🛡️', shared: true, quick: true },
  { id: 'parkering', label: 'Parkering', emoji: '🅿️', shared: true, quick: true },
  { id: 'service', label: 'Service & reparation', emoji: '🔧', shared: true, quick: true },
  { id: 'skatt', label: 'Skatt', emoji: '🏛️', shared: true },
  { id: 'besiktning', label: 'Besiktning', emoji: '✅', shared: true },
  { id: 'dack', label: 'Däck', emoji: '🛞', shared: true },
  { id: 'tvatt', label: 'Tvätt', emoji: '🧽', shared: false },
  { id: 'ovrigt', label: 'Övrigt', emoji: '📦', shared: true }
]
export const kindOf = (id) => CAR_KINDS.find((k) => k.id === id) || CAR_KINDS[CAR_KINDS.length - 1]

// Hur mycket det andra hushållet är skyldigt ägarhushållet (negativt = ägaren är skyldig).
// paid_by_household / from_household null betyder det andra (ej kopplade) hushållet.
export function carBalance(car, costs, settlements = []) {
  const share = Number(car.owner_share) / 100
  const byOwner = (h) => h === car.household_id
  let owed = 0
  for (const c of costs) {
    if (!c.shared) continue
    const a = Number(c.amount)
    owed += byOwner(c.paid_by_household) ? a * (1 - share) : -a * share
  }
  for (const s of settlements) owed += byOwner(s.from_household) ? Number(s.amount) : -Number(s.amount)
  return Math.round(owed * 100) / 100
}
