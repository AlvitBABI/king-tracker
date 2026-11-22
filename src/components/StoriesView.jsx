import { useMemo, useState } from 'react'
import { decadeOf, sortKey, STATUSES } from '../lib/books.js'
import { searchKey } from '../lib/entry.js'
import {
  computeStories,
  stories,
  STORY_BOOKS,
  STORY_LENGTHS,
  storyOwnedIn,
  storyRating,
  storyStatus,
  UNCOLLECTED,
} from '../lib/stories.js'
import { updateEntry, useStore } from '../lib/store.js'
import { Cover } from './BookCard.jsx'
import { CheckIcon, FilterIcon, SearchIcon, SortIcon, Stars } from './Icons.jsx'
import Sheet from './Sheet.jsx'

export const EMPTY_STORY_FILTERS = { status: 'all', shelf: 'all', books: [], lengths: [], decades: [] }

const SORTS = [
  { id: 'book', label: 'By book' },
  { id: 'date', label: 'Year' },
  { id: 'az', label: 'A–Z' },
]
const SHELF_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'owned', label: 'On my shelf' },
  { id: 'missing', label: 'Not on shelf' },
]
const searchIndex = Object.fromEntries(stories.map((s) => [s.id, searchKey(s.title)]))
const STORY_DECADES = [...new Set(stories.map(decadeOf))].sort()
const BOOK_OPTIONS = [
  ...STORY_BOOKS.map((g) => ({ id: g.book.id, label: g.book.title })),
  { id: 'none', label: 'Not in a book' },
]

export const storyMatchesQuery = (story, q) => searchIndex[story.id].includes(q)

function matches(story, log, f, q, mode) {
  if (q && !storyMatchesQuery(story, q)) return false
  if (mode === 'collection') {
    const owned = storyOwnedIn(log, story).length > 0
    if (f.shelf === 'owned' && !owned) return false
    if (f.shelf === 'missing' && owned) return false
  } else if (f.status !== 'all' && storyStatus(log, story).status !== f.status) return false
  if (f.books.length && !f.books.some((id) => (id === 'none' ? !story.collections.length : story.collections.includes(id))))
    return false
  if (f.lengths.length && !f.lengths.includes(story.length)) return false
  if (f.decades.length && !f.decades.includes(decadeOf(story))) return false
  return true
}

