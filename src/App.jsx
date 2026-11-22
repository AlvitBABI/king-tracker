import { useCallback, useEffect, useState } from 'react'
import BookSheet from './components/BookSheet.jsx'
import { BooksIcon, ChartIcon, DiceIcon, GearIcon } from './components/Icons.jsx'
import LibraryView from './components/LibraryView.jsx'
import { EMPTY_FILTERS } from './lib/filters.js'
import PickView from './components/PickView.jsx'
import SettingsView, { NotConfigured } from './components/SettingsView.jsx'
import StatsView from './components/StatsView.jsx'
import { computeCollection, computeProgress } from './lib/books.js'
import { SCRIPT_VERSION } from './lib/sheets.js'
import { hasSheet, syncNow, useStore } from './lib/store.js'
import './App.css'

const TABS = [
  { id: 'books', label: 'Books', Icon: BooksIcon },
  { id: 'pick', label: 'Next read', Icon: DiceIcon },
  { id: 'stats', label: 'Stats', Icon: ChartIcon },
  { id: 'settings', label: 'Settings', Icon: GearIcon },
]

function usePersisted(key, initial) {
  const [v, setV] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? initial
    } catch {
      return initial
    }
  })
  useEffect(() => localStorage.setItem(key, JSON.stringify(v)), [key, v])
  return [v, setV]
}

function useTheme() {
  const [theme, setTheme] = usePersisted('kt.theme', 'dark')
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      const resolved = theme === 'auto' ? (mq.matches ? 'light' : 'dark') : theme
      document.documentElement.dataset.theme = resolved
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', resolved === 'light' ? '#f4efe6' : '#0d0b0b')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
  return [theme, setTheme]
}

function SyncDot() {
  const { sync, pending, scriptVersion } = useStore()
  const n = Object.keys(pending).length
  const label =
    sync === 'syncing'
      ? 'Syncing…'
      : sync === 'error'
        ? 'Sync failed – retrying'
        : sync === 'offline'
          ? 'Offline'
          : n && scriptVersion < SCRIPT_VERSION
            ? 'Collection waiting for the sheet script update'
            : n
              ? 'Waiting to sync'
              : 'Saved to your sheet'
  return (
    <button className={`sync-dot ${sync}${n && sync === 'idle' ? ' pending' : ''}`} onClick={() => syncNow()} title={label} aria-label={label}>
      <span />
    </button>
  )
}

const MODES = [
  { id: 'reading', label: 'Reading' },
  { id: 'collection', label: 'Collection' },
]

function Header({ mode, setMode }) {
  const log = useStore((s) => s.log)
  const p = computeProgress(log)
  const c = computeCollection(log)
  return (
    <header className={`header mode-${mode}`}>
      <div className="header-row">
        <h1>King Tracker</h1>
        <SyncDot />
      </div>
      <div className="mode-switch" role="tablist" aria-label="Tracker">
        {MODES.map((m) => (
          <button key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'reading' ? (
        <div className="progress" aria-label={`${p.read} of ${p.total} read`}>
          <div className="progress-bar">
            <span style={{ width: `${(p.read / p.total) * 100}%` }} />
            <span className="reading" style={{ width: `${(p.reading / p.total) * 100}%` }} />
          </div>
          <p className="progress-text">
            <strong>
              {p.read} / {p.total}
            </strong>{' '}
            read · {p.pct}% · {p.pages.toLocaleString()} pages
          </p>
        </div>
      ) : (
        <div className="progress" aria-label={`${c.owned} of ${c.total} owned`}>
          <div className="progress-bar gold">
            <span style={{ width: `${(c.owned / c.total) * 100}%` }} />
            <span className="wish" style={{ width: `${(c.wishlist / c.total) * 100}%` }} />
          </div>
          <p className="progress-text">
            <strong>
              {c.owned} / {c.total}
            </strong>{' '}
            owned · {c.pct}% · {c.wishlist} wanted · {c.tbr} unread on the shelf
          </p>
        </div>
      )}
    </header>
  )
}

export default function App() {
  const [theme, setTheme] = useTheme()
  const [tab, setTab] = usePersisted('kt.tab', 'books')
  const [sort, setSort] = usePersisted('kt.sort', 'date')
  const [mode, setMode] = usePersisted('kt.mode', 'reading')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  useEffect(() => {
    document.documentElement.dataset.mode = mode
  }, [mode])
  const [openId, setOpenId] = useState(null)
  const [justRead, setJustRead] = useState(null)

  useEffect(() => {
    syncNow()
  }, [])

  const onRead = useCallback((id) => {
    setJustRead(id)
    setTimeout(() => setJustRead(null), 1600)
  }, [])

  const switchTab = (id) => {
    if (id === tab) window.scrollTo({ top: 0, behavior: 'smooth' })
    else {
      setTab(id)
      window.scrollTo(0, 0)
    }
  }

  if (!hasSheet) return <NotConfigured />

  return (
    <div className="app">
      <Header mode={mode} setMode={setMode} />
      <main className="main">
        {tab === 'books' && (
          <LibraryView
            mode={mode}
            onCelebrate={onRead}
            filters={filters}
            setFilters={setFilters}
            sort={sort}
            setSort={setSort}
            onOpen={setOpenId}
            justRead={justRead}
          />
        )}
        {tab === 'pick' && <PickView onOpen={setOpenId} />}
        {tab === 'stats' && <StatsView mode={mode} onOpen={setOpenId} />}
        {tab === 'settings' && <SettingsView theme={theme} setTheme={setTheme} />}
      </main>

      <nav className="tabbar" aria-label="Main">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => switchTab(id)}>
            <Icon width={22} height={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {openId && <BookSheet key={openId} bookId={openId} mode={mode} onClose={() => setOpenId(null)} onRead={onRead} />}
    </div>
  )
}
