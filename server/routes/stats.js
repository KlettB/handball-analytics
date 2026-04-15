const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// GET /api/stats/players - season stats for Wolfschlugen players only
router.get('/players', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      me.player_name,
      COUNT(DISTINCT me.match_id) AS games_played,
      COUNT(CASE WHEN me.type IN ('Goal', 'SevenMeterGoal') THEN 1 END) AS goals,
      COUNT(CASE WHEN me.type = 'SevenMeterGoal' THEN 1 END) AS seven_meter_goals,
      COUNT(CASE WHEN me.type = 'SevenMeterMissed' THEN 1 END) AS seven_meter_missed,
      COUNT(CASE WHEN me.type = 'TwoMinutePenalty' THEN 1 END) AS two_minute_penalties,
      COUNT(CASE WHEN me.type = 'Warning' THEN 1 END) AS warnings,
      COUNT(CASE WHEN me.type = 'Disqualification' THEN 1 END) AS disqualifications
    FROM match_events me
    JOIN matches m ON me.match_id = m.id
    WHERE me.player_name IS NOT NULL
      AND (
        (m.is_home_game = 1 AND me.team = 'Home') OR
        (m.is_home_game = 0 AND me.team = 'Away')
      )
    GROUP BY me.player_name
    ORDER BY goals DESC, me.player_name ASC
  `).all();
  res.json(rows);
});

// GET /api/stats/phases - goals per 5-minute block across the season
// Query params: location=home|away|all, half=1|2|all
router.get('/phases', (req, res) => {
  const db = getDb();
  const { location = 'all', half = 'all' } = req.query;

  let locationFilter = '';
  if (location === 'home') locationFilter = 'AND m.is_home_game = 1';
  else if (location === 'away') locationFilter = 'AND m.is_home_game = 0';

  let halfFilter = '';
  if (half === '1') halfFilter = 'AND me.elapsed_seconds < 1800';
  else if (half === '2') halfFilter = 'AND me.elapsed_seconds >= 1800';

  const events = db.prepare(`
    SELECT me.team, me.elapsed_seconds, m.is_home_game
    FROM match_events me
    JOIN matches m ON me.match_id = m.id
    WHERE me.type IN ('Goal', 'SevenMeterGoal')
      AND me.elapsed_seconds IS NOT NULL
      AND m.state = 'Post'
      ${locationFilter}
      ${halfFilter}
  `).all();

  // 12 blocks of 5 minutes (0–60')
  const blocks = Array.from({ length: 12 }, (_, i) => ({
    block: i,
    label: `${i * 5}–${(i + 1) * 5}'`,
    wolfGoals: 0,
    oppGoals: 0,
  }));

  for (const e of events) {
    const block = Math.min(Math.floor(e.elapsed_seconds / 300), 11);
    const wolfTeam = e.is_home_game ? 'Home' : 'Away';
    if (e.team === wolfTeam) {
      blocks[block].wolfGoals++;
    } else {
      blocks[block].oppGoals++;
    }
  }

  res.json(blocks.map((b) => ({ ...b, net: b.wolfGoals - b.oppGoals })));
});