export default function StoriesView({ mode, filters, setFilters, sort, setSort, query, setQuery, onOpen }) {
  const log = useStore((s) => s.log)
  const [showFilters, setShowFilters] = useState(false)
  const [expanded, setExpanded] = useState(() => new Set())
  const collection = mode === 'collection'
  const q = searchKey(query)
  const extraCount = filters.books.length + filters.lengths.length + filters.decades.length
  const chipKey = collection ? 'shelf' : 'status'
  const narrowed = Boolean(q) || extraCount > 0 || filters[chipKey] !== 'all'

  const visible = useMemo(() => stories.filter((s) => matches(s, log, filters, q, mode)), [log, filters, q, mode])
  const visibleIds = useMemo(() => new Set(visible.map((s) => s.id)), [visible])

  const counts = useMemo(() => {
    const c = { all: stories.length, unread: 0, reading: 0, read: 0, owned: 0, missing: 0 }
    for (const s of stories) {
      c[storyStatus(log, s).status]++
      c[storyOwnedIn(log, s).length ? 'owned' : 'missing']++
    }
    return c
  }, [log])

  const groups = useMemo(() => {
    if (sort === 'book') {
      return [...STORY_BOOKS, { book: null, stories: UNCOLLECTED }]
        .map((g) => ({ ...g, key: g.book?.id || 'none', shown: g.stories.filter((s) => visibleIds.has(s.id)) }))
        .filter((g) => g.shown.length)
    }
    const list = [...visible].sort((a, b) =>
      sort === 'date' ? a.published.localeCompare(b.published) : sortKey(a.title).localeCompare(sortKey(b.title)),
    )
    const out = []
    for (const s of list) {
      const k = sortKey(s.title)[0]
      const label = sort === 'date' ? decadeOf(s) : /[a-z]/.test(k) ? k.toUpperCase() : '#'
      const last = out[out.length - 1]
      if (last?.label === label) last.shown.push(s)
      else out.push({ key: label, label, shown: [s] })
    }
    return out
  }, [sort, visible, visibleIds])

  const p = computeStories(log)
  const toggle = (key) => {
    const next = new Set(expanded)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setExpanded(next)
  }
  const allOpen = sort === 'book' && groups.every((g) => expanded.has(g.key))

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <SearchIcon width={18} height={18} />
          <input
            type="search"
            placeholder="Search stories"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
            autoComplete="off"
          />
        </label>
        <button
          className="filter-btn sort-btn"
          onClick={() => setSort(SORTS[(SORTS.findIndex((s) => s.id === sort) + 1) % SORTS.length].id)}
          aria-label={`Sorted ${SORTS.find((s) => s.id === sort).label}. Tap to change.`}
        >
          <SortIcon width={16} height={16} />
          {SORTS.find((s) => s.id === sort).label}
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

      <div className="chip-row scroll-x" role="tablist" aria-label="Story status">
        {(collection ? SHELF_CHIPS : [{ id: 'all', label: 'All' }, ...STATUSES]).map((s) => (
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

      <p className="stories-progress muted small">
        <span>
        {collection ? (
          <>
            <strong>{counts.owned}</strong> of {stories.length} stories are on your shelf
          </>
        ) : (
          <>
            <strong>
              {p.read} / {p.total}
            </strong>{' '}
            stories read · {p.pct}%
          </>
        )}
        </span>
        {sort === 'book' && !narrowed && (
          <button
            className="link-btn inline"
            onClick={() => setExpanded(allOpen ? new Set() : new Set(groups.map((g) => g.key)))}
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </p>

      {!groups.length ? (
        <div className="empty">
          <p className="empty-title">No stories found.</p>
          <button
            className="btn"
            onClick={() => {
              setFilters(EMPTY_STORY_FILTERS)
              setQuery('')
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        groups.map((g) =>
          sort === 'book' ? (
            <BookGroup
              key={g.key}
              group={g}
              log={log}
              mode={mode}
              open={narrowed || expanded.has(g.key)}
              onToggle={() => toggle(g.key)}
              onOpen={onOpen}
            />
          ) : (
            <section key={g.key} className="group">
              <h2 className="group-label">
                {g.label}
                <span>{g.shown.length}</span>
              </h2>
              <StoryList list={g.shown} log={log} mode={mode} onOpen={onOpen} showBook />
            </section>
          ),
        )
      )}

      {showFilters && (
        <StoryFilterSheet filters={filters} setFilters={setFilters} shown={visible.length} onClose={() => setShowFilters(false)} />
      )}
    </>
  )
}

function BookGroup({ group, log, mode, open, onToggle, onOpen }) {
  const { book, stories: all, shown } = group
  const read = all.filter((s) => storyStatus(log, s).status === 'read').length
  const owned = book && log[book.id]?.owned
  return (
    <section className={`story-group${open ? ' open' : ''}`}>
      <button className="story-group-head" onClick={onToggle} aria-expanded={open}>
        {book ? <Cover book={book} size="S" className="mini" /> : <span className="mini-blank">?</span>}
        <span className="sg-title">
          {book ? book.title : 'Not in a book'}
          <span className="muted small">
            {book ? `${book.published.slice(0, 4)} · ` : ''}
            {shown.length === all.length ? all.length : `${shown.length} of ${all.length}`}{' '}
            {all.length === 1 ? 'story' : 'stories'}
          </span>
        </span>
        {mode === 'collection' ? (
          book &&
          (owned ? (
            <span className="tag state-owned">
              <CheckIcon width={11} height={11} /> Owned
            </span>
          ) : (
            <span className="tag">Not owned</span>
          ))
        ) : (
          <span className={`sg-count${read === all.length ? ' done' : ''}`}>
            {read}/{all.length}
          </span>
        )}
        <span className="chev" aria-hidden>
          ▾
        </span>
      </button>
      {open && <StoryList list={shown} log={log} mode={mode} onOpen={onOpen} />}
    </section>
  )
}

export function StoryList({ list, log, mode, onOpen, showBook = false }) {
  return (
    <ul className="story-list">
      {list.map((s) => (
        <StoryRow key={s.id} story={s} log={log} mode={mode} onOpen={onOpen} showBook={showBook} />
      ))}
    </ul>
  )
}

function StoryRow({ story, log, mode, onOpen, showBook }) {
  const { status, via } = storyStatus(log, story)
  const rating = storyRating(log, story)
  const ownedIn = storyOwnedIn(log, story)
  const where = story.collections.length ? null : 'not in a book'
  const meta = [
    story.published.slice(0, 4),
    story.length === 'novella' ? 'novella-length' : null,
    showBook ? (ownedIn[0]?.title ?? (story.collections.length ? null : where)) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  // Quick toggle: only for stories you log yourself (not ones read via a book).
  const canToggle = mode !== 'collection' && !via
  return (
    <li className="story-li">
      <button className="story-row" onClick={() => onOpen(story.id)}>
        <span className={`story-dot ${status}`} aria-hidden />
        <span className="story-main">
          <span className="story-title">{story.title}</span>
          <span className="story-meta">
            {meta}
            {via && <em> · read in {via.title}</em>}
          </span>
        </span>
        {mode === 'collection' ? (
          ownedIn.length ? (
            <span className="story-own">
              <CheckIcon width={12} height={12} />
            </span>
          ) : null
        ) : rating ? (
          <Stars value={rating} size={10} />
        ) : null}
      </button>
      {canToggle && (
        <button
          className={`story-check${status === 'read' ? ' on' : ''}`}
          aria-label={status === 'read' ? `Mark ${story.title} unread` : `Mark ${story.title} read`}
          onClick={() => updateEntry(story, status === 'read' ? { status: 'unread' } : { status: 'read' })}
        >
          <CheckIcon width={14} height={14} />
        </button>
      )}
    </li>
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
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function StoryFilterSheet({ filters, setFilters, shown, onClose }) {
  const upd = (k) => (v) => setFilters({ ...filters, [k]: v })
  return (
    <Sheet title="Filter stories" onClose={onClose}>
      <ChipGroup label="Found in" options={BOOK_OPTIONS} selected={filters.books} onChange={upd('books')} />
      <ChipGroup label="Length" options={STORY_LENGTHS} selected={filters.lengths} onChange={upd('lengths')} />
      <ChipGroup
        label="First published"
        options={STORY_DECADES.map((d) => ({ id: d, label: d }))}
        selected={filters.decades}
        onChange={upd('decades')}
      />
      <div className="sheet-actions">
        <button
          className="btn ghost"
          onClick={() => setFilters({ ...EMPTY_STORY_FILTERS, status: filters.status, shelf: filters.shelf })}
        >
          Clear
        </button>
        <button className="btn primary" onClick={onClose}>
          Show {shown} {shown === 1 ? 'story' : 'stories'}
        </button>
      </div>
    </Sheet>
  )
}
