/**
 * King Tracker – Google Sheets backend (version 2: reading + collection).
 *
 * Bound to a Google Sheet, deployed as a web app (Execute as: me, Access: anyone).
 *   POST text/plain {"key", "action": "list"}  -> { ok, version, rows: [...] }
 *   POST text/plain {"key", "rows": [...]}     -> upserts each row by book_id
 *   GET  ?key=SECRET                           -> { ok, version, rows: [...] } (older app versions)
 *
 * Run setup() once from the editor: it creates the "log" tab and a secret key
 * (shown in the execution log, stored as Script Property KEY). Running it again
 * is safe: it adds any missing columns and cleans up rows that break the rules.
 *
 * Rules: rating and date_finished only exist when status is "read";
 * formats, acquired_on and copy_notes only when owned; owned books aren't on
 * the wishlist.
 *
 * Columns are found by their header name, so the order in the sheet doesn't
 * matter and new columns are appended automatically.
 */

const VERSION = 2;
const SHEET_NAME = 'log';
const HEADERS = [
  'book_id',
  'title',
  'status',
  'rating',
  'comment',
  'date_finished',
  'owned',
  'wishlist',
  'formats',
  'acquired_on',
  'copy_notes',
  'updated_at',
];
const STATUSES = ['unread', 'reading', 'read'];
const FORMATS = ['hardcover', 'paperback', 'mass-market', 'ebook', 'audiobook'];

function setup() {
  const sheet = getSheet_();
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('KEY', key);
  }
  const cleaned = cleanAll_(sheet);
  Logger.log('Sheet ready: "%s". Fixed %s cell(s). Your secret key is: %s', sheet.getName(), cleaned, key);
}

// Simple trigger: when you edit the log tab by hand, stamp updated_at so the
// app treats your edit as the newest version instead of overwriting it.
function onEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME || e.range.getRow() < 2) return;
  const tsCol = columns_(sheet).updated_at;
  if (!tsCol) return;
  if (e.range.getColumn() === tsCol && e.range.getNumColumns() === 1) return;
  const now = new Date().toISOString();
  const n = e.range.getNumRows();
  sheet.getRange(e.range.getRow(), tsCol, n, 1).setNumberFormat('@').setValues(Array(n).fill([now]));
}

function doGet(e) {
  if (!authorised_(e.parameter.key)) return json_({ ok: false, error: 'unauthorised' });
  return json_({ ok: true, version: VERSION, rows: readRows_() });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad json' });
  }
  if (!authorised_(body.key)) return json_({ ok: false, error: 'unauthorised' });

  if (body.action === 'list') return json_({ ok: true, version: VERSION, rows: readRows_() });

  const rows = Array.isArray(body.rows) ? body.rows : body.row ? [body.row] : [];
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let saved;
  try {
    saved = upsertAll_(rows);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true, version: VERSION, saved: saved });
}

// ---------------------------------------------------------------------------

function authorised_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('KEY');
  return Boolean(expected) && key === expected;
}

// Returns the log tab, creating it and appending any missing header columns.
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  const lastCol = sheet.getLastColumn();
  const existing = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  const missing = HEADERS.filter((h) => existing.indexOf(h) < 0);
  if (missing.length) {
    const start = existing.length + 1;
    if (sheet.getMaxColumns() < start + missing.length - 1) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), start + missing.length - 1 - sheet.getMaxColumns());
    }
    sheet.getRange(1, start, 1, missing.length).setValues([missing]).setFontWeight('bold');
    // Plain text everywhere, so dates stay "2024-05-01" and comments starting
    // with "=" are never treated as formulas.
    sheet.getRange(1, start, sheet.getMaxRows(), missing.length).setNumberFormat('@');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// header name -> 1-based column number
function columns_(sheet) {
  const lastCol = sheet.getLastColumn();
  const names = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  const map = {};
  names.forEach((n, i) => {
    if (n) map[String(n)] = i + 1;
  });
  return map;
}

function readAll_(sheet) {
  const last = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  return last >= 2 ? sheet.getRange(2, 1, last - 1, lastCol).getValues() : [];
}

function str_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'UTC', 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v);
}

