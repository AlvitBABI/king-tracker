import { useState } from 'react'

const TYPE_LABELS = {
  collection: 'Collection',
  novella: 'Novella',
  'non-fiction': 'Non-fiction',
  bachman: 'Bachman',
}

// default=false makes Open Library return 404 instead of a blank 1px image,
// so onError can show our own placeholder.
function coverUrl(book) {
  const key = book.isbn ? `isbn/${book.isbn}` : `olid/${book.olid}`
  return `https://covers.openlibrary.org/b/${key}-M.jpg?default=false`
}

export default function BookCard({ book }) {
  const [failed, setFailed] = useState(false)
  const typeLabel = TYPE_LABELS[book.type]

  return (
    <article className="card">
      <div className="cover">
        {failed ? (
          <div className="cover-fallback">{book.title}</div>
        ) : (
          <img
            src={coverUrl(book)}
            alt={`Cover of ${book.title}`}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        )}
        {typeLabel && <span className={`badge badge-${book.type}`}>{typeLabel}</span>}
      </div>
      <h3 className="card-title">{book.title}</h3>
      <p className="card-meta">
        {book.published.slice(0, 4)}
        {book.pages ? ` · ${book.pages} pp` : ''}
      </p>
    </article>
  )
}
