// Skafferivaror: torrvaror och konserver som håller länge i rumstemperatur.
// Listan styr två saker:
//  1. guessSection lägger varorna på avdelningen Skafferi (WORDS nedan läggs till där).
//  2. När en sådan vara bockas av på inköpslistan hamnar den i 🥫 Skafferi utan bäst före-datum.
// Kryddor, salt och peppar räknas också hit men får en egen plats, 🌶️ Kryddor (se SPICE i refill.js).
// Sammanställd 2026-11-20 utifrån Magnus lista (Köket.se, Krisinformation.se m.fl.) plus all sorts mjöl, sirap och kokos.

// Det som visas i appen under "Vad räknas som skafferivaror?"
export const PANTRY_GROUPS = [
  { title: '🍝 Pasta, ris och gryn', items: 'Pasta och nudlar (alla sorter), ris, risgryn, bulgur, couscous, matvete, quinoa, polenta, havregryn, rågflingor, mannagryn, müsli, granola, frukostflingor, potatismos på påse' },
  { title: '🌾 Mjöl och bakning', items: 'Alla sorters mjöl: vetemjöl, grahamsmjöl, rågmjöl, dinkelmjöl, havremjöl, potatismjöl, majsstärkelse/Maizena, mandelmjöl, kokosmjöl, rismjöl, bovetemjöl, kikärtsmjöl. Torrjäst, bakpulver, bikarbonat, hjorthornssalt. Socker (strö-, farin-, flor-, pärl-), vaniljsocker, sirap (ljus, mörk, lönn, agave), kakao, bakchoklad, chokladknappar, riven kokos och kokosflingor, mandelmassa, gelatin, strössel, ströbröd och panko' },
  { title: '🍘 Bröd som håller', items: 'Knäckebröd, skorpor, kex, tortillabröd, riskakor och majskakor (färskt bröd räknas som bröd och får bäst före om några dagar)' },
  { title: '🥫 Baljväxter och konserver', items: 'Linser, bönor och kikärtor (torkade, på burk eller tetra), krossade, passerade och hela tomater, passata, tomatpuré, kokosmjölk, kokosgrädde, majs och svamp på burk, tonfisk, makrill i tomatsås, sardiner, buljong och fond. Allt som står "på burk", "konserv" eller "tetra" räknas hit' },
  { title: '🥜 Nötter, frön och torkad frukt', items: 'Nötter och mandel (valnötter, hasselnötter, cashew, jordnötter, pinjenötter, pistage), frön (solros, pumpa, sesam, chia, lin), russin, dadlar, katrinplommon och allt som börjar på "torkad/torkade", jordnötssmör' },
  { title: '🫒 Oljor, såser och smaksättare', items: 'Raps- och olivolja, vinäger, balsamico, soja, senap, ketchup, majonnäs, oliver, kapris, cornichons, inlagd gurka, sweet chili, sambal oelek, sriracha, tabasco, pesto, currypasta, tacosås, salsa, honung, sylt och marmelad, nougatkräm' },
  { title: '☕ Kaffe och te', items: 'Kaffe, te och tepåsar, O\'boy och drickchoklad' },
  { title: '🌶️ Kryddor (egen plats)', items: 'Salt, peppar och kryddor som kanel, oregano, paprikapulver och tacokrydda räknas också som skafferivaror men hamnar under 🌶️ Kryddor' }
]

// Ord som känns igen (gemener). Ord på högst 3 bokstäver måste stå som eget ord ("ris", "te"),
// längre ord räcker som slutet av ett sammansatt ord ("vetemjöl" → "mjöl").
export const PANTRY_WORDS = [
  // Pasta, ris och gryn
  'pasta', 'spaghetti', 'makaroner', 'penne', 'fusilli', 'tagliatelle', 'lasagneplattor', 'risoni', 'nudlar',
  'ris', 'risgryn', 'jasminris', 'basmatiris', 'fullkornsris', 'arborioris', 'bulgur', 'couscous', 'matvete', 'quinoa',
  'polenta', 'gryn', 'havregryn', 'mannagryn', 'flingor', 'müsli', 'musli', 'granola', 'potatismos', 'pulvermos',
  // Mjöl och bakning
  'mjöl', 'stärkelse', 'maizena', 'torrjäst', 'bakpulver', 'bikarbonat', 'hjorthornssalt', 'socker', 'sirap', 'kakao',
  'bakchoklad', 'blockchoklad', 'chokladknappar', 'kokos', 'kokosflingor', 'mandelmassa', 'gelatin', 'strössel', 'ströbröd', 'panko',
  // Bröd som håller
  'knäcke', 'knäckebröd', 'skorpor', 'kex', 'tortilla', 'tortillabröd', 'riskakor', 'majskakor',
  // Baljväxter och konserver
  'bönor', 'linser', 'kikärtor', 'kikärter', 'krossade', 'passerade', 'hela tomater', 'tomatpuré', 'passata', 'kokosmjölk',
  'kokosgrädde', 'majskorn', 'tonfisk', 'makrill', 'sardiner', 'buljong', 'fond', 'konserv',
  // Nötter, frön och torkad frukt
  'nötter', 'mandel', 'mandlar', 'valnötter', 'hasselnötter', 'cashewnötter', 'jordnötter', 'pinjenötter', 'pistagenötter',
  'frön', 'fröer', 'solrosfrö', 'pumpafrö', 'sesamfrö', 'chiafrö', 'linfrö', 'russin', 'dadlar', 'katrinplommon', 'jordnötssmör',
  // Oljor, såser och smaksättare
  'olja', 'vinäger', 'balsamico', 'soja', 'senap', 'ketchup', 'majonnäs', 'oliver', 'kapris', 'cornichons', 'inlagd gurka',
  'saltgurka', 'smörgåsgurka', 'sweet chili', 'sambal', 'sriracha', 'tabasco', 'pesto', 'currypasta', 'tacosås', 'tacokrydda',
  'salsa', 'tomatsås', 'honung', 'sylt', 'marmelad', 'nutella', 'nougatkräm',
  // Kaffe och te
  'kaffe', 'te', 'tepåsar', 'oboy', 'drickchoklad',
  // Kryddor (läggs på avdelningen Skafferi, platsen hemma blir Kryddor)
  'salt', 'peppar', 'krydda', 'kryddor'
]

// Ord som gör vilken vara som helst till en skafferivara: "Majs på burk", "Torkade aprikoser", "Bönor tetra"
export const PANTRY_HINTS = ['burk', 'burkar', 'konserv', 'konserverad', 'konserverade', 'tetra', 'torkad', 'torkade', 'torkat']
