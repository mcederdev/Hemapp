// Gissar vilken avdelning i butiken en vara hör till
export const SECTIONS = [
  'Frukt & grönt', 'Bröd', 'Mejeri', 'Kött & fisk', 'Chark', 'Frys', 'Skafferi',
  'Dryck', 'Godis & snacks', 'Hygien', 'Hushåll', 'Barn', 'Övrigt'
]

const WORDS = {
  'Frukt & grönt': ['äpple', 'banan', 'apelsin', 'päron', 'druv', 'citron', 'lime', 'tomat', 'gurka', 'sallad', 'lök', 'vitlök', 'potatis', 'morot', 'paprika', 'broccoli', 'avokado', 'svamp', 'champinjon', 'zucchini', 'spenat', 'frukt', 'bär', 'kål', 'majs', 'ingefära', 'clementin', 'melon', 'kiwi', 'örter', 'dill', 'persilja', 'basilika'],
  'Bröd': ['bröd', 'limpa', 'fralla', 'frallor', 'baguette', 'knäcke', 'tortilla', 'bulle', 'kaka', 'tunnbröd', 'hamburgerbröd', 'korvbröd'],
  'Mejeri': ['mjölk', 'fil', 'yoghurt', 'grädde', 'smör', 'ost', 'ägg', 'kvarg', 'crème', 'creme', 'keso', 'margarin', 'bregott', 'havredryck', 'mozzarella', 'fetaost', 'halloumi'],
  'Kött & fisk': ['kött', 'färs', 'kyckling', 'fläsk', 'lax', 'fisk', 'torsk', 'räk', 'biff', 'filé', 'kotlett', 'bacon', 'kalkon'],
  'Chark': ['korv', 'skinka', 'salami', 'pålägg', 'leverpastej', 'falukorv', 'prinskorv'],
  'Frys': ['fryst', 'glass', 'fiskpinnar', 'pommes', 'ärtor', 'frysta'],
  'Skafferi': ['pasta', 'spaghetti', 'makaroner', 'ris', 'mjöl', 'socker', 'salt', 'peppar', 'krydda', 'olja', 'vinäger', 'buljong', 'krossade', 'passerade', 'tacokrydda', 'tacosås', 'flingor', 'müsli', 'havregryn', 'gryn', 'bönor', 'linser', 'ketchup', 'senap', 'majonnäs', 'sylt', 'honung', 'nötter', 'kaffe', 'te', 'kakao', 'konserv', 'nudlar', 'soja', 'mos'],
  'Dryck': ['juice', 'läsk', 'vatten', 'saft', 'öl', 'vin', 'cola', 'festis'],
  'Godis & snacks': ['godis', 'chips', 'choklad', 'popcorn', 'snacks', 'kex', 'dipp'],
  'Hygien': ['tandkräm', 'tandborste', 'schampo', 'balsam', 'tvål', 'deo', 'bomull', 'plåster', 'binda', 'tampong', 'rakhyvel', 'hudkräm', 'solkräm'],
  'Hushåll': ['toapapper', 'hushållspapper', 'diskmedel', 'tvättmedel', 'sopsäck', 'påsar', 'folie', 'plastfolie', 'batteri', 'glödlampa', 'disktabletter', 'servetter', 'städ', 'svamp till disk', 'sköljmedel'],
  'Barn': ['blöj', 'välling', 'barnmat', 'napp', 'våtservett']
}

export function guessSection(name) {
  const n = name.toLowerCase()
  const tokens = n.split(/[^a-zåäöé]+/)
  // Korta ord (t.ex. "te", "ris") måste matcha ett helt ord, längre räcker som del av ordet
  const hit = (w) => (w.length <= 3 ? tokens.includes(w) : n.includes(w))
  for (const [section, words] of Object.entries(WORDS)) {
    if (words.some(hit)) return section
  }
  return 'Övrigt'
}

// Vanliga basvaror att visa under "Slut hemma" innan ni byggt upp er egen historik
export const DEFAULT_STAPLES = [
  'Mjölk', 'Smör', 'Ägg', 'Bröd', 'Ost', 'Yoghurt', 'Kaffe', 'Pasta', 'Ris', 'Bananer',
  'Äpplen', 'Gurka', 'Tomater', 'Lök', 'Potatis', 'Toapapper', 'Diskmedel', 'Tandkräm'
]
