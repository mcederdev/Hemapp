import { useState } from 'react'
import Auth from './Auth'

const FEATURES = [
  { img: 'idag', title: 'Hela dagen på ett ställe', text: 'Vad som händer idag, kvällens middag, sysslor och lappar till varandra. Tryck på en person för att bara se deras saker.' },
  { img: 'kalender', title: 'Familjens kalender', text: 'Allas händelser i samma vy, med upprepning och påminnelser. Importera schemat från jobbet eller skolan som .ics-fil.' },
  { img: 'handla', title: 'Handla tillsammans', text: 'Gemensamma inköpslistor som uppdateras direkt. Tryck på det som tagit slut hemma så hamnar det på listan.' },
  { img: 'barnen', title: 'Barnens egen sida', text: 'Morgon- och kvällsrutiner, sysslor som ger stjärnor och veckopeng, och ett sparmål att längta efter.' },
  { img: 'meddelanden', title: 'Meddelanden och lappar', text: 'Skriv till familjen, eller till barnets andra hem om ni har delad vårdnad. Sätt upp ett hjärta på kylskåpet.' },
  { img: 'bilen', title: 'Delad vårdnad och bil', text: 'Koppla ihop två hushåll. Barnets kalender, växelvisa schema, packlista, VAB och bilens kostnader delas, och appen räknar ut vem som ska swisha vem.' }
]
const MORE = ['🍝 Veckomeny och middagstips', '🌡️ VAB och sjukdagar, med påminnelse till Försäkringskassan', '💰 Räkningar som delas efter inkomst', '🎂 Födelsedagar och årliga påminnelser', '🔔 Notiser på mobilen varje morgon', '📊 Statistik över sysslor och sjukdagar']

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
          <li><strong>Lägg appen på hemskärmen</strong>: öppna i Safari, tryck på dela och välj "Lägg till på hemskärmen".</li>
        </ol>
        <button className="primary big" onClick={() => setAuth('signup')}>Skapa konto</button>
      </section>
      <footer className="ld-foot muted small">Bilderna visar en påhittad familj.</footer>
    </div>
  )
}