function readRows_() {
  const sheet = getSheet_();
  const col = columns_(sheet);
  return readAll_(sheet)
    .filter((r) => r[col.book_id - 1])
    .map((r) => {
      const raw = {};
      HEADERS.forEach((h) => {
        const v = r[col[h] - 1];
        raw[h] = h === 'updated_at' && v instanceof Date ? Utilities.formatDate(v, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'") : v;
      });
      const c = clean_(raw);
      return {
        book_id: c.book_id,
        title: c.title,
        status: c.status,
        rating: c.rating || null,
        comment: c.comment,
        date_finished: c.date_finished || null,
        owned: c.owned === 'yes',
        wishlist: c.wishlist === 'yes',
        formats: c.formats ? c.formats.split(',') : [],
        acquired_on: c.acquired_on || null,
        copy_notes: c.copy_notes,
        updated_at: c.updated_at,
      };
    });
}

function yes_(v) {
  return v === true || v === 1 || /^(yes|true|y|x|1)$/i.test(String(v).trim());
}

// Validates a row and applies the rules. Values are what gets written to the sheet.
function clean_(row) {
  const status = STATUSES.indexOf(row.status) >= 0 ? row.status : 'unread';
  const read = status === 'read';
  const owned = yes_(row.owned);
  const formatList = Array.isArray(row.formats) ? row.formats : str_(row.formats).split(',');
  const formats = formatList
    .map((f) => String(f).trim())
    .filter((f, i, all) => FORMATS.indexOf(f) >= 0 && all.indexOf(f) === i);
  const rating = Number(row.rating);
  const date = (v) => (/^\d{4}-\d{2}-\d{2}/.test(str_(v)) ? str_(v).slice(0, 10) : '');
  return {
    book_id: str_(row.book_id).slice(0, 100),
    title: str_(row.title).slice(0, 300),
    status: status,
    rating: read && rating >= 1 && rating <= 5 ? Math.round(rating) : '',
    comment: str_(row.comment).slice(0, 5000),
    date_finished: read ? date(row.date_finished) : '',
    owned: owned ? 'yes' : '',
    wishlist: !owned && yes_(row.wishlist) ? 'yes' : '',
    formats: owned ? formats.join(',') : '',
    acquired_on: owned ? date(row.acquired_on) : '',
    copy_notes: owned ? str_(row.copy_notes).slice(0, 1000) : '',
    updated_at: str_(row.updated_at) || new Date().toISOString(),
  };
}

// Reads the sheet once, then writes each row (only the columns this script owns).
function upsertAll_(rows) {
  const sheet = getSheet_();
  const col = columns_(sheet);
  const width = sheet.getLastColumn();
  const existing = readAll_(sheet);
  let last = existing.length + 1;
  const index = {};
  existing.forEach((r, i) => {
    const id = str_(r[col.book_id - 1]);
    if (id) index[id] = { row: i + 2, values: r };
  });

  let saved = 0;
  rows.forEach((raw) => {
    if (!raw || !raw.book_id) return;
    const row = clean_(raw);
    const hit = index[row.book_id];
    // Ignore stale writes (e.g. an old offline edit arriving after a newer one).
    if (hit && str_(hit.values[col.updated_at - 1]) > row.updated_at) return;
    const rowNumber = hit ? hit.row : ++last;
    const values = hit ? hit.values.slice() : new Array(width).fill('');
    HEADERS.forEach((h) => {
      values[col[h] - 1] = row[h];
    });
    sheet.getRange(rowNumber, 1, 1, width).setNumberFormat('@').setValues([values]);
    index[row.book_id] = { row: rowNumber, values: values };
    saved++;
  });
  return saved;
}

// Re-applies the rules to every row. Returns how many cells changed.
function cleanAll_(sheet) {
  const col = columns_(sheet);
  const values = readAll_(sheet);
  if (!values.length) return 0;
  let changed = 0;
  values.forEach((r) => {
    if (!r[col.book_id - 1]) return;
    const raw = {};
    HEADERS.forEach((h) => (raw[h] = r[col[h] - 1]));
    const c = clean_(raw);
    ['rating', 'date_finished', 'owned', 'wishlist', 'formats', 'acquired_on', 'copy_notes'].forEach((h) => {
      if (str_(r[col[h] - 1]) !== str_(c[h])) {
        r[col[h] - 1] = c[h];
        changed++;
      }
    });
  });
  if (changed) sheet.getRange(2, 1, values.length, values[0].length).setValues(values);
  return changed;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
