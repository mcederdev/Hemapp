# Hemappen 🏡

Familjens app för inköpslista, sysslor, kalender, middagstips och fördelning av räkningar.
Byggd som en webbapp (PWA) som läggs på hemskärmen på iPhone. Data sparas i Supabase och
synkas live mellan telefonerna.

## Vad finns i appen

| Flik | Vad den gör |
| --- | --- |
| **Handla** | Gemensam inköpslista. Bocka av det som ligger i korgen, rensa när ni är klara. |
| **Att göra** | Sysslor som kan tilldelas mamma, pappa eller barnet, med datum. Knappen *Vanliga sysslor* lägger till vanliga sysslor med ett tryck, och egna kan sparas som vanliga. |
| **Kalender** | Händelser per dag och person. Importera `.ics`-filer (t.ex. skolschema). Samma fil kan importeras igen utan dubbletter. |
| **Mat** | *Ge mig tips* slumpar tre rätter bland vanliga svenska rätter och era egna. |
| **Ekonomi** | Fyll i inkomst och räkningar. Appen räknar ut hur mycket var och en ska stå för efter inkomst och hur mycket som ska swishas. |
| **Familj** | Medlemmar och färger, lägg till barn (utan konto) och inbjudningskod till den andra föräldern. |

Bara föräldrarna loggar in. Barnet finns som medlem utan konto.

## Supabase (redan klart)

Projektet `hemapp` är skapat i Supabase (region Stockholm) och databasen är uppsatt med
`supabase/schema.sql`. Varje hushåll ser bara sina egna data.

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
- `supabase/schema.sql` databasen
