const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'handball.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      home_team_id TEXT NOT NULL,
      home_team_name TEXT NOT NULL,
      away_team_id TEXT NOT NULL,
      away_team_name TEXT NOT NULL,
      home_goals INTEGER,
      away_goals INTEGER,
      home_goals_half INTEGER,
      away_goals_half INTEGER,
      starts_at INTEGER NOT NULL,
      state TEXT NOT NULL,
      venue_name TEXT,
      venue_city TEXT,
      league TEXT,
      referee_info TEXT,
      attendance INTEGER,
      game_number TEXT,
      is_home_game INTEGER NOT NULL DEFAULT 0,
      fetched_at TEXT
    );

    CREATE TABLE IF NOT EXISTS match_events (
      id INTEGER PRIMARY KEY,
      match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      event_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      time TEXT NOT NULL,
      elapsed_seconds INTEGER,
      score_home INTEGER,
      score_away INTEGER,
      team TEXT,
      player_name TEXT,
      player_number INTEGER,
      message TEXT,
      UNIQUE(match_id, event_id)
    );

    CREATE INDEX IF NOT EXISTS idx_events_match ON match_events(match_id);
    CREATE INDEX IF NOT EXISTS idx_matches_starts ON matches(starts_at);
  `);
}

module.exports = { getDb };
