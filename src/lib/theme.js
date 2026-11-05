// Ljust/mörkt tema: 'auto' följer telefonen
export function getTheme() { try { return localStorage.getItem('theme') || 'auto' } catch { return 'auto' } }
export function applyTheme(t = getTheme()) {
  const root = document.documentElement
  if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t)
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#151716' : '#f6f5f2')
}
export function setTheme(t) { try { localStorage.setItem('theme', t) } catch { /* ignoreras */ } applyTheme(t) }
