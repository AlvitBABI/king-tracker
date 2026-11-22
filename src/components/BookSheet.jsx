import { useEffect, useRef, useState } from 'react'
import { bookById, STATUSES, TYPE_LABEL } from '../lib/books.js'
import { celebrate, celebrateOwned } from '../lib/celebrate.js'
import { FORMATS } from '../lib/entry.js'
import { updateEntry, useStore } from '../lib/store.js'
import { Cover } from './BookCard.jsx'
import { CheckIcon, HeartIcon, Star } from './Icons.jsx'
import Sheet from './Sheet.jsx'

const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export default function BookSheet({ bookId, mode, onClose, onRead }) {
  const book = bookById[bookId]
  const entry = useStore((s) => s.log[bookId])
  const status = entry?.status || 'unread'
  const owned = Boolean(entry?.owned)
  // Local copies so typing stays smooth; saved to the store as you type.
  const [comment, setComment] = useState(entry?.comment || '')
  const [copyNotes, setCopyNotes] = useState(entry?.copy_notes || '')

  // Leaving "Read" (or un-owning) clears the details that only belong to it;
  // offer a few seconds to undo.
  const [undo, setUndo] = useState(null)
  const undoTimer = useRef(null)
  useEffect(() => () => clearTimeout(undoTimer.current), [])
  const offerUndo = (message, patch) => {
    clearTimeout(undoTimer.current)
    setUndo({ message, patch })
    undoTimer.current = setTimeout(() => setUndo(null), 5000)
  }
  const undoClear = () => {
    updateEntry(book, undo.patch)
    if (undo.patch.copy_notes !== undefined) setCopyNotes(undo.patch.copy_notes)
    clearTimeout(undoTimer.current)
    setUndo(null)
  }

  const setStatus = (next) => {
    if (next === status) return
    const patch = { status: next }
    if (next === 'read') patch.date_finished = today()
    updateEntry(book, patch)
    if (status === 'read' && (entry?.rating || entry?.date_finished)) {
      offerUndo(entry.rating ? 'Rating and finish date cleared' : 'Finish date cleared', {
        status: 'read',
        rating: entry.rating,
        date_finished: entry.date_finished,
      })
    } else setUndo(null)
    if (next === 'read') {
      celebrate()
      onRead?.(book.id)
    }
  }

  const setRating = (n) => updateEntry(book, { rating: entry?.rating === n ? null : n })

  const toggleOwned = () => {
    if (!owned) {
      updateEntry(book, { owned: true, acquired_on: today() })
      celebrateOwned()
      onRead?.(book.id)
      setUndo(null)
      return
    }
    const { formats = [], acquired_on, copy_notes = '' } = entry
    updateEntry(book, { owned: false })
    setCopyNotes('')
    if (formats.length || acquired_on || copy_notes) {
      offerUndo('Removed from your shelf', { owned: true, formats, acquired_on, copy_notes })
    } else setUndo(null)
  }

  const toggleFormat = (id) => {
    const list = entry?.formats || []
    updateEntry(book, { formats: list.includes(id) ? list.filter((f) => f !== id) : [...list, id] })
  }

  const readingSection = (
    <section className="sheet-section" key="reading">
      <h3 className="section-title">Reading</h3>
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
    </section>
  )

  const copySection = (
    <section className="sheet-section" key="copy">
      <h3 className="section-title">My copy</h3>
      <div className="own-row">
        <button className={`own-btn${owned ? ' on' : ''}`} onClick={toggleOwned} aria-pressed={owned}>
          {owned ? (
            <>
              <CheckIcon width={18} height={18} /> On my shelf
            </>
          ) : (
            'I own this'
          )}
        </button>
        {!owned && (
          <button
            className={`wish-btn${entry?.wishlist ? ' on' : ''}`}
            onClick={() => updateEntry(book, { wishlist: !entry?.wishlist })}
            aria-pressed={Boolean(entry?.wishlist)}
            aria-label={entry?.wishlist ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <HeartIcon filled={entry?.wishlist} width={20} height={20} />
            {entry?.wishlist ? 'Wanted' : 'Want'}
          </button>
        )}
      </div>

      {owned && (
        <div className="read-fields">
          <div className="field">
            <span className="field-label">Format</span>
            <div className="chip-wrap">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  className={`chip gold${entry.formats.includes(f.id) ? ' on' : ''}`}
                  aria-pressed={entry.formats.includes(f.id)}
                  onClick={() => toggleFormat(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span className="field-label">Got it on</span>
            <input
              type="date"
              value={entry.acquired_on || ''}
              max={today()}
              onChange={(e) => updateEntry(book, { acquired_on: e.target.value || null })}
            />
          </label>
          <label className="field">
            <span className="field-label">Edition & notes</span>
            <input
              type="text"
              placeholder="1st edition, signed, paid £4 at a car boot…"
              value={copyNotes}
              onChange={(e) => {
                setCopyNotes(e.target.value)
                updateEntry(book, { copy_notes: e.target.value })
              }}
            />
          </label>
        </div>
      )}
    </section>
  )

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
          <div className="tags state-tags">
            {status !== 'unread' && <span className={`tag state-${status}`}>{status === 'read' ? 'Read' : 'Reading'}</span>}
            {owned && <span className="tag state-owned">Owned</span>}
          </div>
        </div>
      </div>

      {mode === 'collection' ? [copySection, readingSection] : [readingSection, copySection]}

      {undo && (
        <div className="toast" role="status">
          <span>{undo.message}</span>
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
