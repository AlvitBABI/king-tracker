/**
 * King Tracker – Google Sheets backend.
 *
 * Bound to a Google Sheet, deployed as a web app (Execute as: me, Access: anyone).
 *   POST text/plain {"key", "action": "list"}  -> { ok, rows: [...] }
 *   POST text/plain {"key", "rows": [...]}     -> upserts each row by book_id
 *   GET  ?key=SECRET                           -> { ok, rows: [...] } (older app versions)
 *
 * Run setup() once from the editor: it creates the "log" tab and a secret key
 * (shown in the execution log, stored as Script Property KEY). Running it again
 * is safe: it also clears ratings/dates left on books that aren't marked read.
 *
 * Rule: rating and date_finished only exist when status is "read".
 */

const SHEET_NAME = 'log';
const HEADERS = ['book_id', 'title', 'status', 'rating', 'comment', 'date_finished', 'updated_at'];
const STATUSES = ['unread', 'reading', 'read'];

function setup() {
  const sheet = getSheet_();
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('KEY', key);
  }
  const cleaned = cleanStale_(sheet);
  Logger.log('Sheet ready: "%s". Cleaned %s row(s). Your secret key is: %s', sheet.getName(), cleaned, key);
}

// Simple trigger: when you edit the log tab by hand, stamp updated_at so the
// app treats your edit as the newest version instead of overwriting it.
function onEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME || e.range.getRow() < 2) return;
  const tsCol = HEADERS.indexOf('updated_at') + 1;
  if (e.range.getColumn() === tsCol && e.range.getNumColumns() === 1) return;
  const now = new Date().toISOString();
  const n = e.range.getNumRows();
  sheet.getRange(e.range.getRow(), tsCol, n, 1).setNumberFormat('@').setValues(Array(n).fill([now]));
}

function doGet(e) {
  if (!authorised_(e.parameter.key)) return json_({ ok: false, error: 'unauthorised' });
  return json_({ ok: true, rows: readRows_() });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad json' });
  }
  if (!authorised_(body.key)) return json_({ ok: false, error: 'unauthorised' });

  if (body.action === 'list') return json_({ ok: true, rows: readRows_() });

  const rows = Array.isArray(body.rows) ? body.rows : body.row ? [body.row] : [];
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let saved;
  try {
    saved = upsertAll_(rows);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true, saved: saved });
}

// ---------------------------------------------------------------------------

function authorised_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('KEY');
  return Boolean(expected) && key === expected;
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    // Plain text everywhere, so dates stay "2024-05-01" and comments starting
    // with "=" are never treated as formulas.
    sheet.getRange(1, 1, sheet.getMaxRows(), HEADERS.length).setNumberFormat('@');
  }
  return sheet;
}

function readRows_() {
  const sheet = getSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  return values
    .filter((r) => r[0])
    .map((r) => {
      const row = {};
      HEADERS.forEach((h, i) => {
        let v = r[i];
        if (v instanceof Date) v = Utilities.formatDate(v, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
        row[h] = v === '' ? null : v;
      });
      row.book_id = String(row.book_id);
      if (row.status !== 'read') {
        row.rating = null;
        row.date_finished = null;
      }
      row.rating = row.rating ? Number(row.rating) : null;
      if (row.date_finished) row.date_finished = String(row.date_finished).slice(0, 10);
      return row;
    });
}

function clean_(row) {
  const status = STATUSES.indexOf(row.status) >= 0 ? row.status : 'unread';
  const read = status === 'read';
  return {
    book_id: String(row.book_id).slice(0, 100),
    title: String(row.title || '').slice(0, 300),
    status: status,
    rating: read && row.rating >= 1 && row.rating <= 5 ? Math.round(row.rating) : '',
    comment: String(row.comment || '').slice(0, 5000),
    date_finished: read && /^\d{4}-\d{2}-\d{2}$/.test(row.date_finished) ? row.date_finished : '',
    updated_at: String(row.updated_at || new Date().toISOString()),
  };
}

// Reads the id and timestamp columns once, then writes each row.
function upsertAll_(rows) {
  const sheet = getSheet_();
  const tsCol = HEADERS.indexOf('updated_at');
  let last = sheet.getLastRow();
  const existing = last >= 2 ? sheet.getRange(2, 1, last - 1, HEADERS.length).getValues() : [];
  const index = {};
  existing.forEach((r, i) => {
    if (r[0]) index[String(r[0])] = { row: i + 2, updatedAt: String(r[tsCol]) };
  });

  let saved = 0;
  rows.forEach((raw) => {
    if (!raw || !raw.book_id) return;
    const row = clean_(raw);
    const hit = index[row.book_id];
    // Ignore stale writes (e.g. an old offline edit arriving after a newer one).
    if (hit && hit.updatedAt && hit.updatedAt > row.updated_at) return;
    const rowNumber = hit ? hit.row : ++last;
    sheet.getRange(rowNumber, 1, 1, HEADERS.length).setNumberFormat('@').setValues([HEADERS.map((h) => row[h])]);
    index[row.book_id] = { row: rowNumber, updatedAt: row.updated_at };
    saved++;
  });
  return saved;
}

// Clears rating/date_finished on rows that aren't "read". Returns how many changed.
function cleanStale_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const range = sheet.getRange(2, 1, last - 1, HEADERS.length);
  const values = range.getValues();
  const iStatus = HEADERS.indexOf('status');
  const iRating = HEADERS.indexOf('rating');
  const iDate = HEADERS.indexOf('date_finished');
  let changed = 0;
  values.forEach((r) => {
    if (r[0] && r[iStatus] !== 'read' && (r[iRating] !== '' || r[iDate] !== '')) {
      r[iRating] = '';
      r[iDate] = '';
      changed++;
    }
  });
  if (changed) range.setValues(values);
  return changed;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
