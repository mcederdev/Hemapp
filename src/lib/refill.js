// Bocka av en vara. Ligger samma vara i Komplettera (det som tagit slut hemma) försvinner den därifrån också.
export function checkOff(items, item, lists) {
  items.update(item.id, { done: true })
  const refill = lists.find((l) => l.is_refill)
  if (!refill || item.list_id === refill.id) return
  const n = item.name.trim().toLowerCase()
  for (const x of items.rows) if (x.list_id === refill.id && !x.done && x.id !== item.id && x.name.trim().toLowerCase() === n) items.remove(x.id)
}
