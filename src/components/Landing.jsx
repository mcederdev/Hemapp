import { useState } from 'react'
import Auth from './Auth'

const FEATURES = [
  { img: 'idag', title: 'Hela dagen på ett ställe', text: 'Vad som händer idag, kvällens middag, sysslor och lappar till varandra. Tryck på en person för att bara se deras saker.' },
  { img: 'kalender', title: 'Familjens kalender', text: 'Allas händelser i samma vy, med upprepning och påminnelser. Importera schemat från jobbet eller skolan som .ics-fil.' },
  { img: 'handla', title: 'Handla tillsammans', text: 'Gemensamma inköpslistor som uppdateras direkt. Tryck på det som tagit slut hemma så hamnar det på listan.' },
  { img: 'barnen', title: 'Barnens egen sida', text: 'Morgon- och kvällsrutiner, sysslor som ger stjärnor och veckopeng, och ett sparmål att längta efter.' },
  { img: 'meddelanden', title: 'Meddelanden och lappar', text: 'Skriv till familjen, eller till barnets andra hem om ni har delad vårdnad. Sätt upp ett hjärta på kylskåpet.' },
  { img: 'bilen', title: 'Bilen', text: 'Kostnader, skatt och kommande utgifter, plus att göra för tvätt, service, däckbyte och besiktning. Delar ni bil mellan två hem räknar appen ut vem som ska swisha vem.' }
]
// Delad vårdnad: det som gör det lättare för två hem att ha koll på samma barn
const COPARENT = [
  ['🔁', 'Växelvis boende', 'Schemat för varannan vecka med bytesdag och tid. Båda hemmen ser var barnet är just nu och när nästa byte är.'],
  ['✎', 'Flytta ett byte en gång', 'Lämnar ni på lördag i stället för söndag? Ändra dag och tid för just det bytet, så ser det andra hemmet det direkt.'],
  ['🏖️', 'Lov och semester', 'Lägg in perioder som avviker från schemat, t.ex. jullov eller sommarveckor.'],
  ['🎒', 'Packlista', 'En gemensam lista över vad som ska med vid bytet. Kvällen före får båda en påminnelse om vad som är kvar att packa.'],
  ['📅', 'Barnets kalender', 'Barnets aktiviteter, skola och tider syns i båda hemmen, oavsett vem som lagt in dem.'],
  ['🚸', 'Lämna och hämta', 'Vem lämnar och hämtar vilken dag, med varning om det krockar med någons jobbpass.'],
  ['🌡️', 'VAB och sjukdagar', 'Se vem som vabbar och när. Ni får en påminnelse om att anmäla dagarna till Försäkringskassan.'],
  ['💊', 'Medicin', 'Barnets mediciner och doser med klockslag, så båda vet vad som har getts och när flaskan tar slut.'],
  ['💬', 'Meddelanden mellan hemmen', 'En egen kanal mellan hushållen, skild från familjens interna chatt.'],
  ['🚗', 'Gemensam bil', 'Delar ni bil ser båda kostnader, skatt, besiktning och bokade tider. Appen räknar ut vem som ska swisha vem.'],
  ['🧹', 'Delade sysslor', 'Sysslor som gäller båda hemmen, t.ex. att boka tandläkare eller tvätta den gemensamma bilen.']
]
const MORE = ['🍝 Veckomeny och middagstips, och era egna rätter', '⭐ Prio-varor på inköpslistan', '🥛 Skafferi med bäst-före', '💰 Räkningar som delas efter inkomst', '📺 Abonnemang med påminnelse om uppsägning', '⏱️ Övertidsräknare enligt kollektivavtal', '🎂 Födelsedagar och årliga påminnelser', '🔔 Notiser på mobilen varje morgon', '🧭 Välj själv vilka sidor du vill se', '📊 Statistik över sysslor och sjukdagar']

