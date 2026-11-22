import { useEffect, useMemo, useRef, useState } from 'react'
import { books, SERIES, statusOf, TYPE_LABEL } from '../lib/books.js'
import { updateEntry, useStore } from '../lib/store.js'
import { Cover } from './BookCard.jsx'
import { DiceIcon } from './Icons.jsx'

const MODES = [
  { id: 'any', label: 'Anything' },
  { id: 'short', label: 'Short', hint: 'under 300 pages' },
  { id: 'long', label: 'Long', hint: '500+ pages' },
  { id: 'series', label: 'Series', hint: 'next in a series' },
]

// For "series": only the next unread book of each series (read them in order),
// preferring series you've already started.
function candidates(mode, log) {
  const unread = books.filter((b) => statusOf(log, b.id) === 'unread')
  if (mode === 'short') return unread.filter((b) => b.pages && b.pages < 300)
  if (mode === 'long') return unread.filter((b) => b.pages >= 500)
  if (mode === 'series') {
    const next = []
    const started = []
    for (const s of SERIES) {
      const list = books.filter((b) => b.series.includes(s)).sort((a, b) => a.published.localeCompare(b.published))
      const first = list.find((b) => statusOf(log, b.id) === 'unread')
      if (!first || next.includes(first)) continue
      next.push(first)
      if (list.some((b) => statusOf(log, b.id) !== 'unread')) started.push(first)
    }
    return started.length ? started : next
  }
  return unread
}

const randomFrom = (list, not) => {
  const pool = list.length > 1 && not ? list.filter((b) => b.id !== not) : list
  return pool[Math.floor(Math.random() * pool.length)]
}

export default function PickView({ onOpen }) {
  const log = useStore((s) => s.log)
  const [mode, setMode] = useState('any')
  const [pick, setPick] = useState(null)
  const [spinning, setSpinning] = useState(null)
  const timer = useRef(null)
  const pool = useMemo(() => candidates(mode, log), [mode, log])

  useEffect(() => () => clearTimeout(timer.current), [])

  const roll = () => {
    if (!pool.length) return
    clearTimeout(timer.current)
    const final = randomFrom(pool, pick?.id)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || pool.length === 1) return setPick(final)
    // Flick through a few random covers, slowing down, then land.
    let i = 0
    const steps = 9
    const tick = () => {
      if (i++ >= steps) {
        setSpinning(null)
        setPick(final)
        return
      }
      setSpinning(randomFrom(pool))
      timer.current = setTimeout(tick, 45 + i * i * 4)
    }
    setPick(null)
    tick()
  }

  const shown = spinning || pick
  const pickStatus = pick ? statusOf(log, pick.id) : null

  return (
    <div className="pick">
      <h2 className="view-title">What should I read next?</h2>
      <div className="chip-wrap center">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`chip${mode === m.id ? ' on' : ''}`}
            onClick={() => {
              setMode(m.id)
              setPick(null)
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="muted center small">
        {pool.length} unread {pool.length === 1 ? 'candidate' : 'candidates'}
        {MODES.find((m) => m.id === mode).hint ? ` · ${MODES.find((m) => m.id === mode).hint}` : ''}
      </p>

      <div className={`pick-stage${spinning ? ' spinning' : ''}${pick ? ' landed' : ''}`}>
        {shown ? (
          <button className="pick-card" onClick={() => pick && onOpen(pick.id)} key={shown.id} disabled={!pick}>
            <Cover book={shown} size={spinning ? 'M' : 'L'} eager />
          </button>
        ) : (
          <div className="pick-placeholder">
            <DiceIcon width={56} height={56} />
            <p>{pool.length ? 'Feeling lucky?' : 'Nothing left to pick here. Impressive.'}</p>
          </div>
        )}
      </div>

      {pick && (
        <div className="pick-info">
          <h3>{pick.title}</h3>
          <p className="muted">
            {pick.published.slice(0, 4)} · {TYPE_LABEL[pick.type]} · {pick.pages ?? '?'} pages
            {pick.series.length ? ` · ${pick.series[0]}` : ''}
          </p>
        </div>
      )}

      <div className="pick-actions">
        <button className="btn primary big" onClick={roll} disabled={!pool.length || !!spinning}>
          <DiceIcon width={20} height={20} /> {pick ? 'Pick again' : 'Pick a book'}
        </button>
        {pick && (
          <button
            className="btn big"
            disabled={pickStatus === 'reading'}
            onClick={() => updateEntry(pick, { status: 'reading' })}
          >
            {pickStatus === 'reading' ? 'Reading now ✓' : 'Start reading'}
          </button>
        )}
      </div>
    </div>
  )
}
