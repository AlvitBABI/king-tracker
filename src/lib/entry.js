// Pure helpers for log entries (no browser or Vite imports, so `node --test`
// can run them directly).
//
// One entry per book, two independent sides:
//   reading:    status, rating, date_finished, comment
//   collection: owned, wishlist, formats, acquired_on, copy_notes

export const FORMATS = [
  { id: 'hardcover', label: 'Hardcover', short: 'HC' },
  { id: 'paperback', label: 'Paperback', short: 'PB' },
  { id: 'mass-market', label: 'Mass market', short: 'MM' },
  { id: 'ebook', label: 'Ebook', short: 'eB' },
  { id: 'audiobook', label: 'Audiobook', short: 'Aud' },
]
const FORMAT_IDS = FORMATS.map((f) => f.id)

export const COLLECTION_FIELDS = ['owned', 'wishlist', 'formats', 'acquired_on', 'copy_notes']

const truthy = (v) => v === true || v === 'yes' || v === 'TRUE' || v === 'true' || v === 1

export function parseFormats(v) {
  const list = Array.isArray(v) ? v : String(v || '').split(',')
  return [...new Set(list.map((s) => String(s).trim()).filter((s) => FORMAT_IDS.includes(s)))]
}

// Rules: rating + finish date only exist for Read books; formats, acquired
// date and copy notes only for owned books; an owned book isn't on the wishlist.
export function normalizeEntry(entry) {
  if (!entry) return entry
  const status = ['unread', 'reading', 'read'].includes(entry.status) ? entry.status : 'unread'
  const read = status === 'read'
  const owned = truthy(entry.owned)
  return {
    ...entry,
    status,
    rating: read && entry.rating >= 1 && entry.rating <= 5 ? Math.round(entry.rating) : null,
    date_finished: read ? entry.date_finished || null : null,
    comment: entry.comment || '',
    owned,
    wishlist: !owned && truthy(entry.wishlist),
    formats: owned ? parseFormats(entry.formats) : [],
    acquired_on: owned ? entry.acquired_on || null : null,
    copy_notes: owned ? entry.copy_notes || '' : '',
  }
}

export const ratingOf = (entry) => (entry?.status === 'read' && entry.rating) || null
export const isOwned = (entry) => Boolean(entry?.owned)
export const onWishlist = (entry) => Boolean(entry?.wishlist && !entry.owned)
export const shelfOf = (entry) => (isOwned(entry) ? 'owned' : onWishlist(entry) ? 'wishlist' : 'missing')
export const hasCollectionData = (e) => Boolean(e && (e.owned || e.wishlist))

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
    const local = log[raw.book_id]
    // An older sheet script doesn't know the collection columns: keep ours.
    const withLocal =
      local && !('owned' in raw) ? { ...raw, ...Object.fromEntries(COLLECTION_FIELDS.map((k) => [k, local[k]])) } : raw
    const r = normalizeEntry(withLocal)
    remoteIds.add(r.book_id)
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

// Search that forgives punctuation and case: "salems lot" finds "'Salem's Lot".
export const searchKey = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
