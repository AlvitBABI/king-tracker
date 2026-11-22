import { useEffect, useRef, useState } from 'react'
import { STATUSES } from '../lib/books.js'
import { celebrate } from '../lib/celebrate.js'
import { updateEntry } from '../lib/store.js'
import { Star } from './Icons.jsx'

export const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// A short-lived "Undo" message. Returns [toastElement, offerUndo, clearUndo].
export function useUndo(onUndo) {
  const [undo, setUndo] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const offer = (message, patch) => {
    clearTimeout(timer.current)
    setUndo({ message, patch })
    timer.current = setTimeout(() => setUndo(null), 5000)
  }
  const clear = () => {
    clearTimeout(timer.current)
    setUndo(null)
  }
  const toast = undo && (
    <div className="toast" role="status">
      <span>{undo.message}</span>
      <button
        className="toast-btn"
        onClick={() => {
          onUndo(undo.patch)
          clear()
        }}
      >
        Undo
      </button>
    </div>
  )
  return [toast, offer, clear]
}

// Status, rating, finish date and private notes, for a book or a story.
// `item` needs { id, title }.
export default function ReadingSection({ item, entry, offerUndo, clearUndo, onRead, hint }) {
  const status = entry?.status || 'unread'
  // Local copy so typing stays smooth; saved to the store as you type.
  const [comment, setComment] = useState(entry?.comment || '')

  const setStatus = (next) => {
    if (next === status) return
    const patch = { status: next }
    if (next === 'read') patch.date_finished = today()
    updateEntry(item, patch)
    if (status === 'read' && (entry?.rating || entry?.date_finished)) {
      offerUndo(entry.rating ? 'Rating and finish date cleared' : 'Finish date cleared', {
        status: 'read',
        rating: entry.rating,
        date_finished: entry.date_finished,
      })
    } else clearUndo()
    if (next === 'read') {
      celebrate()
      onRead?.(item.id)
    }
  }

  const setRating = (n) => updateEntry(item, { rating: entry?.rating === n ? null : n })

  return (
    <section className="sheet-section">
      <h3 className="section-title">Reading</h3>
      <div className="seg status-seg" role="group" aria-label="Reading status">
        {STATUSES.map((s) => (
          <button key={s.id} className={`${status === s.id ? 'on' : ''} s-${s.id}`} onClick={() => setStatus(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      {hint && <p className="muted small hint">{hint}</p>}

      {status === 'read' && (
        <div className="read-fields">
          <div className="field">
            <span className="field-label">My rating</span>
            <div className="star-input" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  role="radio"
                  aria-checked={entry?.rating === n}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  className={n <= (entry?.rating || 0) ? 'lit' : ''}
                  onClick={() => setRating(n)}
                >
                  <Star filled={n <= (entry?.rating || 0)} width={34} height={34} />
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span className="field-label">Finished on</span>
            <input
              type="date"
              value={entry?.date_finished || ''}
              max={today()}
              onChange={(e) => updateEntry(item, { date_finished: e.target.value || null })}
            />
          </label>
        </div>
      )}

      {status !== 'unread' && (
        <label className="field">
          <span className="field-label">Private notes</span>
          <textarea
            rows={4}
            placeholder={status === 'read' ? 'What did you think? Only you can see this.' : 'Thoughts so far…'}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value)
              updateEntry(item, { comment: e.target.value })
            }}
          />
        </label>
      )}
    </section>
  )
}
