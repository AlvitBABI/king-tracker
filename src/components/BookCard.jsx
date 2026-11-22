import { memo, useState } from 'react'
import { coverUrl, TYPE_LABEL } from '../lib/books.js'
import { ratingOf } from '../lib/entry.js'
import { CheckIcon, Stars } from './Icons.jsx'

export function Cover({ book, size = 'M', className = '', eager = false }) {
  const [failed, setFailed] = useState(false)
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

function BookCard({ book, entry, onOpen, justRead }) {
  const status = entry?.status || 'unread'
  const rating = ratingOf(entry)
  return (
    <button
      className={`card status-${status}${justRead ? ' just-read' : ''}`}
      onClick={() => onOpen(book.id)}
      aria-label={`${book.title}, ${book.published.slice(0, 4)}, ${status}`}
    >
      <div className="cover-wrap">
        <Cover book={book} />
        {book.type !== 'novel' && <span className={`badge badge-${book.type}`}>{TYPE_LABEL[book.type]}</span>}
        {status === 'read' && (
          <span className="read-mark">
            <CheckIcon width={14} height={14} />
          </span>
        )}
        {status === 'reading' && <span className="reading-ribbon">Reading</span>}
      </div>
      <span className="card-title">{book.title}</span>
      <span className="card-meta">
        {rating ? <Stars value={rating} size={11} /> : `${book.published.slice(0, 4)} · ${book.pages ?? '?'} pp`}
      </span>
    </button>
  )
}

export default memo(BookCard)
