import { books, statusOf, DECADES, decadeOf } from './books.js'
import { isOwned, ratingOf } from './entry.js'
import { computeStories } from './stories.js'

const countRead = (log, list) => list.filter((b) => statusOf(log, b.id) === 'read').length
const countOwned = (log, list) => list.filter((b) => isOwned(log[b.id])).length
const inSeries = (name) => books.filter((b) => b.series.includes(name))
const ofType = (t) => books.filter((b) => b.type === t)
const ownedEntries = (log) => books.map((b) => log[b.id]).filter(isOwned)

// Each badge returns progress as [done, needed] so locked badges can show how close you are.
export const BADGES = [
  { id: 'first', icon: '🩸', name: 'First Blood', desc: 'Finish your first book', check: (log) => [countRead(log, books), 1] },
  { id: 'ten', icon: '📚', name: 'Constant Reader', desc: 'Finish 10 books', check: (log) => [countRead(log, books), 10] },
  { id: 'half', icon: '🌗', name: 'Halfway There', desc: 'Read half of everything', check: (log) => [countRead(log, books), Math.ceil(books.length / 2)] },
  { id: 'all', icon: '👑', name: 'The King’s Own', desc: 'Read every single book', check: (log) => [countRead(log, books), books.length] },
  { id: 'bachman', icon: '🕶️', name: 'Bachman Unmasked', desc: 'Read every Richard Bachman book', check: (log) => [countRead(log, ofType('bachman')), ofType('bachman').length] },
  { id: 'tower', icon: '🗼', name: 'Reached the Tower', desc: 'Finish all 8 Dark Tower books', check: (log) => [countRead(log, inSeries('Dark Tower')), inSeries('Dark Tower').length] },
  { id: 'derry', icon: '🎈', name: 'We All Float', desc: 'Read every Derry book', check: (log) => [countRead(log, inSeries('Derry')), inSeries('Derry').length] },
  { id: 'castle-rock', icon: '🏚️', name: 'Castle Rock Local', desc: 'Read every Castle Rock book', check: (log) => [countRead(log, inSeries('Castle Rock')), inSeries('Castle Rock').length] },
  { id: 'hodges', icon: '🕵️', name: 'Finders Keepers', desc: 'Finish the Bill Hodges trilogy', check: (log) => [countRead(log, inSeries('Bill Hodges')), inSeries('Bill Hodges').length] },
  { id: 'talisman', icon: '🌀', name: 'Territories Traveller', desc: 'Read every Talisman book', check: (log) => [countRead(log, inSeries('Talisman')), inSeries('Talisman').length] },
  { id: 'thousand', icon: '🧱', name: '1,000-Page Club', desc: 'Finish a book of 1,000+ pages', check: (log) => [Math.min(1, countRead(log, books.filter((b) => b.pages >= 1000))), 1] },
  { id: 'pages', icon: '📜', name: '10,000 Pages', desc: 'Read 10,000 pages in total', check: (log) => [books.filter((b) => statusOf(log, b.id) === 'read').reduce((n, b) => n + (b.pages || 0), 0), 10000] },
  { id: 'novellas', icon: '✂️', name: 'Short & Sharp', desc: 'Read every standalone novella', check: (log) => [countRead(log, ofType('novella')), ofType('novella').length] },
  { id: 'collections', icon: '🗃️', name: 'Story Hoarder', desc: 'Read every short story collection', check: (log) => [countRead(log, ofType('collection')), ofType('collection').length] },
  {
    id: 'decades',
    icon: '⏳',
    name: 'Time Traveller',
    desc: 'Read a book from every decade',
    check: (log) => [DECADES.filter((d) => books.some((b) => decadeOf(b) === d && statusOf(log, b.id) === 'read')).length, DECADES.length],
  },
  { id: 'stories-10', icon: '🕯️', name: 'Bedtime Stories', desc: 'Read 10 short stories', check: (log) => [computeStories(log).read, 10] },
  { id: 'stories-all', icon: '🦇', name: 'Night Shift Veteran', desc: 'Read every short story', check: (log) => [computeStories(log).read, computeStories(log).total] },
  { id: 'critic', icon: '⭐', name: 'Critic', desc: 'Rate 10 books', check: (log) => [Object.values(log).filter((e) => ratingOf(e)).length, 10] },
]

export const COLLECTOR_BADGES = [
  { id: 'c-first', icon: '🛒', name: 'First Find', desc: 'Add your first book to the shelf', check: (log) => [countOwned(log, books), 1] },
  { id: 'c-ten', icon: '📦', name: 'Shelf Starter', desc: 'Own 10 books', check: (log) => [countOwned(log, books), 10] },
  { id: 'c-half', icon: '🏛️', name: 'The Library', desc: 'Own half of everything', check: (log) => [countOwned(log, books), Math.ceil(books.length / 2)] },
  { id: 'c-all', icon: '💀', name: 'Completist', desc: 'Own every single book', check: (log) => [countOwned(log, books), books.length] },
  { id: 'c-bachman', icon: '🎭', name: 'Bachman Shelf', desc: 'Own every Richard Bachman book', check: (log) => [countOwned(log, ofType('bachman')), ofType('bachman').length] },
  { id: 'c-tower', icon: '🌹', name: 'The Tower Set', desc: 'Own all 8 Dark Tower books', check: (log) => [countOwned(log, inSeries('Dark Tower')), inSeries('Dark Tower').length] },
  { id: 'c-hodges', icon: '🚗', name: 'Mr. Mercedes Box', desc: 'Own the whole Bill Hodges trilogy', check: (log) => [countOwned(log, inSeries('Bill Hodges')), inSeries('Bill Hodges').length] },
  { id: 'c-hardcover', icon: '📕', name: 'Hardback Hunter', desc: 'Own 10 hardcovers', check: (log) => [ownedEntries(log).filter((e) => e.formats?.includes('hardcover')).length, 10] },
  { id: 'c-double', icon: '👯', name: 'Double Dipper', desc: 'Own a book in 2 formats', check: (log) => [Math.min(1, ownedEntries(log).filter((e) => e.formats?.length >= 2).length), 1] },
  { id: 'c-doorstop', icon: '🧱', name: 'Load-Bearing Shelf', desc: 'Own 5 books of 700+ pages', check: (log) => [countOwned(log, books.filter((b) => b.pages >= 700)), 5] },
  { id: 'c-tbr', icon: '🗻', name: 'Tsundoku', desc: 'Own 10 books you haven’t read yet', check: (log) => [books.filter((b) => isOwned(log[b.id]) && statusOf(log, b.id) !== 'read').length, 10] },
  { id: 'c-kept', icon: '🔖', name: 'Read & Kept', desc: 'Own 10 books you’ve read', check: (log) => [books.filter((b) => isOwned(log[b.id]) && statusOf(log, b.id) === 'read').length, 10] },
]

export function evaluateBadges(log, list = BADGES) {
  return list.map((b) => {
    const [done, needed] = b.check(log)
    return { ...b, done: Math.min(done, needed), needed, earned: done >= needed }
  })
}
