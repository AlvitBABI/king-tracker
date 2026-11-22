import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mergeRemote, normalizeEntry, ratingOf } from '../src/lib/entry.js'

const e = (o) => ({ book_id: 'carrie', title: 'Carrie', status: 'read', rating: 4, comment: '', date_finished: '2024-01-01', ...o })

test('rating and finish date are dropped when a book is not read', () => {
  for (const status of ['unread', 'reading']) {
    const n = normalizeEntry(e({ status, comment: 'keep me' }))
    assert.equal(n.rating, null)
    assert.equal(n.date_finished, null)
    assert.equal(n.comment, 'keep me')
  }
})

test('read entries keep a valid rating, invalid ones are dropped', () => {
  assert.equal(normalizeEntry(e()).rating, 4)
  assert.equal(normalizeEntry(e({ rating: 9 })).rating, null)
  assert.equal(normalizeEntry(e({ status: 'bogus' })).status, 'unread')
})

test('ratingOf ignores stale ratings', () => {
  assert.equal(ratingOf(e()), 4)
  assert.equal(ratingOf({ status: 'unread', rating: 5 }), null)
  assert.equal(ratingOf(undefined), null)
})

test('merge: newer remote row wins over older local', () => {
  const local = { carrie: e({ updated_at: '2024-01-01' }) }
  const { log, pending } = mergeRemote(local, {}, [e({ rating: 2, updated_at: '2024-02-01' })])
  assert.equal(log.carrie.rating, 2)
  assert.deepEqual(pending, {})
})

test('merge: newer local edit is kept and queued for the sheet', () => {
  const local = { carrie: e({ rating: 5, updated_at: '2024-03-01' }) }
  const { log, pending } = mergeRemote(local, {}, [e({ rating: 2, updated_at: '2024-02-01' })])
  assert.equal(log.carrie.rating, 5)
  assert.ok(pending.carrie)
})

test('merge: pending local edit is not overwritten by an older sheet row', () => {
  const mine = e({ status: 'unread', updated_at: '2024-03-01' })
  const { log, pending } = mergeRemote({ carrie: mine }, { carrie: mine }, [e({ updated_at: '2024-02-01' })])
  assert.equal(log.carrie.status, 'unread')
  assert.ok(pending.carrie)
})

test('merge: stale ratings in sheet rows are cleaned on the way in', () => {
  const { log } = mergeRemote({}, {}, [e({ status: 'unread', rating: 5, updated_at: '2024-02-01' })])
  assert.equal(log.carrie.rating, null)
})

test('merge: local-only entries are queued for upload', () => {
  const { pending } = mergeRemote({ it: e({ book_id: 'it', updated_at: '2024-01-01' }) }, {}, [])
  assert.ok(pending.it)
})
