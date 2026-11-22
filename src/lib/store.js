import { useSyncExternalStore } from 'react'
import { fetchRows, pushRows } from './sheets.js'

// Reading log store: the screen updates instantly, everything is cached in
// localStorage, and edits are queued and pushed to the sheet in the background.

const LS = {
  settings: 'kt.settings',
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
  settings: read(LS.settings, null), // { mode: 'sheet' | 'local', url, key }
  log: read(LS.log, {}), // book_id -> entry
  pending: read(LS.pending, {}), // book_id -> entry not yet saved to the sheet
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

const hasSheet = () => state.settings?.mode === 'sheet' && state.settings.url && state.settings.key

// ---------------------------------------------------------------------------
// Editing

export function updateEntry(book, patch) {
  const prev = state.log[book.id] || { book_id: book.id, status: 'unread', rating: null, comment: '', date_finished: null }
  const entry = { ...prev, ...patch, book_id: book.id, title: book.title, updated_at: new Date().toISOString() }
  const log = { ...state.log, [book.id]: entry }
  const pending = { ...state.pending, [book.id]: entry }
  write(LS.log, log)
  write(LS.pending, pending)
  set({ log, pending })
  scheduleFlush()
  return entry
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
  if (!hasSheet()) return
  const rows = Object.values(state.pending)
  if (!rows.length) return
  if (inFlight) return scheduleFlush(1000)
  if (!navigator.onLine) return set({ sync: 'offline' })

  set({ sync: 'syncing', syncError: null })
  inFlight = pushRows(state.settings, rows)
  try {
    await inFlight
    // Drop only what we sent; anything edited meanwhile stays queued.
    const pending = { ...state.pending }
    for (const r of rows) if (pending[r.book_id]?.updated_at === r.updated_at) delete pending[r.book_id]
    write(LS.pending, pending)
    const lastSync = new Date().toISOString()
    write(LS.lastSync, lastSync)
    retryDelay = 0
    set({ pending, sync: 'idle', lastSync })
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
  if (!hasSheet()) return
  if (!navigator.onLine) return set({ sync: 'offline' })
  set({ sync: 'syncing', syncError: null })
  try {
    const rows = await fetchRows(state.settings)
    const log = { ...state.log }
    const pending = { ...state.pending }
    const remoteIds = new Set()
    for (const r of rows) {
      remoteIds.add(r.book_id)
      const local = log[r.book_id]
      if (pending[r.book_id] && pending[r.book_id].updated_at >= (r.updated_at || '')) continue
      if (!local || (r.updated_at || '') >= (local.updated_at || '')) {
        log[r.book_id] = { ...r, comment: r.comment || '' }
        delete pending[r.book_id]
      } else {
        pending[r.book_id] = local
      }
    }
    // Local entries the sheet has never seen (e.g. logged before connecting).
    for (const id of Object.keys(log)) if (!remoteIds.has(id)) pending[id] = log[id]

    write(LS.log, log)
    write(LS.pending, pending)
    const lastSync = new Date().toISOString()
    write(LS.lastSync, lastSync)
    set({ log, pending, sync: 'idle', lastSync })
    if (Object.keys(pending).length) scheduleFlush(100)
  } catch (err) {
    set({ sync: navigator.onLine ? 'error' : 'offline', syncError: err.message })
  }
}

export function syncNow() {
  retryDelay = 0
  return pull().then(flush)
}

export async function testConnection(settings) {
  const rows = await fetchRows(settings)
  return rows.length
}

export function saveSettings(settings) {
  write(LS.settings, settings)
  set({ settings, sync: 'idle', syncError: null })
  if (settings.mode === 'sheet') syncNow()
}

export function resetLocalData() {
  Object.values(LS).forEach((k) => localStorage.removeItem(k))
  set({ settings: null, log: {}, pending: {}, sync: 'idle', syncError: null, lastSync: null })
}

// Keep in sync when the app comes back to the foreground or online.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => syncNow())
  window.addEventListener('offline', () => set({ sync: 'offline' }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow()
  })
}
