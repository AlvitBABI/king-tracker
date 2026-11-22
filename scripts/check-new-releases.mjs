#!/usr/bin/env node
// Monthly check: compares stephenking.com/works against our catalogue.
//
// Every novel / novella / collection / non-fiction slug on the official site
// must appear in src/data/sk-works.json, either mapped to a book id in
// books.json or marked { "ignore": "reason" } (limited editions, novellas
// already inside a collection, reprints...). Anything else is a new work.
//
// For each new work it opens a GitHub issue (once — closed issues are not
// reopened), so you get an email. Books are not added automatically because
// release dates must be verified first (see CLAUDE.md).
//
// Usage: node scripts/check-new-releases.mjs           (report only)
//        GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo node scripts/check-new-releases.mjs --issues

import { readFile } from 'node:fs/promises'

const SITE = 'https://stephenking.com'
const CATEGORIES = ['novel', 'novella', 'collection', 'nonfiction']
const UA = { 'User-Agent': 'king-tracker release check (github.com/AlvitBABI/king-tracker)' }
const LABEL = 'new-release'

const known = JSON.parse(await readFile(new URL('../src/data/sk-works.json', import.meta.url), 'utf8'))
const books = JSON.parse(await readFile(new URL('../src/data/books.json', import.meta.url), 'utf8'))
const bookIds = new Set(books.map((b) => b.id))

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: UA })
    if (res.ok) return res.text()
    if (attempt >= 3) throw new Error(`${url} -> HTTP ${res.status}`)
    await new Promise((r) => setTimeout(r, 5000 * attempt))
  }
}

const textLines = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

async function workDetails(key) {
  const lines = textLines(await get(`${SITE}/works/${key}.html`))
  const after = (label) => {
    const i = lines.indexOf(label)
    return i >= 0 ? lines[i + 1] : null
  }
  const r = lines.indexOf('Released')
  return {
    title: r > 0 ? lines[r - 1] : key,
    released: after('Released'),
    formats: after('Available Format(s)'),
    publisher: after('Publisher'),
  }
}

// ---------------------------------------------------------------------------

const html = await get(`${SITE}/works/`)
const slugs = new Set()
for (const cat of CATEGORIES) {
  for (const m of html.matchAll(new RegExp(`href="/works/${cat}/([^"]+?)\\.html"`, 'g'))) slugs.add(`${cat}/${m[1]}`)
}
if (slugs.size < 50) throw new Error(`Only found ${slugs.size} works – the site layout may have changed.`)

const fresh = [...slugs].filter((s) => !(s in known)).sort()
const broken = Object.entries(known).filter(([, v]) => typeof v === 'string' && !bookIds.has(v))

console.log(`Checked ${slugs.size} works on ${SITE}/works/`)
if (broken.length) console.log('sk-works.json points at unknown book ids:', broken)
if (!fresh.length) {
  console.log('No new works. ✔')
  process.exit(0)
}

const found = []
for (const key of fresh) {
  const d = await workDetails(key).catch((e) => ({ title: key, error: e.message }))
  found.push({ key, ...d })
  console.log(`NEW  ${key}  ${d.title} (${d.released ?? 'date unknown'})`)
  await new Promise((r) => setTimeout(r, 1000))
}

if (!process.argv.includes('--issues')) process.exit(0)

// ---------------------------------------------------------------------------
// Open one issue per new work (skip if an issue with that title ever existed).

const { GITHUB_TOKEN, GITHUB_REPOSITORY } = process.env
if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required for --issues')

const gh = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...UA,
    },
  })
  if (!res.ok) throw new Error(`GitHub ${path} -> ${res.status} ${await res.text()}`)
  return res.json()
}

await gh('/labels', { method: 'POST', body: JSON.stringify({ name: LABEL, color: 'c8102e', description: 'New Stephen King work spotted' }) }).catch(() => {})
const existing = await gh(`/issues?labels=${LABEL}&state=all&per_page=100`)
const titles = new Set(existing.map((i) => i.title))

for (const w of found) {
  const title = `New release: ${w.title} (${w.key.split('/')[0]})`
  if (titles.has(title)) {
    console.log(`Issue already exists: ${title}`)
    continue
  }
  const body = [
    `stephenking.com lists a work that isn't in the catalogue yet.`,
    '',
    `| | |`,
    `|---|---|`,
    `| Title | ${w.title} |`,
    `| Category | ${w.key.split('/')[0]} |`,
    `| Released (per site) | ${w.released ?? '?'} |`,
    `| Formats | ${w.formats ?? '?'} |`,
    `| Publisher | ${w.publisher ?? '?'} |`,
    `| Page | ${SITE}/works/${w.key}.html |`,
    '',
    '**To add it**',
    '1. Verify the first US publication date on Wikipedia and Open Library (the site sometimes lists a later edition).',
    '2. Add the book to `src/data/books.json` (cover via Open Library `olid` or `isbn`).',
    `3. Map \`"${w.key}"\` to its id in \`src/data/sk-works.json\`.`,
    '',
    `If it's a limited edition, reprint, or a novella already inside a collection, add \`"${w.key}": { "ignore": "reason" }\` to \`sk-works.json\` instead and close this issue.`,
  ].join('\n')
  const issue = await gh('/issues', { method: 'POST', body: JSON.stringify({ title, body, labels: [LABEL] }) })
  console.log(`Opened ${issue.html_url}`)
}
