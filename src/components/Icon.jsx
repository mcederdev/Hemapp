// Enkla linjeikoner (stil som Lucide), ritas med aktuell textfärg
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  cart: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2|C9 20a1 1 0 1 0 0 .01|C17 20a1 1 0 1 0 0 .01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  checks: 'M4 6h16M4 12h10M4 18h7|M15 16.5l2.5 2.5 4-4.5',
  calendar: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z|M4 10h16M8 2v4M16 2v4',
  food: 'M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10|M17 21V3c-2.5 1.5-3.5 4-3.5 7.5V13H17',
  menu: 'M4 7h16M4 12h16M4 17h16',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  chevron: 'M9 6l6 6-6 6',
  left: 'M15 6l-6 6 6 6',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z',
  wallet: 'M4 7a2 2 0 0 1 2-2h12v4|M4 7v11a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2|M16 14.5h.01',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M2.5 20a6.5 6.5 0 0 1 13 0|M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3.5 6',
  thermo: 'M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0|M12 9v7',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  bell: 'M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9|M10 20a2 2 0 0 0 4 0',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  dice: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1|C8.5 8.5a1 1 0 1 0 0 .01|C15.5 15.5a1 1 0 1 0 0 .01|C12 12a1 1 0 1 0 0 .01',
  repeat: 'M17 2l3 3-3 3|M4 11V9a4 4 0 0 1 4-4h12|M7 22l-3-3 3-3|M20 13v2a4 4 0 0 1-4 4H4',
  pin: 'M12 21s7-6.3 7-12a7 7 0 0 0-14 0c0 5.7 7 12 7 12|M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  chat: 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1|M8 10h8M8 13h5',
  bag: 'M5 8h14l-1 12H6z|M9 8V6a3 3 0 0 1 6 0v2',
  pill: 'M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7z|M7.5 10.5l6 6',
  car: 'M3 16v-4l2.5-5h13l2.5 5v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1|M3 12h18|C7 14.5a1 1 0 1 0 0 .01|C17 14.5a1 1 0 1 0 0 .01|M5 17v2M19 17v2',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'
}

export default function Icon({ name, size = 22, className = '', strokeWidth = 2 }) {
  const parts = (P[name] || '').split('|')
  return (
    <svg className={`ico ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {parts.map((d, i) => d.startsWith('C')
        ? <path key={i} d={'M' + d.slice(1)} strokeWidth={strokeWidth * 1.6} />
        : <path key={i} d={d} />)}
    </svg>
  )
}
