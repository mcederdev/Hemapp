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

// Varor som brukar behövas till vanliga rätter (går att ändra per hushåll)
export const DEFAULT_DISH_ITEMS = {
  'Lasagne': ['Nötfärs', 'Lasagneplattor', 'Krossade tomater', 'Mjölk', 'Riven ost', 'Gul lök'],
  'Spaghetti och köttfärssås': ['Spaghetti', 'Nötfärs', 'Krossade tomater', 'Gul lök', 'Morötter'],
  'Pasta carbonara': ['Pasta', 'Bacon', 'Ägg', 'Parmesan', 'Grädde'],
  'Pannkakor': ['Mjölk', 'Ägg', 'Vetemjöl', 'Sylt'],
  'Tacos': ['Tortillabröd', 'Nötfärs', 'Tacokrydda', 'Riven ost', 'Gurka', 'Tomat', 'Sallad', 'Gräddfil', 'Salsa'],
  'Pizza': ['Pizzadeg', 'Tomatsås', 'Riven ost', 'Skinka'],
  'Köttbullar och potatismos': ['Köttbullar', 'Potatis', 'Mjölk', 'Smör', 'Lingonsylt', 'Gräddsås'],
  'Fiskpinnar och potatis': ['Fiskpinnar', 'Potatis', 'Remouladsås', 'Citron'],
  'Ugnsbakad lax': ['Lax', 'Potatis', 'Citron', 'Crème fraiche', 'Broccoli'],
  'Kycklinggryta med ris': ['Kycklingfilé', 'Ris', 'Grädde', 'Paprika', 'Gul lök'],
  'Kyckling i ugn': ['Kycklingklubbor', 'Potatis', 'Paprika'],
  'Falukorv stroganoff': ['Falukorv', 'Grädde', 'Tomatpuré', 'Gul lök', 'Ris'],
  'Korv och makaroner': ['Korv', 'Makaroner', 'Ketchup'],
  'Pytt i panna': ['Pytt i panna', 'Ägg', 'Rödbetor'],
  'Hamburgare': ['Hamburgare', 'Hamburgerbröd', 'Ost', 'Sallad', 'Tomat', 'Pommes frites'],
  'Chili con carne': ['Nötfärs', 'Kidneybönor', 'Krossade tomater', 'Gul lök', 'Ris', 'Chilikrydda'],
  'Ärtsoppa': ['Ärtsoppa', 'Senap', 'Pannkakor'],
  'Tomatsoppa': ['Krossade tomater', 'Buljong', 'Grädde', 'Bröd'],
  'Wok med nudlar': ['Nudlar', 'Wokgrönsaker', 'Kycklingfilé', 'Soja'],
  'Fläskfilé med klyftpotatis': ['Fläskfilé', 'Potatis', 'Bearnaisesås'],
  'Kåldolmar': ['Kåldolmar', 'Potatis', 'Lingonsylt', 'Gräddsås'],
  'Omelett': ['Ägg', 'Mjölk', 'Skinka', 'Ost'],
  'Quesadillas': ['Tortillabröd', 'Riven ost', 'Kycklingfilé', 'Salsa'],
  'Gratäng med skinka': ['Skinka', 'Potatis', 'Grädde', 'Riven ost', 'Purjolök']
}
