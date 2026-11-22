import { useMemo } from 'react'
import { COLLECTOR_BADGES, evaluateBadges } from '../lib/badges.js'
import { bookById, books, computeCollection, computeProgress, statusOf, TYPES } from '../lib/books.js'
import { FORMATS, isOwned } from '../lib/entry.js'
import { exportCsv } from '../lib/csv.js'
import { useStore } from '../lib/store.js'
import { Cover } from './BookCard.jsx'
import { Stars } from './Icons.jsx'

const THIS_YEAR = new Date().getFullYear()

// Horizontal bars: label | bar | value. One series, so one colour and direct labels.
function BarList({ rows, max, unit = '' }) {
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.label} aria-label={`${r.label}: ${r.value}${unit}`}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${max ? (r.value / max) * 100 : 0}%` }} />
          </span>
          <span className="bar-value">{r.display ?? r.value}</span>
        </li>
      ))}
    </ul>
  )
}

// Vertical columns for books finished per year.
function Columns({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="columns" role="list">
      {rows.map((r) => (
        <div className="col" key={r.label} role="listitem" aria-label={`${r.label}: ${r.value} books`}>
          <span className="col-value">{r.value || ''}</span>
          <span className="col-bar" style={{ height: `${(r.value / max) * 100}%` }} />
          <span className="col-label">{r.label}</span>
        </div>
      ))}
    </div>
  )
}

function BadgePanel({ title, badges, gold = false }) {
  const earned = badges.filter((b) => b.earned).length
  return (
    <section className={`panel${gold ? ' gold' : ''}`}>
      <h3>
        {title} <span className="muted">{earned} / {badges.length}</span>
      </h3>
      <div className="badges">
        {badges.map((b) => (
          <div key={b.id} className={`badge-card${b.earned ? ' earned' : ''}`} title={b.desc}>
            <span className="badge-icon" aria-hidden>
              {b.icon}
            </span>
            <span className="badge-name">{b.name}</span>
            <span className="badge-desc">{b.desc}</span>
            {!b.earned && (
              <span className="badge-progress" aria-label={`${b.done} of ${b.needed}`}>
                <span style={{ width: `${(b.done / b.needed) * 100}%` }} />
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function CollectionStats({ log, onOpen }) {
  const c = computeCollection(log)
  const badges = useMemo(() => evaluateBadges(log, COLLECTOR_BADGES), [log])
  const owned = books.filter((b) => isOwned(log[b.id]))
  const formatRows = FORMATS.map((f) => ({ label: f.label, value: owned.filter((b) => log[b.id].formats.includes(f.id)).length }))
  const typeRows = TYPES.map((t) => {
    const list = books.filter((b) => b.type === t.id)
    const done = list.filter((b) => isOwned(log[b.id])).length
    return { label: t.label, value: done, total: list.length, display: `${done}/${list.length}` }
  })
  const recent = owned
    .filter((b) => log[b.id].acquired_on)
    .sort((a, b) => log[b.id].acquired_on.localeCompare(log[a.id].acquired_on))
    .slice(0, 5)
  const readNotOwned = books.filter((b) => statusOf(log, b.id) === 'read' && !isOwned(log[b.id])).length

  return (
    <>
      <h2 className="view-title gold-title">Your collection</h2>
      <div className="tiles gold">
        <div className="tile">
          <span className="tile-num">{c.owned}</span>
          <span className="tile-label">books owned</span>
        </div>
        <div className="tile">
          <span className="tile-num">{c.pct}%</span>
          <span className="tile-label">complete</span>
        </div>
        <div className="tile">
          <span className="tile-num">{c.tbr}</span>
          <span className="tile-label">unread on the shelf</span>
        </div>
        <div className="tile">
          <span className="tile-num">{c.wishlist}</span>
          <span className="tile-label">on the wishlist</span>
        </div>
      </div>
      <p className="muted small center stat-note">
        {c.pages.toLocaleString()} pages on your shelf
        {readNotOwned ? ` · ${readNotOwned} read but not owned` : ''}
      </p>

      <BadgePanel title="Collector badges" badges={badges} gold />

      <section className="panel">
        <h3>Shelf by type</h3>
        <ul className="barlist gold">
          {typeRows.map((r) => (
            <li key={r.label} aria-label={`${r.label}: ${r.display}`}>
              <span className="bar-label">{r.label}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${(r.value / r.total) * 100}%` }} />
              </span>
              <span className="bar-value">{r.display}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>Formats</h3>
        {formatRows.some((r) => r.value) ? (
          <div className="gold">
            <BarList rows={formatRows} max={Math.max(...formatRows.map((r) => r.value))} />
          </div>
        ) : (
          <p className="muted small">Tag the format of your copies to see this.</p>
        )}
      </section>

      <section className="panel">
        <h3>Latest finds</h3>
        {recent.length ? (
          <ol className="top5">
            {recent.map((b) => (
              <li key={b.id}>
                <button onClick={() => onOpen(b.id)}>
                  <Cover book={b} size="S" className="mini" />
                  <span className="top5-title">
                    {b.title}
                    <span className="muted small">{formatDay(log[b.id].acquired_on)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted small">Books you add to your shelf will appear here.</p>
        )}
      </section>
    </>
  )
}

const formatDay = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export default function StatsView({ mode, onOpen }) {
  const log = useStore((s) => s.log)
  const collectionFirst = mode === 'collection'
  return (
    <div className="stats">
      {collectionFirst && <CollectionStats log={log} onOpen={onOpen} />}
      <ReadingStats log={log} onOpen={onOpen} />
      {!collectionFirst && <CollectionStats log={log} onOpen={onOpen} />}
      <button className="btn big block" onClick={() => exportCsv(log)}>
        Export CSV
      </button>
    </div>
  )
}

function ReadingStats({ log, onOpen }) {
  const p = computeProgress(log)
  const badges = useMemo(() => evaluateBadges(log), [log])

  const read = Object.values(log).filter((e) => e.status === 'read' && bookById[e.book_id])
  const rated = read.filter((e) => e.rating)
  const avg = rated.length ? (rated.reduce((n, e) => n + e.rating, 0) / rated.length).toFixed(1) : '–'

  const ratingRows = [5, 4, 3, 2, 1].map((n) => ({
    label: '★'.repeat(n),
    value: rated.filter((e) => e.rating === n).length,
  }))

  const top5 = [...rated]
    .sort((a, b) => b.rating - a.rating || (b.date_finished || '').localeCompare(a.date_finished || ''))
    .slice(0, 5)

  const perYear = (() => {
    const years = read.map((e) => e.date_finished?.slice(0, 4)).filter(Boolean)
    if (!years.length) return []
    const min = Math.min(...years.map(Number))
    const max = Math.max(...years.map(Number), THIS_YEAR)
    const rows = []
    for (let y = Math.max(min, max - 9); y <= max; y++)
      rows.push({ label: `'${String(y).slice(2)}`, value: years.filter((x) => +x === y).length })
    return rows
  })()

  const typeRows = TYPES.map((t) => {
    const list = books.filter((b) => b.type === t.id)
    const done = list.filter((b) => statusOf(log, b.id) === 'read').length
    return { label: t.label, value: done, total: list.length, display: `${done}/${list.length}` }
  })

  return (
    <>
      <h2 className="view-title">Your dark record</h2>

      <div className="tiles">
        <div className="tile">
          <span className="tile-num">{p.read}</span>
          <span className="tile-label">books read</span>
        </div>
        <div className="tile">
          <span className="tile-num">{p.pct}%</span>
          <span className="tile-label">of everything</span>
        </div>
        <div className="tile">
          <span className="tile-num">{p.pages.toLocaleString()}</span>
          <span className="tile-label">pages read</span>
        </div>
        <div className="tile">
          <span className="tile-num">{avg}</span>
          <span className="tile-label">average ★</span>
        </div>
      </div>

      <BadgePanel title="Reading badges" badges={badges} />

      <section className="panel">
        <h3>Progress by type</h3>
        <ul className="barlist">
          {typeRows.map((r) => (
            <li key={r.label} aria-label={`${r.label}: ${r.display}`}>
              <span className="bar-label">{r.label}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${(r.value / r.total) * 100}%` }} />
              </span>
              <span className="bar-value">{r.display}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>Ratings</h3>
        {rated.length ? (
          <BarList rows={ratingRows} max={Math.max(...ratingRows.map((r) => r.value))} />
        ) : (
          <p className="muted small">Rate a book to see your spread.</p>
        )}
      </section>

      <section className="panel">
        <h3>Top 5</h3>
        {top5.length ? (
          <ol className="top5">
            {top5.map((e, i) => {
              const b = bookById[e.book_id]
              return (
                <li key={e.book_id}>
                  <button onClick={() => onOpen(b.id)}>
                    <span className="rank">{i + 1}</span>
                    <Cover book={b} size="S" className="mini" />
                    <span className="top5-title">
                      {b.title}
                      <Stars value={e.rating} size={12} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="muted small">Your favourites will appear here.</p>
        )}
      </section>

      <section className="panel">
        <h3>Books finished per year</h3>
        {perYear.length ? (
          <Columns rows={perYear} />
        ) : (
          <p className="muted small">Add a “finished on” date to read books to see this.</p>
        )}
      </section>

    </>
  )
}