// GET /api/stats/powerplay - season powerplay/shorthanded/gleichzahl summary
// Query params: location=home|away|all, half=1|2|all
router.get('/powerplay', (req, res) => {
  const db = getDb();
  const { location = 'all', half = 'all' } = req.query;

  let locationFilter = '';
  if (location === 'home') locationFilter = 'AND is_home_game = 1';
  else if (location === 'away') locationFilter = 'AND is_home_game = 0';

  const matches = db.prepare(`
    SELECT id, is_home_game FROM matches
    WHERE state = 'Post' ${locationFilter}
  `).all();

  const emptyBucket = () => ({ total: 0, goals: 0, conceded: 0, won: 0, neutral: 0, lost: 0 });
  const summary = {
    ueberzahl: emptyBucket(),
    unterzahl: emptyBucket(),
    gleichzahl: { goals: 0, conceded: 0 },
  };

  const eventsStmt = db.prepare(`
    SELECT type, team, elapsed_seconds
    FROM match_events
    WHERE match_id = ? AND elapsed_seconds IS NOT NULL
    ORDER BY elapsed_seconds ASC, id ASC
  `);

  for (const match of matches) {
    const wolfTeam = match.is_home_game ? 'Home' : 'Away';
    const oppTeam = match.is_home_game ? 'Away' : 'Home';
    let events = eventsStmt.all(match.id);

    // Apply half filter
    if (half === '1') events = events.filter((e) => e.elapsed_seconds < 1800);
    else if (half === '2') events = events.filter((e) => e.elapsed_seconds >= 1800);

    const penalties = events.filter((e) => e.type === 'TwoMinutePenalty');
    const goals = events.filter((e) => ['Goal', 'SevenMeterGoal'].includes(e.type));

    // Build set of seconds covered by any penalty window
    const penaltyWindows = penalties.map((p) => ({ start: p.elapsed_seconds, end: p.elapsed_seconds + 120 }));

    const isInPenaltyWindow = (sec) =>
      penaltyWindows.some((w) => sec > w.start && sec <= w.end);

    // Über-/Unterzahl
    for (const pen of penalties) {
      const start = pen.elapsed_seconds;
      const end = start + 120;
      const wolfInUnterzahl = pen.team === wolfTeam;

      const windowGoals = goals.filter((g) => g.elapsed_seconds > start && g.elapsed_seconds <= end);
      const wg = windowGoals.filter((g) => g.team === wolfTeam).length;
      const og = windowGoals.filter((g) => g.team === oppTeam).length;
      const net = wg - og;

      const cat = wolfInUnterzahl ? 'unterzahl' : 'ueberzahl';
      summary[cat].total++;
      summary[cat].goals += wg;
      summary[cat].conceded += og;
      if (net > 0) summary[cat].won++;
      else if (net === 0) summary[cat].neutral++;
      else summary[cat].lost++;
    }

    // Gleichzahl: goals NOT in any penalty window
    const gleichzahlGoals = goals.filter((g) => !isInPenaltyWindow(g.elapsed_seconds));
    summary.gleichzahl.goals += gleichzahlGoals.filter((g) => g.team === wolfTeam).length;
    summary.gleichzahl.conceded += gleichzahlGoals.filter((g) => g.team === oppTeam).length;
  }

  res.json(summary);
});

// GET /api/stats/comebacks - matches where Wolf was behind and didn't lose
router.get('/comebacks', (req, res) => {
  const db = getDb();
  const matches = db.prepare(`
    SELECT id, home_team_name, away_team_name, home_goals, away_goals, is_home_game, starts_at
    FROM matches WHERE state = 'Post' AND home_goals IS NOT NULL
  `).all();

  const eventsStmt = db.prepare(`
    SELECT score_home, score_away
    FROM match_events
    WHERE match_id = ? AND type IN ('Goal', 'SevenMeterGoal') AND score_home IS NOT NULL
    ORDER BY elapsed_seconds ASC, id ASC
  `);

  const comebacks = [];

  for (const m of matches) {
    const own = m.is_home_game ? m.home_goals : m.away_goals;
    const opp = m.is_home_game ? m.away_goals : m.home_goals;
    if (own < opp) continue; // lost — no comeback

    const events = eventsStmt.all(m.id);
    let minDiff = 0;
    for (const e of events) {
      const wolfLead = m.is_home_game
        ? e.score_home - e.score_away
        : e.score_away - e.score_home;
      if (wolfLead < minDiff) minDiff = wolfLead;
    }

    if (minDiff < 0) {
      comebacks.push({
        id: m.id,
        opponent: m.is_home_game ? m.away_team_name : m.home_team_name,
        deficit: -minDiff,
        finalOwn: own,
        finalOpp: opp,
        result: own > opp ? 'win' : 'draw',
        starts_at: m.starts_at,
      });
    }
  }

  comebacks.sort((a, b) => b.deficit - a.deficit);
  res.json(comebacks);
});

module.exports = router;
