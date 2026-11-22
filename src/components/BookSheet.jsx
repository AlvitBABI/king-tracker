import { useState } from 'react'
import { bookById, TYPE_LABEL } from '../lib/books.js'
import { celebrateOwned } from '../lib/celebrate.js'
import { FORMATS } from '../lib/entry.js'
import { storiesInBook, storyStatus } from '../lib/stories.js'
import { updateEntry, useStore } from '../lib/store.js'
import { Cover } from './BookCard.jsx'
import { CheckIcon, HeartIcon } from './Icons.jsx'
import ReadingSection, { today, useUndo } from './ReadingSection.jsx'
import Sheet from './Sheet.jsx'

export default function BookSheet({ bookId, mode, onClose, onRead, onOpen }) {
  const book = bookById[bookId]
  const entry = useStore((s) => s.log[bookId])
  const status = entry?.status || 'unread'
  const owned = Boolean(entry?.owned)
  const [copyNotes, setCopyNotes] = useState(entry?.copy_notes || '')

  // Leaving "Read" (or un-owning) clears the details that only belong to it;
  // offer a few seconds to undo.
  const [toast, offerUndo, clearUndo] = useUndo((patch) => {
    updateEntry(book, patch)
    if (patch.copy_notes !== undefined) setCopyNotes(patch.copy_notes)
  })

  const toggleOwned = () => {
    if (!owned) {
      updateEntry(book, { owned: true, acquired_on: today() })
      celebrateOwned()
      onRead?.(book.id)
      clearUndo()
      return
    }
    const { formats = [], acquired_on, copy_notes = '' } = entry
    updateEntry(book, { owned: false })
    setCopyNotes('')
    if (formats.length || acquired_on || copy_notes) {
      offerUndo('Removed from your shelf', { owned: true, formats, acquired_on, copy_notes })
    } else clearUndo()
  }

  const toggleFormat = (id) => {
    const list = entry?.formats || []
    updateEntry(book, { formats: list.includes(id) ? list.filter((f) => f !== id) : [...list, id] })
  }

  const readingSection = (
    <ReadingSection key="reading" item={book} entry={entry} offerUndo={offerUndo} clearUndo={clearUndo} onRead={onRead} />
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

      <StoriesInside book={book} onOpen={onOpen} />

      {toast}
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

// For collections: the stories inside, with what you've read. Collapsed by default.
function StoriesInside({ book, onOpen }) {
  const log = useStore((s) => s.log)
  const [open, setOpen] = useState(false)
  const list = storiesInBook(book.id)
  if (!list.length) return null
  const read = list.filter((s) => storyStatus(log, s).status === 'read').length
  return (
    <section className="sheet-section">
      <button className="inside-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="section-title">Stories inside</span>
        <span className="muted small">
          {read} / {list.length} read {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <ul className="story-list compact">
          {list.map((s) => {
            const st = storyStatus(log, s)
            return (
              <li key={s.id}>
                <button className="story-row" onClick={() => onOpen(s.id)}>
                  <span className={`story-dot ${st.status}`} aria-hidden />
                  <span className="story-title">{s.title}</span>
                  <span className="story-meta">{s.published.slice(0, 4)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
