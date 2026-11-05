import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { useTable } from '../useTable'
import { MemberTag } from './MemberPicker'
import { today } from '../lib/dates'

const QUICK = ['❤️', '👍', '😂', '🙏', '👏', '😘']
export const seenKey = 'msgSeen'
export const markSeen = () => { try { localStorage.setItem(seenKey, new Date().toISOString()) } catch { /* ignoreras */ } }
export const lastSeen = () => { try { return localStorage.getItem(seenKey) || '' } catch { return '' } }

const when = (iso) => {
  const d = new Date(iso)
  const t = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  return iso.slice(0, 10) === today() ? t : `${d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })} ${t}`
}

// Meddelanden: inom familjen och med det kopplade hushållet (delad vårdnad)
export default function Messages({ me, householdId, people, linked, guests = [], guest = null, compact = false }) {
  const msgs = useTable('messages', householdId, 'created_at')
  const channels = [{ id: null, name: 'Familjen' }, ...(guest ? [] : linked?.households || []).map((h) => ({ id: h.link_id, name: h.name }))]
  const [channel, setChannel] = useState(null)
  const [text, setText] = useState('')
  const endRef = useRef()
  const listRef = useRef()
  const byId = Object.fromEntries([...(people || []), ...guests.map((g) => ({ ...g, short: g.name.slice(0, 1).toUpperCase(), role: 'guest' }))].map((m) => [m.id, m]))
  const isMine = (m) => (guest ? m.guest_author === guest.id : m.author === me.id)
  const list = compact ? msgs.rows.slice(-8) : msgs.rows.filter((m) => (m.link_id || null) === channel)
  const chName = (m) => channels.find((c) => c.id === (m.link_id || null))?.name
  useEffect(() => {
    if (compact) { const go = () => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }; go(); requestAnimationFrame(go); setTimeout(go, 300) }
    else { markSeen(); endRef.current?.scrollIntoView({ block: 'end' }) }
  }, [list.length, channel, compact])

  const send = async (e, sticker = null) => {
    e?.preventDefault()
    const t = text.trim()
    if (!t && !sticker) return
    const link = compact ? null : channel
    setText('')
    await msgs.insert(guest ? { text: t, sticker, link_id: null, author: null, guest_author: guest.id } : { text: t, sticker, link_id: link, author: me.id })
    const msg = `💬 ${sticker || ''}${sticker && t ? ' ' : ''}${t}`
    if (guest) return
    if (link) supabase.rpc('notify_linked', { link, msg, url: '/?tab=messages' })
    else supabase.rpc('notify_household', { msg, link: '/?tab=messages' })
  }
  const remove = (m) => isMine(m) && confirm('Ta bort meddelandet?') && msgs.remove(m.id)

  return (
    <div className={`messages ${compact ? 'compact' : ''}`}>
      {!compact && channels.length > 1 && (
        <div className="seg mb">{channels.map((c) => <button key={c.id || 'fam'} className={channel === c.id ? 'active' : ''} onClick={() => setChannel(c.id)}>{c.name}</button>)}</div>
      )}
      <div className="msg-list" ref={listRef}>
        {list.length === 0 && <p className="muted">{compact ? 'Inga meddelanden än.' : 'Inga meddelanden än. Skriv något!'}</p>}
        {list.map((m) => {
          const mine = isMine(m)
          const a = byId[m.author || m.guest_author]
          return (
            <div key={m.id} className={`msg ${mine ? 'mine' : ''}`} onDoubleClick={() => remove(m)}>
              {!mine && <MemberTag member={a} size={compact ? 26 : 30} />}
              <div className="bubble">
                {!mine && <span className="msg-who">{a?.name || 'Någon'}{compact && m.link_id ? ` · ${chName(m)}` : ''}</span>}
                {m.sticker && <span className="msg-sticker">{m.sticker}</span>}
                {m.text && <span className="msg-text">{m.text}</span>}
                <span className="msg-time">{when(m.created_at)}{compact && mine && m.link_id ? ` · till ${chName(m)}` : ''}</span>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <form className="msg-form" onSubmit={send}>
        <input placeholder={compact ? 'Skriv till familjen…' : `Skriv till ${channels.find((c) => c.id === channel)?.name.toLowerCase() === 'familjen' ? 'familjen' : channels.find((c) => c.id === channel)?.name}…`} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary" disabled={!text.trim()}>Skicka</button>
      </form>
      {!compact && <div className="msg-quick">{QUICK.map((q) => <button key={q} type="button" onClick={() => send(null, q)} aria-label={`Skicka ${q}`}>{q}</button>)}</div>}
      {!compact && <p className="muted small">Dubbeltryck på ditt eget meddelande för att ta bort det.</p>}
    </div>
  )
}
