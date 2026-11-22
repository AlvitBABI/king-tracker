import { useEffect, useMemo, useState } from 'react'
import books from './data/books.json'
import BookCard from './components/BookCard.jsx'
import './App.css'

const SORTS = [
  { id: 'date', label: 'Release date' },
  { id: 'az', label: 'A–Z' },
]

// "The Stand" files under S, "'Salem's Lot" under S, like a library shelf.
const sortKey = (title) =>
  title
    .toLowerCase()
    .replace(/^[^a-z0-9]+/, '')
    .replace(/^(the|a|an)\s+/, '')

function groupBooks(list, sort) {
  const groups = []
  for (const book of list) {
    const label =
      sort === 'date'
        ? `${book.published.slice(0, 3)}0s`
        : /[a-z]/.test(sortKey(book.title)[0])
          ? sortKey(book.title)[0].toUpperCase()
          : '#'
    const last = groups[groups.length - 1]
    if (last?.label === label) last.books.push(book)
    else groups.push({ label, books: [book] })
  }
  return groups
}

export default function App() {
  const [sort, setSort] = useState(() => localStorage.getItem('sort') || 'date')

  useEffect(() => {
    localStorage.setItem('sort', sort)
  }, [sort])

  const groups = useMemo(() => {
    const list = [...books].sort((a, b) =>
      sort === 'date'
        ? a.published.localeCompare(b.published)
        : sortKey(a.title).localeCompare(sortKey(b.title)),
    )
    return groupBooks(list, sort)
  }, [sort])

  return (
    <div className="app">
      <header className="header">
        <h1>King Tracker</h1>
        <p className="subtitle">{books.length} books by Stephen King</p>
        <div className="sort-toggle" role="group" aria-label="Sort books">
          {SORTS.map((s) => (
            <button
              key={s.id}
              className={sort === s.id ? 'active' : ''}
              aria-pressed={sort === s.id}
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      <main>
        {groups.map((g) => (
          <section key={g.label} className="group">
            <h2 className="group-label">{g.label}</h2>
            <ul className="grid">
              {g.books.map((book) => (
                <li key={book.id}>
                  <BookCard book={book} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  )
}
