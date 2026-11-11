# Önskemål – Hemappen

Alla önskemål som Magnus har bett om, och hur långt de har kommit. Listan uppdateras varje gång något byggs, mergas eller ändras.

Samma lista finns överst i dokumentet [Hemappen – önskemål och förbättringsidéer](https://claude.ai/artifact/HD2vtyY5PeqVHSoAAcPiC9), som också har förbättringsidéerna 1–71. Båda uppdateras samtidigt.

Senast uppdaterad: 2026-11-11 (streckkod byggd; genomgång av alla önskemål sedan 2026-11-05 mot koden på main, `de171c3`).

**Status:** ✅ klart · 🟡 delvis eller väntar på någon · ⏳ pågår · ⬜ inte byggt (väntar på besked) · ⏸️ pausat

---

## Pågår och väntar på besked

| Status | Önskemål | Kommentar |
|---|---|---|
| ⏳ | Köksskärmen: ändra storlek och ordning på blocken (dra ut, flytta, innehållet anpassas) | Byggs i en egen tråd (förslag 71 i dokumentet) |
| 🟡 | Ta bort gamla medicinfält i databasen (`medicine_doses`, `dose_morning`, `dose_evening`) | Godkänt 2026-11-05, men SQL:en måste köras av Magnus i Supabase och har inte körts |
| 🟡 | Se Juhanis skolschema även andra hemmets veckor | Ingen kodändring behövs. Andra hemmet (eller Magnus) lägger in "Skola" på Juhani för sina veckor |
| 🟡 | Egen medicin per hem | Byggt. Andra hemmet behöver trycka "Lägg till hos oss" |
| ⬜ | Förbättringsförslag 42–71 i dokumentet | 49, 50, 63, 67 och småfel 60, 64 är klara. 58 bortvald. Resten väntar på att Magnus väljer |
| ⬜ | Knapp "Visa på TV" med AirPlay-steg | Erbjuden. Riktig AirPlay-knapp går inte från en webbapp |
| ⬜ | Lämna/hämta i morgonnotisen ("Du hämtar Juhani 14:00") | Erbjuden, inget svar |
| ⬜ | Export av databasen till Home-app-mappen (backup) | Erbjuden. Supabase gratisplan har inga backuper |
| ⏳ | Skafferi: skanna streckkod för att lägga till varor (och skanna tom förpackning när något är slut) | Byggt 2026-11-11 i en PR med testlänk: Open Food Facts + appens eget minne av koder. Databasändringen (044) behöver ett "kör" |
| ⬜ | Kvitto: fota kvittot för priser och varor, utan dubbletter mot det som redan bockats av | Plan B. Kan göras gratis med textigenkänning i telefonen eller iPhonens Live Text. Väntar på besked |
| ⬜ | Mat: standardportioner efter vårdnadsveckor, kopiera förra veckans meny, dra av lagat från skafferiet | Idéer från mat-ombyggnaden |
| ⏸️ | Byta namn på appen | Pausat tills Magnus säger till |
| ⏸️ | Egen mailtjänst (Brevo), e-postverifiering och skydd mot läckta lösenord | Påminn om appen ska användas av fler än familjerna och några testfamiljer |

---

## Klart

### Grund
- ✅ Hushåll, inloggning för föräldrar, barnet är medlem utan konto
- ✅ Delad inköpslista med live-synk
- ✅ Sysslor: egna + lista med vanliga sysslor
- ✅ Kalender med import av .ics-filer (ingen Google/iCloud-synk, enligt önskemål)
- ✅ Middagstips: vanliga rätter + egna
- ✅ Ekonomi: inkomstproportionell fördelning av räkningar, Swish-belopp och knapp
- ✅ Plusknapp i varje flik som öppnar en popup med ✕
- ✅ Popup stängs inte om man trycker inne i rutan och släpper utanför

### Idag-sidan
- ✅ Familjeremsa med filter per person, dagsflöde med nu-linje (inte över bottenmenyn)
- ✅ Middag i egen ruta, halv bredd med Handla bredvid
- ✅ Rutor går att fälla ihop (med sammanfattningsrad) och flytta
- ✅ Initial i namncirkeln är bara en bokstav
- ✅ Kortare Idag (förslag 63)

### Kalender
- ✅ Sluttid visas. Pass över midnatt visas som "Dag2" nästa dag, heldag "Dag2" döljs
- ✅ Imorgon-raden och notiser har sluttid
- ✅ Månadsvy, veckoremsa och dagvy med en kolumn per person
- ✅ Upprepning: vardagar, vardagar varannan vecka, slutdatum
- ✅ Ta bort ett tillfälle, detta och framtida, eller alla
- ✅ Kategorier (Jobb m.m.), ändra i efterhand, regler per prefix: M1L/APT/AMÖ/Disp = jobb, Dagkonto/FP/FV/0-dag = ledig

### Handla
- ✅ Flera listor (datum, tillfällen), förslag, avdelningar, vem som lade till
- ✅ Slut hemma: tryck igen för att avmarkera, redigera/ta bort varor, plus
- ✅ Slut hemma → listan Komplettera. Avbockning i valfri lista tar bort den från Komplettera och Slut hemma
- ✅ Avbockade varor läggs automatiskt i kyl/frys/skafferi
- ✅ Prio-markering (!), bara prio-varor syns på Idag
- ✅ "Jag handlar nu" med notis till den andra föräldern och matkostnad
- ✅ Mängder: två rätter med gurka blir 2 gurkor
- ✅ Mest köpta varor räknas först vid avbockning, och inte i testläget

### Mat
- ✅ Veckomeny som färgade kort, håll inne för att byta dag
- ✅ Föreslå hela veckan
- ✅ Föreslagna rätter går att redigera och dölja
- ✅ Varor med mängd på alla rätter, även egna, valbara vid ny rätt
- ✅ Recept från länk (varor, portioner, gör så här), 📖 på Idag och köksskärmen
- ✅ Sökfältet hoppar inte bakom tangentbordet

### Sysslor
- ✅ Återkommande dag/vecka/månad. Med datum syns de först den dagen, utan datum varje dag tills de är gjorda
- ✅ Tilldela. Den tilldelade får äran, annars den som bockar av
- ✅ Dela sysslor med det andra hemmet

### VAB och sjukdagar
- ✅ VAB från barnets skoltid i kalendern, vem som vabbade, arbetstid från passen, allt går att ändra
- ✅ "Ingen behövde vabba" som förval när skolan inte krockar med jobb
- ✅ Sjukdom, temperatur, "sjuk imorgon också"
- ✅ Fliken heter "VAB & Sjukdagar", sjukfrånvaro för vuxna
- ✅ Påminnelse söndag kväll om FK, bocka av som anmält

### Statistik
- ✅ Egen sida: sysslor, sjuk & VAB, mat & handla, hämta
- ✅ Juhanis sjukdagar räknas från början

### Delad vårdnad
- ✅ Koppla ihop hushåll med kod. Delas: kalender, schema, bil, barnets VAB
- ✅ Varannan vecka, byte söndag ca 18, notis kvällen före
- ✅ Engångsflytt av bytet, lov och semester
- ✅ Packlista inför bytet, delad mellan hemmen
- ✅ Lämna/hämta delas inte med andra hemmet

### Lämna och hämta
- ✅ Förval efter kalendern (den som är ledig), "Båda", egen sida, påminnelse på Idag, statistik

### Bilen
- ✅ Kostnader, vem som betalat, delas eller inte (bensin = info), Swish, reglerat
- ✅ Bilpåminnelser flyttade från Påminnelser till Bilen
- ✅ Att göra (tvätta, boka service m.m.), delas mellan hemmen. Datum och Att göra ihopslagna
- ✅ Bilfakta efter regnummer (Toyota Yaris inläst), automatisk besiktning, skatt och däckbyte
- ✅ Skatten som kostnad, vy för kommande kostnader

### Ekonomi
- ✅ Fasta och engångsräkningar, historik
- ✅ Alla kostnader kan vara återkommande månad/kvartal/år och tas bort
- ✅ Abonnemang med redigerbar lista med tjänster
- ✅ Övertid: minuter på jobbpass, faktisk sluttid visas, kollektivavtalets uträkning (lön 43 670 kr), under 15 min ersätts alltid, påminnelse näst sista dagen i månaden

### Medicin
- ✅ Per person, doser med klockslag, flaska/ask/doser (nässpray)
- ✅ Antal förpackningar hemma med −/+, påminnelse bara när inga finns och 5 dagar kvar
- ✅ Visa/inte visa på Idag per medicin, försvinner när den är tagen, partnern ser och får notis, Påminn-knapp
- ✅ Räknas bara ner när barnet är hos oss, andra hemmets mängd syns (bara läsa)

### Familj och inställningar
- ✅ Ordning på familjemedlemmar (styr Idag och kalenderns dagvy), smeknamn som bara syns för en själv
- ✅ Anpassa menyn: dölja och sortera sidor och undersidor, även bottenmenyn. Kopplade saker döljs också
- ✅ Testläge, tydligt på alla sidor, räknas inte i statistiken
- ✅ Profilbilder, färgtema och säsong, väderort, gäster (mor- och farföräldrar), export av data
- ✅ Mer-sidan i grupper

### Köksskärmen (iPad)
- ✅ Köksskärm med lappar, sysslor, handla, Meddelanden och Snart
- ✅ Väder, nattläge 21–06, helskärm, håller skärmen vaken, prio-varor först

### Övrigt
- ✅ Lappar med figurer och "till", "+ Lapp" som post-it på familjeraden
- ✅ Meddelanden inom familjen och mellan hushållen
- ✅ Årliga påminnelser, födelsedagar och presentidéer
- ✅ Barnens sida: rutiner, stjärnor, veckopeng, sparmål, humör
- ✅ Pushnotiser: morgon, före händelser, veckoöversikt söndag
- ✅ Startsida för utloggade, med avsnitt om delad vårdnad, bil, mat och medicin
- ✅ Snabbare start och offline
- ✅ Säkerhetsgenomgång (engångskoder)
- ✅ Arbetsflöde: varje ändring på egen gren och PR med testlänk
- ✅ Mappen på Macen hålls i synk med GitHub efter varje merge
