# Tester

```
npm test          # kör allt en gång (gamla node-testerna + Vitest)
npm run test:watch  # kör om testerna när du sparar en fil
```

Allt körs utan webbläsare och utan Supabase, på under en sekund. Tidszonen är låst till
Europe/Stockholm (`vitest.config.js`), så datumtesterna ger samma svar på alla datorer.

| Fil | Vad den testar |
|---|---|
| `finance.test.js` | Räkningar efter inkomst, avrundning, Swish-belopp och mottagare |
| `ics.test.js` | .ics-import och återkommande händelser (RRULE) över månads- och årsskiften och skottår |
| `chores.test.js` | Nästa datum för återkommande sysslor, avbockning och ångra, planer |
| `stars.test.js` | Stjärnor, veckopeng och sparmål |
| `shopping.test.js` | Inga dubbletter på inköpslistan, avdelningar och Övrigt |
| `quickadd.test.js` | Snabbinmatningen (pluset på Idag) |

Tester vars namn börjar med **Fixad bugg:** var röda när testsviten skrevs (2026-11-12) och
visade fel i koden. De är rättade nu och ska förbli gröna. Hittar du ett nytt fel: skriv ett test
som heter `BUGG: …` och som är rött tills felet är rättat. Alla andra tester ska vara gröna.
