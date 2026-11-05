// Hushållets egen färg (households.theme.accent) och säsongsfigurer
export const ACCENTS = ['#2f6f5e', '#3b6fb6', '#7a4fb0', '#c0487a', '#c8553d', '#b8860b', '#4a7a2a', '#40505c']

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const toHex = (rgb) => '#' + rgb.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')
const mix = (h, w, t) => toHex(hex(h).map((c, i) => c + (hex(w)[i] - c) * t))
const lum = (h) => { const [r, g, b] = hex(h).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }

export function applyAccent(accent) {
  const root = document.documentElement
  if (!accent || !/^#[0-9a-f]{6}$/i.test(accent)) {
    for (const v of ['--accent-light', '--accent-light-text', '--accent-dark', '--accent-dark-text']) root.style.removeProperty(v)
    return
  }
  const dark = mix(accent, '#ffffff', 0.35)
  root.style.setProperty('--accent-light', accent)
  root.style.setProperty('--accent-light-text', lum(accent) > 0.4 ? '#14201b' : '#ffffff')
  root.style.setProperty('--accent-dark', dark)
  root.style.setProperty('--accent-dark-text', lum(dark) > 0.4 ? '#0e1a16' : '#ffffff')
}

// Säsongsfigur till hälsningen på Idag
export function seasonEmoji(day) {
  const m = +day.slice(5, 7), d = +day.slice(8, 10)
  if (m === 12 && d >= 1) return '🎄'
  if (m === 10 && d >= 25) return '🎃'
  if (m === 6 && d >= 18 && d <= 26) return '🌼'
  if ((m === 3 && d >= 20) || (m === 4 && d <= 25)) return '🐣'
  if (m >= 3 && m <= 5) return '🌸'
  if (m >= 6 && m <= 8) return '☀️'
  if (m >= 9 && m <= 11) return '🍂'
  return '❄️'
}
