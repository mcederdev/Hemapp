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
export const LOCKED = ['today', 'family']
// Grupper på Mer-sidan. Sidorna ligger i den ordning man valt, inom sin grupp.
export const GROUPS = [
  ['Vardag', ['today', 'shopping', 'chores', 'calendar', 'meals']],
  ['Familjen', ['messages', 'kids', 'pickups', 'medicine', 'vab']],
  ['Pengar och bil', ['finance', 'car']],
  ['Planering', ['reminders', 'stats']],
  ['Inställningar', ['family', 'kitchen']]
]
export const groupMore = (pages) => GROUPS.map(([name, ids]) => [name, pages.filter((p) => ids.includes(p.id))]).filter(([, list]) => list.length) // går inte att dölja
export const BAR_SIZE = 5

// Undersidor som går att dölja var för sig. Döljs en undersida (eller hela sidan) försvinner också
// det som hör till den på andra ställen, t.ex. övertid i kalendern och notiser. Sparas som 'sida.under' i menu.hidden.
export const SUBS = {
  shopping: [['home', 'Slut hemma'], ['pantry', 'Skafferi', 'och bäst-före i Snart'], ['lists', 'Listor']],
  finance: [['bills', 'Räkningar'], ['subs', 'Abonnemang', 'och uppsägningar i Snart'], ['overtime', 'Övertid', 'och övertid på jobbpass i kalendern']],
  vab: [['vab', 'VAB'], ['sick', 'Sjuk själv']],
  car: [['costs', 'Kostnader'], ['todo', 'Att göra', 'och bilens sysslor på Idag']],
  stats: [['chores', 'Sysslor'], ['sick', 'Sjuk & VAB'], ['food', 'Mat'], ['pickups', 'Hämta']],
  reminders: [['reminders', 'Årliga saker'], ['birthdays', 'Födelsedagar', 'och födelsedagar i Snart']]
}

// Vad som syns för den inloggade. App.jsx sätter den varje gång menyn ändras.
let current = { hidden: [] }
export const setMenuState = (menu) => { current = resolveMenu(menu) }
export const isHidden = (key, hidden = current.hidden) => { const page = key.split('.')[0]; return hidden.includes(page) || hidden.includes(key) }
export const shows = (key) => !isHidden(key)
// Synliga undersidor för en sida, och vilken som ska visas om den valda är dold
export const visibleSubs = (page) => (SUBS[page] || []).map(([id]) => id).filter((id) => shows(`${page}.${id}`))
export const pickSub = (page, view, always = [], fallback) => (always.includes(view) || visibleSubs(page).includes(view) ? view : fallback || visibleSubs(page)[0] || always[0])

export function resolveMenu(menu) {
  const o = menu?.order || []
  const order = [...o.filter((id) => PAGES.some((p) => p.id === id)), ...PAGES.map((p) => p.id).filter((id) => !o.includes(id))]
  const hidden = (menu?.hidden || []).filter((id) => !LOCKED.includes(id))
  const shown = order.filter((id) => !hidden.includes(id)).map((id) => PAGES.find((p) => p.id === id))
  return { order, hidden, bar: shown.slice(0, BAR_SIZE), more: shown.slice(BAR_SIZE) }
}
