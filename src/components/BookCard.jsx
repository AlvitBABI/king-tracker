import { memo, useState } from 'react'
import { coverUrl, TYPE_LABEL } from '../lib/books.js'
import { FORMATS, ratingOf, shelfOf } from '../lib/entry.js'
import { CheckIcon, HeartIcon, PlusIcon, Stars } from './Icons.jsx'

const FORMAT_SHORT = Object.fromEntries(FORMATS.map((f) => [f.id, f.short]))

export function Cover({ book, size = 'M', className = '', eager = false }) {
  const [failed, setFailed] = useState(!coverUrl(book))
  return (
    <div
      className={`cover ${className}`}
      // Large covers: show the (usually cached) medium image while the big one loads.
      style={size === 'L' && !failed ? { backgroundImage: `url(${coverUrl(book, 'M')})`, backgroundSize: 'cover' } : undefined}
    >
      {failed ? (
        <div className="cover-fallback">
          <span>{book.title}</span>
        </div>
      ) : (
        <img src={coverUrl(book, size)} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />
      )}
    </div>
  )
}

function BookCard({ book, entry, mode, onOpen, onQuickOwn, celebrate }) {
  const status = entry?.status || 'unread'
  const rating = ratingOf(entry)
  const shelf = shelfOf(entry)
  const collection = mode === 'collection'
  const year = book.published.slice(0, 4)

  let meta
  if (collection) {
    meta =
      shelf === 'owned'
        ? entry.formats?.length
          ? entry.formats.map((f) => FORMAT_SHORT[f]).join(' · ')
          : 'On the shelf'
        : shelf === 'wishlist'
          ? 'Wishlist'
          : `${year} · ${book.pages ?? '?'} pp`
  } else meta = rating ? <Stars value={rating} size={11} /> : `${year} · ${book.pages ?? '?'} pp`

  const label = collection ? (shelf === 'owned' ? 'owned' : shelf === 'wishlist' ? 'on wishlist' : 'not owned') : status

  return (
    <div className={`card ${collection ? `shelf-${shelf}` : `status-${status}`}${celebrate ? ' just-read' : ''}`}>
      <button className="card-hit" onClick={() => onOpen(book.id)} aria-label={`${book.title}, ${year}, ${label}`}>
        <div className="cover-wrap">
          <Cover book={book} />
          {book.type !== 'novel' && <span className={`badge badge-${book.type}`}>{TYPE_LABEL[book.type]}</span>}
          {!collection && status === 'read' && (
            <span className="read-mark">
              <CheckIcon width={14} height={14} />
            </span>
          )}
          {!collection && status === 'reading' && <span className="reading-ribbon">Reading</span>}
          {collection && shelf === 'owned' && (
            <span className="read-mark own-mark">
              <CheckIcon width={14} height={14} />
            </span>
          )}
          {collection && shelf === 'wishlist' && (
            <span className="wish-ribbon">
              <HeartIcon filled width={10} height={10} /> Want
            </span>
          )}
        </div>
        <span className="card-title">{book.title}</span>
        <span className={`card-meta${collection && shelf === 'wishlist' ? ' wish' : ''}`}>{meta}</span>
      </button>
      {collection && shelf !== 'owned' && (
        <button className="quick-own" onClick={(e) => onQuickOwn(book, e)} aria-label={`I bought ${book.title}`}>
          <PlusIcon width={16} height={16} />
        </button>
      )}
    </div>
  )
}

export default memo(BookCard)
