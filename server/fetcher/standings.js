const { findInTree, parseFlightResponse } = require('./rscParser');
const { getDb } = require('../db');

const TOURNAMENT_ID = 'handball4all.baden-wuerttemberg.m-ol-2-bw_bwhv';

async function fetchStandings() {
  const url = `https://www.handball.net/ligen/${TOURNAMENT_ID}/tabelle`;
  const res = await fetch(url, {
    headers: { RSC: '1', 'User-Agent': 'handball-statistics/1.0' },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching standings`);
  }

  const text = await res.text();
  const parsed = parseFlightResponse(text);

  const entries = [];
  for (const item of parsed) {
    findInTree(
      item,
      (obj) => typeof obj.rank === 'number' && obj.team && obj.team.id,
      entries
    );
  }

  // Deduplicate by rank
  const seen = new Set();
  const unique = entries.filter((e) => {
    if (seen.has(e.rank)) return false;
    seen.add(e.rank);
    return true;
  });

  if (unique.length === 0) {
    throw new Error('No standings entries found in RSC response');
  }

  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO standings
      (team_id, team_name, rank, games, wins, draws, losses,
       goals_for, goals_against, goal_diff, points_pos, points_neg, fetched_at)
    VALUES
      (@team_id, @team_name, @rank, @games, @wins, @draws, @losses,
       @goals_for, @goals_against, @goal_diff, @points_pos, @points_neg, @fetched_at)
    ON CONFLICT(team_id) DO UPDATE SET
      team_name = @team_name, rank = @rank, games = @games,
      wins = @wins, draws = @draws, losses = @losses,
      goals_for = @goals_for, goals_against = @goals_against, goal_diff = @goal_diff,
      points_pos = @points_pos, points_neg = @points_neg, fetched_at = @fetched_at
  `);

  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    for (const e of unique) {
      // points format is "38:8" (positive:negative)
      const [pointsPos, pointsNeg] = String(e.points).split(':').map(Number);
      upsert.run({
        team_id: e.team.id,
        team_name: e.team.name,
        rank: e.rank,
        games: e.games,
        wins: e.wins,
        draws: e.draws,
        losses: e.losses,
        goals_for: e.goals,
        goals_against: e.goalsAgainst,
        goal_diff: e.goalDifference,
        points_pos: pointsPos || 0,
        points_neg: pointsNeg || 0,
        fetched_at: now,
      });
    }
  });

  transaction();
  console.log(`[standings] Saved ${unique.length} entries`);
  return unique.length;
}

module.exports = { fetchStandings };
