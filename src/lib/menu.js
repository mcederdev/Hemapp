// Menyn: alla sidor i en ordning. De fem första som visas hamnar i bottenmenyn, resten under Mer.
// Sparas per person på ens egen rad (members.menu = { order: [ids], hidden: [ids] }).
export const PAGES = [
  { id: 'today', label: 'Idag', icon: 'home' },
  { id: 'shopping', label: 'Handla', icon: 'cart' },
  { id: 'chores', label: 'Sysslor', icon: 'checks' },
  { id: 'calendar', label: 'Kalender', icon: 'calendar' },
  { id: 'meals', label: 'Mat', icon: 'food' },
  { id: 'messages', label: 'Meddelanden', icon: 'chat' },
  { id: 'finance', label: 'Ekonomi', icon: 'wallet' },
  { id: 'kids', label: 'Barnens sida', icon: 'star' },
  { id: 'vab', label: 'VAB & Sjukdagar', icon: 'thermo' },
  { id: 'pickups', label: 'Lämna och hämta', icon: 'calendar' },
  { id: 'car', label: 'Bilen', icon: 'car' },
  { id: 'medicine', label: 'Medicin', icon: 'pill' },
  { id: 'stats', label: 'Statistik', icon: 'chart' },
  { id: 'reminders', label: 'Påminnelser & födelsedagar', icon: 'bell' },
  { id: 'kitchen', label: 'Köksskärm (iPad)', icon: 'home' },
  { id: 'family', label: 'Familj & inställningar', icon: 'users' }
]
// Kortare namn i bottenmenyn
export const SHORT = { messages: 'Chatt', finance: 'Ekonomi', kids: 'Barnen', vab: 'VAB', pickups: 'Hämta', medicine: 'Medicin', reminders: 'Påminn', kitchen: 'Kök', family: 'Familj' }
export const LOCKED = ['today', 'family'] // går inte att dölja
export const BAR_SIZE = 5

export function resolveMenu(menu) {
  const o = menu?.order || []
  const order = [...o.filter((id) => PAGES.some((p) => p.id === id)), ...PAGES.map((p) => p.id).filter((id) => !o.includes(id))]
  const hidden = (menu?.hidden || []).filter((id) => !LOCKED.includes(id))
  const shown = order.filter((id) => !hidden.includes(id)).map((id) => PAGES.find((p) => p.id === id))
  return { order, hidden, bar: shown.slice(0, BAR_SIZE), more: shown.slice(BAR_SIZE) }
}
