import { useSyncExternalStore } from 'react'
import { sheet } from './config.js'
import { mergeRemote, normalizeEntry, normalizeLog } from './entry.js'
import { fetchRows, pushRows } from './sheets.js'

// Reading log store: the screen updates instantly, everything is cached in
// localStorage, and edits are queued and pushed to the sheet in the background.

const LS = {
  log: 'kt.log',
  pending: 'kt.pending',
  lastSync: 'kt.lastSync',
}

const read = (k, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback
  } catch {
    return fallback
  }
}
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v))

let state = {
  log: normalizeLog(read(LS.log, {})), // book_id -> entry
  pending: normalizeLog(read(LS.pending, {})), // book_id -> entry not yet saved to the sheet
  sync: 'idle', // idle | syncing | error | offline
  syncError: null,
  lastSync: read(LS.lastSync, null),
}

const listeners = new Set()
function set(patch) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore(selector = (s) => s) {
  return selector(useSyncExternalStore(subscribe, () => state))
}
export const getState = () => state

export const hasSheet = Boolean(sheet)

// ---------------------------------------------------------------------------
// Editing

export function updateEntry(book, patch) {
  const prev = state.log[book.id] || { book_id: book.id, status: 'unread', rating: null, comment: '', date_finished: null }
  const entry = normalizeEntry({ ...prev, ...patch, book_id: book.id, title: book.title, updated_at: new Date().toISOString() })
  const log = { ...state.log, [book.id]: entry }
  const pending = { ...state.pending, [book.id]: entry }
  set({ log, pending })
  persistSoon()
  scheduleFlush()
  return entry
}

// Typing a note updates the store on every keystroke; writing the whole log
// to localStorage is batched instead.
let persistTimer = null
function persistSoon() {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(persistNow, 400)
}
function persistNow() {
  clearTimeout(persistTimer)
  persistTimer = null
  write(LS.log, state.log)
  write(LS.pending, state.pending)
}

// ---------------------------------------------------------------------------
// Sync

let flushTimer = null
let retryDelay = 0
let inFlight = null

function scheduleFlush(delay = 800) {
  clearTimeout(flushTimer)
  flushTimer = setTimeout(flush, delay)
}

async function flush() {
  if (!hasSheet) return
  const rows = Object.values(state.pending)
  if (!rows.length) return
  if (inFlight) return scheduleFlush(1000)
  if (!navigator.onLine) return set({ sync: 'offline' })

  set({ sync: 'syncing', syncError: null })
  inFlight = pushRows(sheet, rows)
  try {
    await inFlight
    // Drop only what we sent; anything edited meanwhile stays queued.
    const pending = { ...state.pending }
    for (const r of rows) if (pending[r.book_id]?.updated_at === r.updated_at) delete pending[r.book_id]
    const lastSync = new Date().toISOString()
    write(LS.lastSync, lastSync)
    retryDelay = 0
    set({ pending, sync: 'idle', lastSync })
    persistNow()
    if (Object.keys(pending).length) scheduleFlush(300)
  } catch (err) {
    retryDelay = Math.min(retryDelay ? retryDelay * 2 : 5000, 60000)
    set({ sync: navigator.onLine ? 'error' : 'offline', syncError: err.message })
    scheduleFlush(retryDelay)
  } finally {
    inFlight = null
  }
}

// Pull the sheet, keep whichever side changed last, push local wins back.
export async function pull() {
  if (!hasSheet) return
  if (!navigator.onLine) return set({ sync: 'offline' })
  set({ sync: 'syncing', syncError: null })
  try {
    const rows = await fetchRows(sheet)
    const { log, pending } = mergeRemote(state.log, state.pending, rows)
    const lastSync = new Date().toISOString()
    write(LS.lastSync, lastSync)
    set({ log, pending, sync: 'idle', lastSync })
    persistNow()
    if (Object.keys(pending).length) scheduleFlush(100)
  } catch (err) {
    set({ sync: navigator.onLine ? 'error' : 'offline', syncError: err.message })
  }
}

export function syncNow() {
  retryDelay = 0
  return pull().then(flush)
}

export function resetLocalData() {
  // Clears this device's cache only; the next sync reloads everything from the sheet.
  clearTimeout(persistTimer)
  Object.values(LS).forEach((k) => localStorage.removeItem(k))
  set({ log: {}, pending: {}, sync: 'idle', syncError: null, lastSync: null })
  syncNow()
}

// Keep in sync when the app comes back to the foreground or online.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => syncNow())
  window.addEventListener('offline', () => set({ sync: 'offline' }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow()
    else if (persistTimer) persistNow()
  })
  window.addEventListener('pagehide', () => persistTimer && persistNow())
}
