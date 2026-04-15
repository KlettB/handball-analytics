const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// GET /api/standings — full league table
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT team_id, team_name, rank, games, wins, draws, losses,
           goals_for, goals_against, goal_diff, points_pos, points_neg, fetched_at
    FROM standings
    ORDER BY rank ASC
  `).all();
  res.json(rows);
});

module.exports = router;
