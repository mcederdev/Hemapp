// Inköpslistan: hitta en vara som redan ligger aktiv (inte avbockad) på listan,
// och vilken butiksavdelning en ny vara hamnar på.
import { itemKey } from './qty.js'
import { guessSection, SECTIONS } from './sections.js'

// Samma vara räknas även i singular/plural ("Gurka" = "Gurkor")
export function findActive(rows, listId, name) {
  return rows.find((i) => i.list_id === listId && !i.done && itemKey(i.name) === itemKey(name))
}

// Avdelning: hushållets egen katalog först, sedan en gissning (okänd vara = Övrigt)
export function sectionFor(name, catalogByName = {}) {
  return catalogByName[name.toLowerCase()]?.section || guessSection(name)
}

// Avdelningen varan visas under. Okänd eller saknad avdelning (t.ex. gamla rader) = Övrigt.
export const sectionOf = (item) => (SECTIONS.includes(item.section) ? item.section : 'Övrigt')

// Varorna grupperade i butikens ordning, tomma avdelningar tas bort
export const bySection = (items) => SECTIONS.map((s) => [s, items.filter((i) => sectionOf(i) === s)]).filter(([, v]) => v.length)
