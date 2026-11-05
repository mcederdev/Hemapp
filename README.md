# Hemappen 🏡

Familjens app för inköpslista, sysslor, kalender, middagstips och fördelning av räkningar.
Byggd som en webbapp (PWA) som läggs på hemskärmen på iPhone. Data sparas i Supabase och
synkas live mellan telefonerna.

## Vad finns i appen

| Flik | Vad den gör |
| --- | --- |
| **Idag** | Dagens middag, händelser, sysslor och hur mycket som ska handlas, på ett ställe. |
| **Handla** | Flera inköpslistor (t.ex. *Veckohandling*, *Kalas lördag* med datum). Varor sorteras efter butikens avdelningar och visar vem som lade till dem. *Brukar ni köpa* föreslår varor ni ofta lägger till. *Slut hemma* är knappar för basvaror: tryck när något tar slut så hamnar det på veckohandlingen. |
| **Sysslor** | Sysslor till mamma, pappa eller barnet, med datum, upprepning (varje dag, varannan vecka …) och stjärnor. När en återkommande syssla bockas av skapas nästa automatiskt. |
| **Kalender** | Månadsvy med färg per person, dagslista och kommande två veckor. Återkommande händelser och påminnelser. Import av `.ics`-filer inklusive återkommande händelser. |
| **Mat** | Veckomeny: välj middag per dag bland förslag, era egna rätter eller fritext, eller fyll tomma dagar automatiskt. |
| **Mer → Ekonomi** | Fasta och engångsräkningar per månad, fördelning efter inkomst, knapp som öppnar Swish med rätt belopp och historik över tidigare månader. |
| **Mer → Barnens sida** | Enkel vy för barnet med dagens sysslor, veckans stjärnor och veckopeng (kronor per stjärna går att ändra). |
| **Mer → Familj & inställningar** | Notiser, medlemmar och färger, mobilnummer för Swish, lägg till barn och inbjudningskod. |

Bara föräldrarna loggar in. Barnet finns som medlem utan konto.

## Notiser på iPhone

Kräver iOS 16.4 eller senare och att appen är tillagd på hemskärmen.
Öppna appen från hemskärmen → **Mer → Familj & inställningar → Slå på notiser**.
Ni får en morgonsammanfattning (tid går att välja) och en påminnelse innan händelser.

Servern är en Supabase Edge Function (`supabase/functions/send-reminders`) som körs var 5:e minut via `pg_cron`.

## Supabase (redan klart)

Projektet `hemapp` är skapat i Supabase (region Stockholm) och databasen är uppsatt med
filerna i `supabase/migrations/`. Varje hushåll ser bara sina egna data.

- URL: `https://bavlvzgtdjhibhqgtkww.supabase.co`
- Publik nyckel: `sb_publishable_aNvikmBF237Jy-EpGORUEw_DcsCMoK2`

Den publika nyckeln får ligga i appen, den ger bara åtkomst till det inloggade användare får se.

## Publicera på Vercel (ca 2 minuter)

1. Gå till [vercel.com/new](https://vercel.com/new) och importera repot `mcederdev/hemapp`.
2. Under **Environment Variables**, lägg till:
   - `VITE_SUPABASE_URL` = URL:en ovan
   - `VITE_SUPABASE_ANON_KEY` = den publika nyckeln ovan
3. Tryck **Deploy**. Vercel känner själv igen att det är ett Vite-projekt.
4. I Supabase: **Authentication → URL Configuration**, sätt **Site URL** till er Vercel-adress
   (t.ex. `https://hemapp.vercel.app`). Då hamnar bekräftelselänken i mejlet rätt.

## Komma igång i familjen

1. Öppna Vercel-adressen i Safari på iPhone, tryck på dela-knappen → **Lägg till på hemskärmen**.
2. Skapa konto, bekräfta mejlet, logga in och välj **Nytt hushåll**.
3. Under **Familj**: lägg till barnet och visa inbjudningskoden för den andra föräldern.
4. Den andra föräldern skapar konto och väljer **Gå med med kod**.

## Köra lokalt (för utveckling)

Kräver [Node.js](https://nodejs.org) 20 eller senare.

```bash
cp .env.example .env.local   # fyll i URL och nyckel ovan
npm install
npm run dev                  # öppna adressen som visas
npm test                     # testar ics-läsaren och ekonomiuträkningen
```

## Filer

- `src/components/` en fil per flik
- `src/lib/ics.js` läser `.ics`-filer
- `src/lib/finance.js` fördelar räkningar efter inkomst
- `src/lib/defaults.js` vanliga sysslor och rätter (lägg gärna till fler)
- `supabase/migrations/` databasen, i ordning
- `supabase/functions/send-reminders/` pushnotiser
- `src/sw.js` service worker (offline och notiser)
