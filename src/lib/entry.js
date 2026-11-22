// Pure helpers for reading-log entries (no browser or Vite imports, so
// `node --test` can run them directly).

// Rating and finish date only exist for books marked Read. Every entry that
// enters the log goes through this, so a stale rating can never be shown,
// counted or sent to the sheet.
export function normalizeEntry(entry) {
  if (!entry) return entry
  const read = entry.status === 'read'
  return {
    ...entry,
    status: ['unread', 'reading', 'read'].includes(entry.status) ? entry.status : 'unread',
    rating: read && entry.rating >= 1 && entry.rating <= 5 ? Math.round(entry.rating) : null,
    date_finished: read ? entry.date_finished || null : null,
    comment: entry.comment || '',
  }
}

export const ratingOf = (entry) => (entry?.status === 'read' && entry.rating) || null

export function normalizeLog(log) {
  return Object.fromEntries(Object.entries(log || {}).map(([id, e]) => [id, normalizeEntry(e)]))
}

// Merge sheet rows into the local log: whichever side changed last wins.
// Returns the new log and the queue of local entries the sheet still needs.
export function mergeRemote(localLog, localPending, rows) {
  const log = { ...localLog }
  const pending = { ...localPending }
  const remoteIds = new Set()
  for (const raw of rows) {
    const r = normalizeEntry(raw)
    remoteIds.add(r.book_id)
    const local = log[r.book_id]
    const remoteAt = r.updated_at || ''
    if (pending[r.book_id] && pending[r.book_id].updated_at >= remoteAt) continue
    if (!local || remoteAt >= (local.updated_at || '')) {
      log[r.book_id] = r
      delete pending[r.book_id]
    } else {
      pending[r.book_id] = local
    }
  }
  // Local entries the sheet has never seen.
  for (const id of Object.keys(log)) if (!remoteIds.has(id)) pending[id] = log[id]
  return { log, pending }
}
