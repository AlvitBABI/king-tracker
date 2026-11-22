import stories from '../data/stories.json'
import { bookById, books, statusOf } from './books.js'
import { isOwned, ratingOf } from './entry.js'

// Short stories: tracked in the same log as books (ids start with "story-"),
// but listed separately so the books grid stays uncluttered.
//
// Two shortcuts keep them low-effort:
//   - a story counts as read when you've read a book that contains it
//   - a story is "on your shelf" when you own a book that contains it

export { stories }
export const storyById = Object.fromEntries(stories.map((s) => [s.id, s]))
export const isStoryId = (id) => typeof id === 'string' && id.startsWith('story-')

// Books that contain stories, in publication order, with their stories.
export const STORY_BOOKS = books
  .filter((b) => stories.some((s) => s.collections.includes(b.id)))
  .map((b) => ({ book: b, stories: stories.filter((s) => s.collections.includes(b.id)) }))
export const UNCOLLECTED = stories.filter((s) => !s.collections.length)
export const storiesInBook = (bookId) => STORY_BOOKS.find((g) => g.book.id === bookId)?.stories || []

export const STORY_LENGTHS = [
  { id: 'story', label: 'Short story' },
  { id: 'novella', label: 'Novella-length' },
]

// -> { status, via } where via is the book that makes it read (if not logged directly)
export function storyStatus(log, story) {
  const own = log[story.id]?.status || 'unread'
  if (own !== 'unread') return { status: own, via: null }
  const book = story.collections.find((id) => statusOf(log, id) === 'read')
  return book ? { status: 'read', via: bookById[book] } : { status: 'unread', via: null }
}

export const storyOwnedIn = (log, story) => story.collections.filter((id) => isOwned(log[id])).map((id) => bookById[id])

export const storyRating = (log, story) => ratingOf(log[story.id])

export function computeStories(log) {
  let read = 0
  for (const s of stories) if (storyStatus(log, s).status === 'read') read++
  return { read, total: stories.length, pct: Math.round((read / stories.length) * 100) }
}
