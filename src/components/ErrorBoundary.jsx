import { Component } from 'react'

// Fångar en krasch i en sida så att resten av appen (menyn längst ner) fortsätter fungera.
// Byt sida så återställs den (App ger den key={tab}).
export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('Sidan kraschade', error, info?.componentStack) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <section className="card">
        <h2>Något gick fel på den här sidan</h2>
        <p className="muted small">Resten av appen fungerar. Välj en annan sida i menyn, eller försök igen.</p>
        <p className="muted small"><code>{String(this.state.error?.message || this.state.error)}</code></p>
        <button onClick={() => this.setState({ error: null })}>Försök igen</button>
      </section>
    )
  }
}
