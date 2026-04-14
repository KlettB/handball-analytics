const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

/**
 * GET /api/matches
 * Returns all matches, sorted by date descending.
 */
router.get('/', (req, res) => {
  const db = getDb();
  const matches = db.prepare(`
    SELECT * FROM matches ORDER BY starts_at DESC
  `).all();

  res.json(matches);
});

/**
 * GET /api/matches/:id
 * Returns a single match with all its events.
 */
router.get('/:id', (req, res) => {
  const db = getDb();
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);

  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const events = db.prepare(`
    SELECT * FROM match_events WHERE match_id = ? ORDER BY elapsed_seconds ASC, event_id ASC
  `).all(req.params.id);

  res.json({ ...match, events });
});

module.exports = router;
