import books from '../data/books.json'

export { books }
export const bookById = Object.fromEntries(books.map((b) => [b.id, b]))

export const TYPES = [
  { id: 'novel', label: 'Novels' },
  { id: 'bachman', label: 'Bachman' },
  { id: 'novella', label: 'Novellas' },
  { id: 'collection', label: 'Collections' },
  { id: 'non-fiction', label: 'Non-fiction' },
]
export const TYPE_LABEL = {
  novel: 'Novel',
  bachman: 'Bachman',
  novella: 'Novella',
  collection: 'Collection',
  'non-fiction': 'Non-fiction',
}

export const LENGTHS = [
  { id: 'short', label: 'Short', hint: '< 300 pp', test: (p) => p < 300 },
  { id: 'medium', label: 'Medium', hint: '300–699', test: (p) => p >= 300 && p < 700 },
  { id: 'doorstopper', label: 'Doorstopper', hint: '700+', test: (p) => p >= 700 },
]

export const STATUSES = [
  { id: 'unread', label: 'Unread' },
  { id: 'reading', label: 'Reading' },
  { id: 'read', label: 'Read' },
]

export const SERIES = [...new Set(books.flatMap((b) => b.series))].sort()
export const DECADES = [...new Set(books.map((b) => decadeOf(b)))].sort()

export function decadeOf(book) {
  return `${book.published.slice(0, 3)}0s`
}

export const yearOf = (book) => book.published.slice(0, 4)

// "The Stand" files under S, "'Salem's Lot" under S, like a library shelf.
export const sortKey = (title) =>
  title
    .toLowerCase()
    .replace(/^[^a-z0-9]+/, '')
    .replace(/^(the|a|an)\s+/, '')

export function coverUrl(book, size = 'M') {
  const key = book.olid ? `olid/${book.olid}` : `isbn/${book.isbn}`
  return `https://covers.openlibrary.org/b/${key}-${size}.jpg?default=false`
}

export const statusOf = (log, id) => log[id]?.status || 'unread'

export function computeProgress(log) {
  const read = books.filter((b) => statusOf(log, b.id) === 'read')
  return {
    read: read.length,
    reading: books.filter((b) => statusOf(log, b.id) === 'reading').length,
    total: books.length,
    pct: Math.round((read.length / books.length) * 100),
    pages: read.reduce((n, b) => n + (b.pages || 0), 0),
  }
}
