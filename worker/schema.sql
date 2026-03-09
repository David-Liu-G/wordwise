CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  country TEXT,
  city TEXT,
  region TEXT,
  timezone TEXT,
  user_agent TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS progress_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  word_id TEXT NOT NULL,
  word_english TEXT NOT NULL,
  word_chinese TEXT NOT NULL,
  action TEXT NOT NULL, -- 'learn', 'quiz_correct', 'quiz_wrong'
  level INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_progress_session ON progress_events(session_id);
CREATE INDEX IF NOT EXISTS idx_progress_created ON progress_events(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen_at);