// Startsida för den som inte är inloggad: vad appen är, med bilder
export default function Landing() {
  const [auth, setAuth] = useState(null)
  if (auth) return <Auth initialMode={auth} onBack={() => setAuth(null)} />
  return (
    <div className="landing">
      <header className="ld-top">
        <strong>🏡 Hemappen</strong>
        <button onClick={() => setAuth('login')}>Logga in</button>
      </header>

      <section className="ld-hero">
        <h1>Familjens vardag, samlad i en app</h1>
        <p>Kalender, inköpslista, sysslor, middagar och meddelanden som hela familjen delar, och som uppdateras direkt i allas telefoner.</p>
        <div className="row wrap ld-cta">
          <a className="link ld-co-link" href="#delad-vardnad">Delad vårdnad? Så fungerar det för två hem ↓</a>
          <button className="primary big" onClick={() => setAuth('signup')}>Kom igång gratis</button>
          <button className="big" onClick={() => setAuth('login')}>Jag har redan konto</button>
        </div>
      </section>

      {FEATURES.map((f, i) => (
        <section key={f.img} className={`ld-feature ${i % 2 ? 'flip' : ''}`}>
          <div className="ld-text"><h2>{f.title}</h2><p>{f.text}</p></div>
          <div className="ld-phone"><img src={`/landing/${f.img}.jpg`} alt={f.title} loading="lazy" /></div>
        </section>
      ))}

      <section className="ld-coparent" id="delad-vardnad">
        <div className="ld-co-head">
          <div className="ld-text">
            <p className="ld-kicker">För er med delad vårdnad</p>
            <h2>Två hem, samma koll</h2>
            <p>Bor barnet växelvis hos två föräldrar kan ni koppla ihop era hushåll. Båda familjerna har varsin app med sina egna saker, men allt som gäller barnet syns i båda hemmen och uppdateras direkt.</p>
          </div>
          <div className="ld-phone"><img src="/landing/vardnad.jpg" alt="Flytta bytet en gång" loading="lazy" /></div>
        </div>
        <ul className="ld-co-grid">
          {COPARENT.map(([icon, title, text]) => <li key={title}><span className="ld-co-icon">{icon}</span><strong>{title}</strong><p>{text}</p></li>)}
        </ul>
        <div className="ld-co-split">
          <div className="ld-co-box">
            <h3>Det här delas mellan hemmen</h3>
            <p>Barnets kalender, växelvisa schemat, byten och lov, packlistan, lämna och hämta, VAB, barnets medicin, delade sysslor, den gemensamma bilen och meddelanden mellan hemmen.</p>
          </div>
          <div className="ld-co-box">
            <h3>Det här stannar hemma</h3>
            <p>Er egen kalender, inköpslistor, middagar, ekonomi, egna sysslor, lappar och familjens interna chatt. Det andra hemmet ser inget av det.</p>
          </div>
        </div>
        <div className="ld-co-box ld-co-how">
          <h3>Så kopplar ni ihop hushållen</h3>
          <ol>
            <li>Den ena föräldern går till Familj → Delad vårdnad, väljer barnet och trycker på Skapa kod. Koden börjar på D och gäller i 30 dagar.</li>
            <li>Den andra skapar ett konto, väljer Delad vårdnad och skriver in koden. Har hen redan en familj i appen skrivs koden under Familj → Delad vårdnad.</li>
            <li>Klart. Barnets saker syns nu i båda hemmen, medan resten stannar hos var och en.</li>
          </ol>
          <button className="primary big" onClick={() => setAuth('signup')}>Skapa konto och koppla ihop</button>
        </div>
      </section>

      <section className="ld-kitchen">
        <h2>Köksskärmen</h2>
        <p>Sätt en gammal iPad på kylskåpet. Klocka, dagen, sysslor, middagar, lappar och meddelanden på en skärm som alltid är tänd.</p>
        <img src="/landing/koket.jpg" alt="Köksskärmen på en iPad" loading="lazy" />
      </section>

      <section className="ld-more">
        <h2>Och lite till</h2>
        <ul>{MORE.map((m) => <li key={m}>{m}</li>)}</ul>
      </section>

      <section className="ld-steps">
        <h2>Så kommer ni igång</h2>
        <ol>
          <li><strong>Skapa ett konto</strong> och ge familjen ett namn.</li>
          <li><strong>Bjud in</strong> din partner med en kod. Barnen behöver inget eget konto.</li>
          <li><strong>Delad vårdnad?</strong> Koppla ihop med barnets andra hem med en D-kod under Familj.</li>
          <li><strong>Lägg appen på hemskärmen</strong>: öppna i Safari, tryck på dela och välj "Lägg till på hemskärmen".</li>
        </ol>
        <button className="primary big" onClick={() => setAuth('signup')}>Skapa konto</button>
      </section>
      <footer className="ld-foot muted small">Bilderna visar en påhittad familj.</footer>
    </div>
  )
}
