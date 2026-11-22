import { useCallback, useMemo, useState } from 'react'
import { celebrateOwned } from '../lib/celebrate.js'
import { FORMATS, ratingOf, searchKey, shelfOf } from '../lib/entry.js'
import { EMPTY_FILTERS } from '../lib/filters.js'
import { books, DECADES, decadeOf, LENGTHS, SERIES, SHELVES, sortKey, STATUSES, statusOf, TYPES } from '../lib/books.js'
import { SCRIPT_VERSION } from '../lib/sheets.js'
import { updateEntry, useStore } from '../lib/store.js'
import BookCard, { Cover } from './BookCard.jsx'
import { FilterIcon, HeartIcon, SearchIcon, ShareIcon, SortIcon } from './Icons.jsx'
import Sheet from './Sheet.jsx'

const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
const searchIndex = Object.fromEntries(books.map((b) => [b.id, searchKey(b.title)]))


const RATING_OPTIONS = [
  { id: 5, label: '★★★★★' },
  { id: 4, label: '★★★★' },
  { id: 3, label: '★★★' },
  { id: 2, label: '★★' },
  { id: 1, label: '★' },
  { id: 0, label: 'Unrated' },
]

function matches(book, entry, f, q, mode) {
  const status = entry?.status || 'unread'
  const shelf = shelfOf(entry)
  if (mode === 'reading') {
    if (f.status !== 'all' && status !== f.status) return false
    if (f.shelves.length && !f.shelves.includes(shelf)) return false
  } else {
    if (f.shelf !== 'all' && shelf !== f.shelf) return false
    if (f.statuses.length && !f.statuses.includes(status)) return false
    if (f.formats.length && !(shelf === 'owned' && entry.formats.some((x) => f.formats.includes(x)))) return false
  }
  if (f.types.length && !f.types.includes(book.type)) return false
  if (f.series.length && !book.series.some((s) => f.series.includes(s))) return false
  if (f.lengths.length && !LENGTHS.some((l) => f.lengths.includes(l.id) && book.pages && l.test(book.pages))) return false
  if (f.decades.length && !f.decades.includes(decadeOf(book))) return false
  if (f.ratings.length && !f.ratings.includes(ratingOf(entry) || 0)) return false
  if (q && !searchIndex[book.id].includes(q)) return false
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

export default function LibraryView({ mode, filters, setFilters, sort, setSort, onOpen, justRead, onCelebrate }) {
  const log = useStore((s) => s.log)
  const scriptOutdated = useStore((s) => s.scriptVersion < SCRIPT_VERSION)
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const collection = mode === 'collection'

  const extraCount =
    filters.types.length +
    filters.series.length +
    filters.lengths.length +
    filters.decades.length +
    filters.ratings.length +
    (collection ? filters.formats.length + filters.statuses.length : filters.shelves.length)

  // One tap in the shop: on the shelf, gold confetti from the card.
  const quickOwn = useCallback(
    (book, e) => {
      updateEntry(book, { owned: true, acquired_on: today() })
      const r = e.currentTarget.getBoundingClientRect()
      celebrateOwned({ x: (r.left + r.width / 2) / window.innerWidth, y: r.top / window.innerHeight })
      onCelebrate(book.id)
    },
    [onCelebrate],
  )

  const groups = useMemo(() => {
    const q = searchKey(query)
    const list = books
      .filter((b) => matches(b, log[b.id], filters, q, mode))
      .sort((a, b) =>
        sort === 'date' ? a.published.localeCompare(b.published) : sortKey(a.title).localeCompare(sortKey(b.title)),
      )
    return group(list, sort)
  }, [log, filters, sort, query, mode])

  const shown = groups.reduce((n, g) => n + g.books.length, 0)
  const counts = useMemo(() => {
    const c = { all: books.length, unread: 0, reading: 0, read: 0, owned: 0, missing: 0, wishlist: 0 }
    for (const b of books) {
      c[statusOf(log, b.id)]++
      c[shelfOf(log[b.id])]++
    }
    // "Missing" counts everything not owned, wishlist included.
    c.missing += c.wishlist
    return c
  }, [log])

  const chips = collection ? [{ id: 'all', label: 'All' }, ...SHELVES] : [{ id: 'all', label: 'All' }, ...STATUSES]
  const chipKey = collection ? 'shelf' : 'status'
  const wishlist = useMemo(() => books.filter((b) => shelfOf(log[b.id]) === 'wishlist'), [log])

  return (
    <div className="library">
      <div className="toolbar">
        <label className="search">
          <SearchIcon width={18} height={18} />
          <input
            type="search"
            placeholder={collection ? 'Do I have it? Search titles' : 'Search titles'}
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

      {collection && scriptOutdated && (
        <p className="notice">
          Your sheet script is out of date, so your collection is only saved on this device for now. Paste the new{' '}
          <code>Code.gs</code> and deploy a new version (see SETUP.md).
        </p>
      )}

      {collection && wishlist.length > 0 && !query && filters.shelf === 'all' && (
        <WishlistStrip list={wishlist} onOpen={onOpen} />
      )}

      <div className="chip-row scroll-x" role="tablist" aria-label={collection ? 'Collection' : 'Reading status'}>
        {chips.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={filters[chipKey] === s.id}
            className={`chip${filters[chipKey] === s.id ? ' on' : ''}${collection ? ' gold' : ''}`}
            onClick={() => setFilters({ ...filters, [chipKey]: s.id })}
          >
            {s.label} <span className="chip-count">{counts[s.id]}</span>
          </button>
        ))}
      </div>

      {shown === 0 ? (
        <div className="empty">
          <p className="empty-title">Nothing here… yet.</p>
          <p>{query ? `No book matches “${query}” with these filters.` : 'No books match these filters.'}</p>
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
                <BookCard
                  key={book.id}
                  book={book}
                  entry={log[book.id]}
                  mode={mode}
                  onOpen={onOpen}
                  onQuickOwn={quickOwn}
                  celebrate={justRead === book.id}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {showFilters && (
        <FilterSheet mode={mode} filters={filters} setFilters={setFilters} shown={shown} onClose={() => setShowFilters(false)} />
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

function FilterSheet({ mode, filters, setFilters, shown, onClose }) {
  const upd = (k) => (v) => setFilters({ ...filters, [k]: v })
  return (
    <Sheet title="Filters" onClose={onClose}>
      {mode === 'collection' ? (
        <>
          <ChipGroup label="Format I own" options={FORMATS} selected={filters.formats} onChange={upd('formats')} />
          <ChipGroup label="Reading status" options={STATUSES} selected={filters.statuses} onChange={upd('statuses')} />
        </>
      ) : (
        <ChipGroup label="On my shelf" options={SHELVES} selected={filters.shelves} onChange={upd('shelves')} />
      )}
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
        <button className="btn ghost" onClick={() => setFilters({ ...EMPTY_FILTERS, status: filters.status, shelf: filters.shelf })}>
          Clear
        </button>
        <button className="btn primary" onClick={onClose}>
          Show {shown} {shown === 1 ? 'book' : 'books'}
        </button>
      </div>
    </Sheet>
  )
}

// Horizontal strip of wanted books, with a share button for a text list.
function WishlistStrip({ list, onOpen }) {
  const share = async () => {
    const text = `Stephen King books I'm looking for:\n${list.map((b) => `• ${b.title} (${b.published.slice(0, 4)})`).join('\n')}`
    try {
      if (navigator.share) await navigator.share({ title: 'My King wishlist', text })
      else {
        await navigator.clipboard.writeText(text)
        alert('Wishlist copied')
      }
    } catch {
      /* share sheet dismissed */
    }
  }
  return (
    <section className="wish-strip" aria-label="Wishlist">
      <div className="wish-head">
        <h2>
          <HeartIcon filled width={14} height={14} /> Wishlist <span>{list.length}</span>
        </h2>
        <button className="icon-btn" onClick={share} aria-label="Share wishlist">
          <ShareIcon width={18} height={18} />
        </button>
      </div>
      <div className="wish-row scroll-x">
        {list.map((b) => (
          <button key={b.id} className="wish-item" onClick={() => onOpen(b.id)}>
            <Cover book={b} size="S" />
            <span>{b.title}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
