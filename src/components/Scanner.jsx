import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet'
import { validCode } from '../lib/barcode'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

// Läser streckkoder med kameran. Safari på iPhone kan inte läsa streckkoder själv,
// så då laddas en liten läsare (ZXing) som följer med appen. Den hämtas först när man skannar.
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']
let detector = null
function getDetector() {
  if (!detector) detector = (async () => {
    if ('BarcodeDetector' in window) {
      try {
        const ok = await window.BarcodeDetector.getSupportedFormats()
        const f = FORMATS.filter((x) => ok.includes(x))
        if (f.length) return new window.BarcodeDetector({ formats: f })
      } catch { /* använd ZXing */ }
    }
    const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill')
    prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } })
    return new BarcodeDetector({ formats: FORMATS })
  })().catch((e) => { detector = null; throw e })
  return detector
}

export default function Scanner({ title = 'Skanna streckkod', hint, onCode, onClose }) {
  const video = useRef(null)
  const done = useRef(onCode)
  done.current = onCode
  const [error, setError] = useState('')
  const [typed, setTyped] = useState('')
  const [typedError, setTypedError] = useState('')

  useEffect(() => {
    let stream = null
    let stop = false
    let timer = null
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('ingen kamera')
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return }
        const v = video.current
        v.srcObject = stream
        await v.play().catch(() => {})
        const det = await getDetector()
        const tick = async () => {
          if (stop) return
          if (v.readyState >= 2) {
            try {
              const hit = (await det.detect(v)).find((c) => validCode(c.rawValue))
              if (hit && !stop) {
                stop = true
                navigator.vibrate?.(60)
                stream.getTracks().forEach((t) => t.stop())
                done.current(hit.rawValue)
                return
              }
            } catch { /* nästa bild */ }
          }
          timer = setTimeout(tick, 150)
        }
        tick()
      } catch (e) {
        setError(e?.name === 'NotAllowedError'
          ? 'Appen fick inte använda kameran. Tillåt kameran för Hemappen i iPhonens inställningar, eller skriv siffrorna under streckkoden här nedanför.'
          : 'Kameran gick inte att starta. Skriv siffrorna under streckkoden här nedanför i stället.')
      }
    })()
    return () => { stop = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()) }
  }, [])

  const submit = (e) => {
    e.preventDefault()
    const c = typed.replace(/\D/g, '')
    if (!validCode(c)) { setTypedError('Siffrorna stämmer inte. Kolla att alla kom med.'); return }
    done.current(c)
  }

  return (
    <Sheet title={title} onClose={onClose}>
      {hint && <p className="muted small">{hint}</p>}
      {error ? <p className="error small">{error}</p> : (
        <div className="scan-box mt">
          <video ref={video} playsInline muted autoPlay />
          <div className="scan-line" />
        </div>
      )}
      {!error && <p className="muted small mt">Håll streckkoden i rutan. Det piper (vibrerar) när den är läst.</p>}
      <form className="row mt" onSubmit={submit}>
        <input className="grow" inputMode="numeric" placeholder="eller skriv siffrorna" value={typed} onChange={(e) => { setTyped(e.target.value); setTypedError('') }} />
        <button type="submit">OK</button>
      </form>
      {typedError && <p className="error small">{typedError}</p>}
    </Sheet>
  )
}
