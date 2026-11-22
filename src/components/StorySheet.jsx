import { storyById, storyOwnedIn, storyStatus } from '../lib/stories.js'
import { bookById } from '../lib/books.js'
import { updateEntry, useStore } from '../lib/store.js'
import { Cover } from './BookCard.jsx'
import { CheckIcon } from './Icons.jsx'
import ReadingSection, { useUndo } from './ReadingSection.jsx'
import Sheet from './Sheet.jsx'

export function formatPartialDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!m) return String(y)
  return new Date(Date.UTC(y, m - 1, d || 1)).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    ...(d ? { day: 'numeric' } : {}),
    timeZone: 'UTC',
  })
}

export default function StorySheet({ storyId, onClose, onRead, onOpen }) {
  const story = storyById[storyId]
  const log = useStore((s) => s.log)
  const entry = log[storyId]
  const { via } = storyStatus(log, story)
  const ownedIn = storyOwnedIn(log, story)
  const [toast, offerUndo, clearUndo] = useUndo((patch) => updateEntry(story, patch))
  const books = story.collections.map((id) => bookById[id])

  return (
    <Sheet title={story.title} onClose={onClose} className="book-sheet story-sheet">
      <div className="story-head">
        <p className="book-year">{story.published.slice(0, 4)}</p>
        <dl className="facts">
          <div>
            <dt>Type</dt>
            <dd>{story.length === 'novella' ? 'Novella-length story' : 'Short story'}</dd>
          </div>
          <div>
            <dt>First published</dt>
            <dd>{formatPartialDate(story.published)}</dd>
          </div>
          {story.first_published_in && (
            <div>
              <dt>In</dt>
              <dd>{story.first_published_in}</dd>
            </div>
          )}
        </dl>
      </div>

      <section className="sheet-section">
        <h3 className="section-title">Where to find it</h3>
        {books.length ? (
          <ul className="found-in">
            {books.map((b) => {
              const owned = ownedIn.includes(b)
              return (
                <li key={b.id}>
                  <button onClick={() => onOpen(b.id)}>
                    <Cover book={b} size="S" className="mini" />
                    <span className="found-title">
                      {b.title}
                      <span className="muted small">{b.published.slice(0, 4)}</span>
                    </span>
                    {owned ? (
                      <span className="tag state-owned">
                        <CheckIcon width={11} height={11} /> On my shelf
                      </span>
                    ) : (
                      <span className="tag">Not owned</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="muted small">
            Not in any book in the catalogue
            {story.also_in?.length ? ` (only in ${story.also_in.join(', ')})` : ''}. First appeared in{' '}
            {story.first_published_in || 'a magazine'}.
          </p>
        )}
      </section>

      <ReadingSection
        item={story}
        entry={entry}
        offerUndo={offerUndo}
        clearUndo={clearUndo}
        onRead={onRead}
        hint={via && (entry?.status || 'unread') === 'unread' ? `Counts as read because you’ve read ${via.title}.` : null}
      />

      {toast}
    </Sheet>
  )
}
