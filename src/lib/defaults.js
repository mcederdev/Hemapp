export const COMMON_CHORES = [
  'Diska', 'Plocka ur diskmaskinen', 'Dammsuga', 'Torka golven', 'Tvätta',
  'Vika tvätt', 'Bädda sängen', 'Städa rummet', 'Gå ut med soporna', 'Panta',
  'Vattna blommorna', 'Handla', 'Laga middag', 'Duka', 'Duka av',
  'Städa badrummet', 'Byta lakan', 'Rensa kylen'
]

export const COMMON_DISHES = [
  { name: 'Lasagne', category: 'Pasta' },
  { name: 'Spaghetti och köttfärssås', category: 'Pasta' },
  { name: 'Pasta carbonara', category: 'Pasta' },
  { name: 'Pannkakor', category: 'Vardag' },
  { name: 'Tacos', category: 'Fredag' },
  { name: 'Pizza', category: 'Fredag' },
  { name: 'Köttbullar och potatismos', category: 'Husman' },
  { name: 'Fiskpinnar och potatis', category: 'Fisk' },
  { name: 'Ugnsbakad lax', category: 'Fisk' },
  { name: 'Kycklinggryta med ris', category: 'Kyckling' },
  { name: 'Kyckling i ugn', category: 'Kyckling' },
  { name: 'Falukorv stroganoff', category: 'Husman' },
  { name: 'Korv och makaroner', category: 'Vardag' },
  { name: 'Pytt i panna', category: 'Husman' },
  { name: 'Hamburgare', category: 'Fredag' },
  { name: 'Chili con carne', category: 'Gryta' },
  { name: 'Ärtsoppa', category: 'Soppa' },
  { name: 'Tomatsoppa', category: 'Soppa' },
  { name: 'Wok med nudlar', category: 'Vardag' },
  { name: 'Fläskfilé med klyftpotatis', category: 'Helg' },
  { name: 'Kåldolmar', category: 'Husman' },
  { name: 'Omelett', category: 'Snabbt' },
  { name: 'Quesadillas', category: 'Snabbt' },
  { name: 'Gratäng med skinka', category: 'Vardag' }
]

export const MEMBER_COLORS = ['#4f7cff', '#e0567a', '#f0a030', '#2f9e6e', '#8a5cf6']

// Varor som brukar behövas till vanliga rätter, för 4 portioner (går att ändra per hushåll).
// Skrivs som en rad i ett recept: mängd, enhet och vara.
export const DEFAULT_SERVINGS = 4
export const DEFAULT_DISH_ITEMS = {
  'Lasagne': ['500 g Nötfärs', '1 paket Lasagneplattor', '2 burkar Krossade tomater', '5 dl Mjölk', '150 g Riven ost', '1 st Gul lök'],
  'Spaghetti och köttfärssås': ['400 g Spaghetti', '500 g Nötfärs', '1 burk Krossade tomater', '1 st Gul lök', '2 st Morötter'],
  'Pasta carbonara': ['400 g Pasta', '140 g Bacon', '4 st Ägg', '1 bit Parmesan', '2 dl Grädde'],
  'Pannkakor': ['6 dl Mjölk', '3 st Ägg', '2,5 dl Vetemjöl', '1 burk Sylt'],
  'Tacos': ['8 st Tortillabröd', '500 g Nötfärs', '1 påse Tacokrydda', '150 g Riven ost', '1 st Gurka', '2 st Tomat', '1 st Sallad', '2 dl Gräddfil', '1 burk Salsa'],
  'Pizza': ['2 st Pizzadeg', '1 burk Tomatsås', '150 g Riven ost', '1 paket Skinka'],
  'Köttbullar och potatismos': ['500 g Köttbullar', '1 kg Potatis', '3 dl Mjölk', 'Smör', '1 burk Lingonsylt', '1 paket Gräddsås'],
  'Fiskpinnar och potatis': ['1 paket Fiskpinnar', '1 kg Potatis', '1 st Remouladsås', '1 st Citron'],
  'Ugnsbakad lax': ['500 g Lax', '1 kg Potatis', '1 st Citron', '2 dl Crème fraiche', '1 st Broccoli'],
  'Kycklinggryta med ris': ['600 g Kycklingfilé', '4 dl Ris', '2 dl Grädde', '1 st Paprika', '1 st Gul lök'],
  'Kyckling i ugn': ['1 kg Kycklingklubbor', '1 kg Potatis', '2 st Paprika'],
  'Falukorv stroganoff': ['1 st Falukorv', '2 dl Grädde', '1 tub Tomatpuré', '1 st Gul lök', '4 dl Ris'],
  'Korv och makaroner': ['1 paket Korv', '400 g Makaroner', 'Ketchup'],
  'Pytt i panna': ['1 paket Pytt i panna', '4 st Ägg', '1 burk Rödbetor'],
  'Hamburgare': ['4 st Hamburgare', '4 st Hamburgerbröd', '4 skivor Ost', '1 st Sallad', '2 st Tomat', '1 påse Pommes frites'],
  'Chili con carne': ['500 g Nötfärs', '1 burk Kidneybönor', '2 burkar Krossade tomater', '1 st Gul lök', '4 dl Ris', 'Chilikrydda'],
  'Ärtsoppa': ['2 burkar Ärtsoppa', 'Senap', '1 paket Pannkakor'],
  'Tomatsoppa': ['2 burkar Krossade tomater', '1 tärning Buljong', '2 dl Grädde', '1 st Bröd'],
  'Wok med nudlar': ['250 g Nudlar', '1 påse Wokgrönsaker', '500 g Kycklingfilé', 'Soja'],
  'Fläskfilé med klyftpotatis': ['1 st Fläskfilé', '1 kg Potatis', '1 paket Bearnaisesås'],
  'Kåldolmar': ['1 paket Kåldolmar', '1 kg Potatis', '1 burk Lingonsylt', '1 paket Gräddsås'],
  'Omelett': ['6 st Ägg', '1 dl Mjölk', '1 paket Skinka', '100 g Ost'],
  'Quesadillas': ['8 st Tortillabröd', '150 g Riven ost', '400 g Kycklingfilé', '1 burk Salsa'],
  'Gratäng med skinka': ['1 paket Skinka', '1 kg Potatis', '3 dl Grädde', '150 g Riven ost', '1 st Purjolök']
}

// Våra egna rätter plus de föreslagna, utom de föreslagna som familjen dolt eller gjort om till en egen
export function dishList(own, hidden = []) {
  const mine = own.map((d) => ({ ...d, own: true }))
  const hide = new Set([...hidden, ...mine.map((o) => o.name)].map((n) => n.toLowerCase()))
  return [...mine, ...COMMON_DISHES.filter((c) => !hide.has(c.name.toLowerCase()))]
}
