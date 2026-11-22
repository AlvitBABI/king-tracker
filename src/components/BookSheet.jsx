import { useEffect, useRef, useState } from 'react'
import { bookById, STATUSES, TYPE_LABEL } from '../lib/books.js'
import { updateEntry, useStore } from '../lib/store.js'
import { celebrate } from '../lib/celebrate.js'
import { Cover } from './BookCard.jsx'
import { Star } from './Icons.jsx'
import Sheet from './Sheet.jsx'

const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export default function BookSheet({ bookId, onClose, onRead }) {
  const book = bookById[bookId]
  const entry = useStore((s) => s.log[bookId])
  const status = entry?.status || 'unread'
  // Local copy so typing stays smooth; saved to the store as you type.
  const [comment, setComment] = useState(entry?.comment || '')

  // Leaving "Read" clears the rating and finish date; offer a few seconds to undo.
  const [undo, setUndo] = useState(null)
  const undoTimer = useRef(null)
  useEffect(() => () => clearTimeout(undoTimer.current), [])

  const setStatus = (next) => {
    if (next === status) return
    const patch = { status: next }
    if (next === 'read') patch.date_finished = today()
    updateEntry(book, patch)
    clearTimeout(undoTimer.current)
    if (status === 'read' && (entry?.rating || entry?.date_finished)) {
      setUndo({ rating: entry.rating, date_finished: entry.date_finished })
      undoTimer.current = setTimeout(() => setUndo(null), 5000)
    } else setUndo(null)
    if (next === 'read') {
      celebrate()
      onRead?.(book.id)
    }
  }

  const undoClear = () => {
    updateEntry(book, { status: 'read', ...undo })
    clearTimeout(undoTimer.current)
    setUndo(null)
  }

  const setRating = (n) => updateEntry(book, { rating: entry?.rating === n ? null : n })

  return (
    <Sheet title={book.title} onClose={onClose} className="book-sheet">
      <div className="book-head">
        <Cover book={book} size="L" eager className={`big status-${status}`} />
        <div className="book-info">
          <p className="book-year">{book.published.slice(0, 4)}</p>
          <dl className="facts">
            <div>
              <dt>Type</dt>
              <dd>{TYPE_LABEL[book.type]}</dd>
            </div>
            <div>
              <dt>Pages</dt>
              <dd>{book.pages ?? '—'}</dd>
            </div>
            <div>
              <dt>Released</dt>
              <dd>{formatDate(book.published)}</dd>
            </div>
          </dl>
          {book.series.length > 0 && (
            <div className="tags">
              {book.series.map((s) => (
                <span key={s} className="tag">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="seg status-seg" role="group" aria-label="Reading status">
        {STATUSES.map((s) => (
          <button key={s.id} className={`${status === s.id ? 'on' : ''} s-${s.id}`} onClick={() => setStatus(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

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
              onChange={(e) => updateEntry(book, { date_finished: e.target.value || null })}
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
              updateEntry(book, { comment: e.target.value })
            }}
          />
        </label>
      )}
      {undo && (
        <div className="toast" role="status">
          <span>{undo.rating ? 'Rating and finish date cleared' : 'Finish date cleared'}</span>
          <button className="toast-btn" onClick={undoClear}>
            Undo
          </button>
        </div>
      )}
    </Sheet>
  )
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!m) return String(y)
  const date = new Date(Date.UTC(y, m - 1, d || 1))
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    ...(d ? { day: 'numeric' } : {}),
    timeZone: 'UTC',
  })
}
