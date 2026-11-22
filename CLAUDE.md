# king-tracker

Personal web app to log which Stephen King books I've read, with ratings and private comments. Should be easy and fun to use, so I actually want to open it.

## Working style
- Make changes without stopping for step-by-step approval, then give a short summary of what was done and why (I'm learning from the summaries).
- Push straight to `main` (no PRs or branches).
- Keep explanations concise and use bullet points.

## Stack
- React + Vite (JavaScript), plain CSS or CSS modules
- Hosting: GitHub Pages (repo `AlvitBABI/king-tracker`), deployed with a GitHub Actions workflow on push to main
- PWA (manifest + service worker) so it can be added to the iPhone home screen
- Covers: Open Library covers API (`https://covers.openlibrary.org/b/isbn/<ISBN>-M.jpg` or by OLID), no API key
- No Supabase. Storage = Google Sheets through a Google Apps Script web app (see below)

## Data model
### Book catalogue: `src/data/books.json` (in repo, same for every user)
Fields: `id` (stable slug), `title`, `published` (ISO date of first US publication), `type` (novel | collection | novella | non-fiction | bachman), `pages`, `series` (array, e.g. "Dark Tower", "Castle Rock", "Derry", "Bill Hodges", "Talisman"), `isbn` or `olid` for the cover.
- Include ALL books: novels, collections, novellas, non-fiction, Bachman.
- Verify every publication date against Open Library and Wikipedia before committing. No dates from memory.
- The list follows https://stephenking.com/works/ (novel, novella, collection, nonfiction categories) with original works only: no limited/illustrated/revised editions, omnibuses, audiobooks, or novellas that only appeared inside a collection. Dates are the first US publication (the official site sometimes lists a later edition, so Wikipedia + Open Library win). Unknown day/month → reduced ISO (`1991-10`, `2000`).
- `src/data/sk-works.json` maps every official-site slug to a book id or `{ "ignore": "reason" }`.
- `.github/workflows/check-new-releases.yml` runs `scripts/check-new-releases.mjs` monthly and opens a `new-release` GitHub issue for any site slug missing from `sk-works.json`. Adding a book = verify dates, add to books.json, map the slug.
- Covers: `olid` (Open Library's representative cover edition) is preferred over `isbn` when both exist.

### Reading log: user's Google Sheet, tab `log`
Columns: `book_id`, `title`, `status` (unread | reading | read), `rating` (1–5), `comment`, `date_finished`, `updated_at`.
The title column is there so the sheet is readable on its own.

## Google Sheets backend
- `apps-script/Code.gs`: an Apps Script bound to the sheet, deployed as a web app (Execute as: me, Access: anyone).
  - `doGet` → returns all log rows as JSON
  - `doPost` → upserts one row by `book_id`
  - Every request must include a secret `key`, checked against a Script Property. Reject otherwise.
  - Use `text/plain` POST bodies to avoid CORS preflight.
- Client: the first-run settings screen asks for the script URL + key and stores them in localStorage ("bring your own sheet", so friends can use their own copy).
- Optimistic UI: update the screen instantly, cache the log in localStorage, sync in the background, show a small sync indicator and retry on failure.
- `SETUP.md`: a 5-minute guide (copy the template sheet → paste the script → deploy → paste URL + key into the app).

## Phases
1. **Catalogue**: books.json, cover grid, sort by release date / A–Z toggle.
2. **Reading log**: status per book; when Read → date finished, 1–5 stars, private comment; Sheets sync + settings screen + SETUP.md.
3. **Fun layer**:
   - Progress bar ("23 / 90 read · 26%") plus total pages read
   - Confetti and animation when a book is marked Read
   - Badges (e.g. Bachman complete, Dark Tower finished, 1,000-page club)
   - "What should I read next?" random pick from unread books, with filter (short / long / series)
   - Filters: type, series/universe, length (short <300 / medium / doorstopper 700+), decade, read status, rating
   - Dark horror theme (red accents, typewriter-style headings) plus light mode
4. **Polish**: stats page (ratings spread, top 5, books per year), CSV export.

Finish each phase, push, then I test on my phone before the next phase.
