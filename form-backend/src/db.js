import Database from 'better-sqlite3';

const db = new Database(process.env.DB_PATH || './data.db');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS submissions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  form_type      TEXT NOT NULL,
  email          TEXT,
  consent        INTEGER NOT NULL DEFAULT 0,
  source         TEXT,
  data           TEXT NOT NULL,            -- JSON with the form-specific fields
  ip             TEXT,
  user_agent     TEXT,
  email_status   TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | failed | skipped
  email_attempts INTEGER NOT NULL DEFAULT 0,
  email_error    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sub_form ON submissions(form_type, created_at);
CREATE INDEX IF NOT EXISTS idx_sub_email ON submissions(email);
`);

const insert = db.prepare(`
  INSERT INTO submissions (form_type, email, consent, source, data, ip, user_agent)
  VALUES (@form_type, @email, @consent, @source, @data, @ip, @user_agent)`);

export const insertSubmission = (row) => insert.run(row).lastInsertRowid;

export const bumpAttempts = (id) =>
  db.prepare('UPDATE submissions SET email_attempts = email_attempts + 1 WHERE id = ?').run(id);

export const markEmail = (id, status, error = null) =>
  db.prepare('UPDATE submissions SET email_status = ?, email_error = ? WHERE id = ?').run(status, error, id);

export const findRetryable = () =>
  db.prepare(`SELECT * FROM submissions
              WHERE email_status IN ('pending','failed') AND email_attempts < 5
                AND created_at < datetime('now','-2 minutes')`).all();

export const getSubmission = (id) => db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
export const allSubmissions = () => db.prepare('SELECT * FROM submissions ORDER BY id').all();
