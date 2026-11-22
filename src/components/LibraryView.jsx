import { useMemo, useState } from 'react'
import { ratingOf } from '../lib/entry.js'
import { EMPTY_FILTERS } from '../lib/filters.js'
import { books, DECADES, decadeOf, LENGTHS, SERIES, sortKey, STATUSES, statusOf, TYPES } from '../lib/books.js'
import { useStore } from '../lib/store.js'
import BookCard from './BookCard.jsx'
import { FilterIcon, SearchIcon, SortIcon } from './Icons.jsx'
import Sheet from './Sheet.jsx'


const RATING_OPTIONS = [
  { id: 5, label: '★★★★★' },
  { id: 4, label: '★★★★' },
  { id: 3, label: '★★★' },
  { id: 2, label: '★★' },
  { id: 1, label: '★' },
  { id: 0, label: 'Unrated' },
]

function matches(book, entry, f, q) {
  const status = entry?.status || 'unread'
  if (f.status !== 'all' && status !== f.status) return false
  if (f.types.length && !f.types.includes(book.type)) return false
  if (f.series.length && !book.series.some((s) => f.series.includes(s))) return false
  if (f.lengths.length && !LENGTHS.some((l) => f.lengths.includes(l.id) && book.pages && l.test(book.pages))) return false
  if (f.decades.length && !f.decades.includes(decadeOf(book))) return false
  if (f.ratings.length && !f.ratings.includes(ratingOf(entry) || 0)) return false
  if (q && !book.title.toLowerCase().includes(q)) return false
  return true
}

function group(list, sort) {
  const groups = []
  for (const book of list) {
    const k = sortKey(book.title)[0]
    const label = sort === 'date' ? decadeOf(book) : /[a-z]/.test(k) ? k.toUpperCase() : '#'
    const last = groups[groups.length - 1]
    if (last?.label === label) last.books.push(book)
    else groups.push({ label, books: [book] })
  }
  return groups
}

export default function LibraryView({ filters, setFilters, sort, setSort, onOpen, justRead }) {
  const log = useStore((s) => s.log)
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const extraCount =
    filters.types.length + filters.series.length + filters.lengths.length + filters.decades.length + filters.ratings.length

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = books
      .filter((b) => matches(b, log[b.id], filters, q))
      .sort((a, b) =>
        sort === 'date' ? a.published.localeCompare(b.published) : sortKey(a.title).localeCompare(sortKey(b.title)),
      )
    return group(list, sort)
  }, [log, filters, sort, query])

  const shown = groups.reduce((n, g) => n + g.books.length, 0)
  const counts = useMemo(() => {
    const c = { all: books.length, unread: 0, reading: 0, read: 0 }
    for (const b of books) c[statusOf(log, b.id)]++
    return c
  }, [log])

  return (
    <div className="library">
      <div className="toolbar">
        <label className="search">
          <SearchIcon width={18} height={18} />
          <input
            type="search"
            placeholder="Search titles"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
            autoComplete="off"
          />
        </label>
        <button
          className="filter-btn sort-btn"
          onClick={() => setSort(sort === 'date' ? 'az' : 'date')}
          aria-label={`Sorted by ${sort === 'date' ? 'release year' : 'title'}. Tap to change.`}
        >
          <SortIcon width={16} height={16} />
          {sort === 'date' ? 'Year' : 'A–Z'}
        </button>
        <button
          className={`filter-btn${extraCount ? ' on' : ''}`}
          onClick={() => setShowFilters(true)}
          aria-label={`Filters${extraCount ? `, ${extraCount} active` : ''}`}
        >
          <FilterIcon width={18} height={18} />
          {extraCount ? <span className="count">{extraCount}</span> : null}
        </button>
      </div>

      <div className="chip-row scroll-x" role="tablist" aria-label="Reading status">
        {[{ id: 'all', label: 'All' }, ...STATUSES].map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={filters.status === s.id}
            className={`chip${filters.status === s.id ? ' on' : ''}`}
            onClick={() => setFilters({ ...filters, status: s.id })}
          >
            {s.label} <span className="chip-count">{counts[s.id]}</span>
          </button>
        ))}
      </div>

      {shown === 0 ? (
        <div className="empty">
          <p className="empty-title">Nothing here… yet.</p>
          <p>No books match these filters.</p>
          <button
            className="btn"
            onClick={() => {
              setFilters(EMPTY_FILTERS)
              setQuery('')
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="group">
            <h2 className="group-label">
              {g.label}
              <span>{g.books.length}</span>
            </h2>
            <div className="grid">
              {g.books.map((book) => (
                <BookCard key={book.id} book={book} entry={log[book.id]} onOpen={onOpen} justRead={justRead === book.id} />
              ))}
            </div>
          </section>
        ))
      )}

      {showFilters && (
        <FilterSheet filters={filters} setFilters={setFilters} shown={shown} onClose={() => setShowFilters(false)} />
      )}
    </div>
  )
}

function ChipGroup({ label, options, selected, onChange }) {
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  return (
    <fieldset className="filter-group">
      <legend>{label}</legend>
      <div className="chip-wrap">
        {options.map((o) => (
          <button
            key={o.id}
            className={`chip${selected.includes(o.id) ? ' on' : ''}`}
            aria-pressed={selected.includes(o.id)}
            onClick={() => toggle(o.id)}
          >
            {o.label}
            {o.hint && <small> {o.hint}</small>}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function FilterSheet({ filters, setFilters, shown, onClose }) {
  const upd = (k) => (v) => setFilters({ ...filters, [k]: v })
  return (
    <Sheet title="Filters" onClose={onClose}>
      <ChipGroup label="Type" options={TYPES} selected={filters.types} onChange={upd('types')} />
      <ChipGroup
        label="Series & universe"
        options={SERIES.map((s) => ({ id: s, label: s }))}
        selected={filters.series}
        onChange={upd('series')}
      />
      <ChipGroup label="Length" options={LENGTHS} selected={filters.lengths} onChange={upd('lengths')} />
      <ChipGroup
        label="Decade"
        options={DECADES.map((d) => ({ id: d, label: d }))}
        selected={filters.decades}
        onChange={upd('decades')}
      />
      <ChipGroup label="My rating" options={RATING_OPTIONS} selected={filters.ratings} onChange={upd('ratings')} />
      <div className="sheet-actions">
        <button className="btn ghost" onClick={() => setFilters({ ...EMPTY_FILTERS, status: filters.status })}>
          Clear
        </button>
        <button className="btn primary" onClick={onClose}>
          Show {shown} {shown === 1 ? 'book' : 'books'}
        </button>
      </div>
    </Sheet>
  )
}
