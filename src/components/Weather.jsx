import { useEffect, useState } from 'react'

// Väder från open-meteo.com (gratis, ingen nyckel). Hushållets plats väljs under Familj.
const CODES = [[0, '☀️', 'Klart'], [1, '🌤️', 'Mest klart'], [2, '⛅', 'Halvklart'], [3, '☁️', 'Mulet'], [45, '🌫️', 'Dimma'], [48, '🌫️', 'Dimma'],
  [51, '🌦️', 'Duggregn'], [53, '🌦️', 'Duggregn'], [55, '🌧️', 'Duggregn'], [56, '🌧️', 'Underkylt regn'], [57, '🌧️', 'Underkylt regn'], [61, '🌧️', 'Lätt regn'], [63, '🌧️', 'Regn'], [65, '🌧️', 'Kraftigt regn'],
  [66, '🌧️', 'Underkylt regn'], [67, '🌧️', 'Underkylt regn'], [71, '🌨️', 'Lätt snöfall'], [73, '🌨️', 'Snöfall'], [75, '❄️', 'Kraftigt snöfall'], [77, '🌨️', 'Snökorn'],
  [80, '🌦️', 'Regnskurar'], [81, '🌧️', 'Regnskurar'], [82, '⛈️', 'Kraftiga skurar'], [85, '🌨️', 'Snöbyar'], [86, '❄️', 'Snöbyar'], [95, '⛈️', 'Åska'], [96, '⛈️', 'Åska med hagel'], [99, '⛈️', 'Åska med hagel']]
export const weatherIcon = (code) => (CODES.find((c) => c[0] === code) || [0, '🌡️', ''])

export function useWeather(lat, lon) {
  const key = `weather:${lat},${lon}`
  const [w, setW] = useState(() => { try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null } })
  useEffect(() => {
    if (lat == null || lon == null) return
    let stop = false
    const load = async () => {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FStockholm&forecast_days=2`
      const r = await fetch(u).then((x) => x.json()).catch(() => null)
      if (!r?.current || stop) return
      const v = { temp: r.current.temperature_2m, code: r.current.weather_code, days: r.daily.time.map((d, i) => ({ day: d, code: r.daily.weather_code[i], max: r.daily.temperature_2m_max[i], min: r.daily.temperature_2m_min[i], rain: r.daily.precipitation_probability_max[i] })) }
      setW(v)
      try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* */ }
    }
    load()
    const id = setInterval(load, 30 * 60000)
    return () => { stop = true; clearInterval(id) }
  }, [lat, lon, key])
  return lat == null ? null : w
}

const r = (n) => Math.round(n)
export default function Weather({ household, tomorrow = false }) {
  const w = useWeather(household?.lat, household?.lon)
  if (!w) return null
  const d = w.days?.[tomorrow ? 1 : 0]
  const [, icon, label] = weatherIcon(tomorrow ? d?.code : w.code)
  return (
    <div className="weather" title={household.place_name}>
      <span className="w-icon">{icon}</span>
      <div>
        <div className="w-temp">{tomorrow ? `${r(d.max)}°` : `${r(w.temp)}°`}<span className="muted small"> {label}</span></div>
        {d && <div className="muted small">{tomorrow ? 'Imorgon ' : ''}{r(d.min)}° till {r(d.max)}°{d.rain >= 30 ? ` · ☔ ${d.rain}%` : ''}</div>}
      </div>
    </div>
  )
}
