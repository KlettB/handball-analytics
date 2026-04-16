const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

function getTeamId(req) {
  return req.query.teamId || process.env.TEAM_ID || '';
}

function teamSide(match, teamId) {
  return match.home_team_id === teamId ? 'Home' : 'Away';
}

function oppSide(match, teamId) {
  return match.home_team_id === teamId ? 'Away' : 'Home';
}

function isHomeForTeam(match, teamId) {
  return match.home_team_id === teamId;
}

// GET /api/stats/players - season stats for the configured team's players
router.get('/players', (req, res) => {
  const db = getDb();
  const teamId = getTeamId(req);
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
      AND (m.home_team_id = @teamId OR m.away_team_id = @teamId)
      AND (
        (m.home_team_id = @teamId AND me.team = 'Home') OR
        (m.away_team_id = @teamId AND me.team = 'Away')
      )
    GROUP BY me.player_name
    ORDER BY goals DESC, me.player_name ASC
  `).all({ teamId });
  res.json(rows);
});

// GET /api/stats/phases - goals per 5-minute block across the season
// Query params: location=home|away|all, half=1|2|all
router.get('/phases', (req, res) => {
  const db = getDb();
  const teamId = getTeamId(req);
  const { location = 'all', half = 'all' } = req.query;

  let locationFilter = '';
  if (location === 'home') locationFilter = 'AND m.home_team_id = @teamId';
  else if (location === 'away') locationFilter = 'AND m.away_team_id = @teamId';

  let halfFilter = '';
  if (half === '1') halfFilter = 'AND me.elapsed_seconds < 1800';
  else if (half === '2') halfFilter = 'AND me.elapsed_seconds >= 1800';

  const events = db.prepare(`
    SELECT me.team, me.elapsed_seconds, m.home_team_id
    FROM match_events me
    JOIN matches m ON me.match_id = m.id
    WHERE me.type IN ('Goal', 'SevenMeterGoal')
      AND me.elapsed_seconds IS NOT NULL
      AND m.state = 'Post'
      AND (m.home_team_id = @teamId OR m.away_team_id = @teamId)
      ${locationFilter}
      ${halfFilter}
  `).all({ teamId });

  const blocks = Array.from({ length: 12 }, (_, i) => ({
    block: i,
    label: `${i * 5}–${(i + 1) * 5}'`,
    teamGoals: 0,
    oppGoals: 0,
  }));

  for (const e of events) {
    const block = Math.min(Math.floor(e.elapsed_seconds / 300), 11);
    const myTeamSide = e.home_team_id === teamId ? 'Home' : 'Away';
    if (e.team === myTeamSide) {
      blocks[block].teamGoals++;
    } else {
      blocks[block].oppGoals++;
    }
  }

  res.json(blocks.map((b) => ({ ...b, net: b.teamGoals - b.oppGoals })));
});

// GET /api/stats/powerplay - season powerplay/shorthanded/gleichzahl summary
// Query params: location=home|away|all, half=1|2|all
router.get('/powerplay', (req, res) => {
  const db = getDb();
  const teamId = getTeamId(req);
  const { location = 'all', half = 'all' } = req.query;

  let locationFilter = '';
  if (location === 'home') locationFilter = 'AND home_team_id = @teamId';
  else if (location === 'away') locationFilter = 'AND away_team_id = @teamId';

  const matches = db.prepare(`
    SELECT id, home_team_id FROM matches
    WHERE state = 'Post'
      AND (home_team_id = @teamId OR away_team_id = @teamId)
      ${locationFilter}
  `).all({ teamId });

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
    const myTeam = teamSide(match, teamId);
    const opp = oppSide(match, teamId);
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
      const teamInUnterzahl = pen.team === myTeam;

      const windowGoals = goals.filter((g) => g.elapsed_seconds > start && g.elapsed_seconds <= end);
      const wg = windowGoals.filter((g) => g.team === myTeam).length;
      const og = windowGoals.filter((g) => g.team === opp).length;
      const net = wg - og;

      const cat = teamInUnterzahl ? 'unterzahl' : 'ueberzahl';
      summary[cat].total++;
      summary[cat].goals += wg;
      summary[cat].conceded += og;
      if (net > 0) summary[cat].won++;
      else if (net === 0) summary[cat].neutral++;
      else summary[cat].lost++;
    }

    // Gleichzahl: goals NOT in any penalty window
    const gleichzahlGoals = goals.filter((g) => !isInPenaltyWindow(g.elapsed_seconds));
    summary.gleichzahl.goals += gleichzahlGoals.filter((g) => g.team === myTeam).length;
    summary.gleichzahl.conceded += gleichzahlGoals.filter((g) => g.team === opp).length;
  }

  res.json(summary);
});

// GET /api/stats/comebacks - matches where team was behind and didn't lose
router.get('/comebacks', (req, res) => {
  const db = getDb();
  const teamId = getTeamId(req);
  const matches = db.prepare(`
    SELECT id, home_team_id, home_team_name, away_team_name, home_goals, away_goals, starts_at
    FROM matches
    WHERE state = 'Post' AND home_goals IS NOT NULL
      AND (home_team_id = ? OR away_team_id = ?)
  `).all(teamId, teamId);

  const eventsStmt = db.prepare(`
    SELECT score_home, score_away
    FROM match_events
    WHERE match_id = ? AND type IN ('Goal', 'SevenMeterGoal') AND score_home IS NOT NULL
    ORDER BY elapsed_seconds ASC, id ASC
  `);

  const comebacks = [];

  for (const m of matches) {
    const isHome = isHomeForTeam(m, teamId);
    const own = isHome ? m.home_goals : m.away_goals;
    const opp = isHome ? m.away_goals : m.home_goals;
    if (own < opp) continue;

    const events = eventsStmt.all(m.id);
    let minDiff = 0;
    for (const e of events) {
      const lead = isHome
        ? e.score_home - e.score_away
        : e.score_away - e.score_home;
      if (lead < minDiff) minDiff = lead;
    }

    if (minDiff < 0) {
      comebacks.push({
        id: m.id,
        opponent: isHome ? m.away_team_name : m.home_team_name,
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

// GET /api/stats/phases/extremes - rolling 5-min window power/death phase
// Query params: location=home|away|all, half=1|2|all
router.get('/phases/extremes', (req, res) => {
  const db = getDb();
  const teamId = getTeamId(req);
  const { location = 'all', half = 'all' } = req.query;

  let locationFilter = '';
  if (location === 'home') locationFilter = 'AND m.home_team_id = @teamId';
  else if (location === 'away') locationFilter = 'AND m.away_team_id = @teamId';

  let halfFilter = '';
  if (half === '1') halfFilter = 'AND me.elapsed_seconds < 1800';
  else if (half === '2') halfFilter = 'AND me.elapsed_seconds >= 1800';

  const events = db.prepare(`
    SELECT me.team, me.elapsed_seconds, m.home_team_id
    FROM match_events me
    JOIN matches m ON me.match_id = m.id
    WHERE me.type IN ('Goal', 'SevenMeterGoal')
      AND me.elapsed_seconds IS NOT NULL
      AND m.state = 'Post'
      AND (m.home_team_id = @teamId OR m.away_team_id = @teamId)
      ${locationFilter}
      ${halfFilter}
  `).all({ teamId });

  if (events.length === 0) {
    return res.json({ powerPhase: null, deathPhase: null });
  }

  const maxStart = 55;
  const windowSecs = 300;
  let best = null, worst = null;

  for (let start = 0; start <= maxStart; start++) {
    const startSec = start * 60;
    const endSec = startSec + windowSecs;
    const inWindow = events.filter(
      (e) => e.elapsed_seconds >= startSec && e.elapsed_seconds < endSec,
    );
    let tGoals = 0, oGoals = 0;
    for (const e of inWindow) {
      const myTeamSide = e.home_team_id === teamId ? 'Home' : 'Away';
      if (e.team === myTeamSide) tGoals++;
      else oGoals++;
    }
    const net = tGoals - oGoals;
    const entry = { start, end: start + 5, teamGoals: tGoals, oppGoals: oGoals, net };
    if (!best || net > best.net || (net === best.net && tGoals > best.teamGoals)) best = entry;
    if (!worst || net < worst.net || (net === worst.net && oGoals > worst.oppGoals)) worst = entry;
  }

  res.json({ powerPhase: best, deathPhase: worst });
});

// GET /api/stats/form - per-game data for form curve (chronological)
router.get('/form', (req, res) => {
  const db = getDb();
  const teamId = getTeamId(req);
  const matches = db.prepare(`
    SELECT id, home_team_id, home_team_name, away_team_name, home_goals, away_goals, starts_at
    FROM matches
    WHERE state = 'Post' AND home_goals IS NOT NULL
      AND (home_team_id = ? OR away_team_id = ?)
    ORDER BY starts_at ASC
  `).all(teamId, teamId);

  let cumPoints = 0;
  const result = matches.map((m, i) => {
    const isHome = isHomeForTeam(m, teamId);
    const own = isHome ? m.home_goals : m.away_goals;
    const opp = isHome ? m.away_goals : m.home_goals;
    const diff = own - opp;
    let result, points;
    if (own > opp) { result = 'win'; points = 2; }
    else if (own === opp) { result = 'draw'; points = 1; }
    else { result = 'loss'; points = 0; }
    cumPoints += points;
    return {
      matchId: m.id,
      date: m.starts_at,
      opponent: isHome ? m.away_team_name : m.home_team_name,
      own,
      opp,
      diff,
      result,
      points,
      cumulativePoints: cumPoints,
      gameIndex: i + 1,
    };
  });

  res.json(result);
});

// GET /api/stats/goals-trend - goals scored vs conceded per game, with half filter
// Query params: location=home|away|all, half=1|2|all
router.get('/goals-trend', (req, res) => {
  const db = getDb();
  const teamId = getTeamId(req);
  const { location = 'all', half = 'all' } = req.query;

  let locationFilter = '';
  if (location === 'home') locationFilter = 'AND home_team_id = @teamId';
  else if (location === 'away') locationFilter = 'AND away_team_id = @teamId';

  const matches = db.prepare(`
    SELECT id, home_team_id, home_team_name, away_team_name, home_goals, away_goals,
           home_goals_half, away_goals_half, starts_at, state
    FROM matches
    WHERE state = 'Post' AND home_goals IS NOT NULL
      AND (home_team_id = @teamId OR away_team_id = @teamId)
      ${locationFilter}
    ORDER BY starts_at ASC
  `).all({ teamId });

  const result = matches.map((m, i) => {
    const isHome = isHomeForTeam(m, teamId);
    let own, opp;
    if (half === '1') {
      const ownHalf = isHome ? m.home_goals_half : m.away_goals_half;
      const oppHalf = isHome ? m.away_goals_half : m.home_goals_half;
      own = ownHalf ?? null;
      opp = oppHalf ?? null;
    } else if (half === '2') {
      const ownTotal = isHome ? m.home_goals : m.away_goals;
      const oppTotal = isHome ? m.away_goals : m.home_goals;
      const ownHalf = isHome ? m.home_goals_half : m.away_goals_half;
      const oppHalf = isHome ? m.away_goals_half : m.home_goals_half;
      own = (ownHalf != null && ownTotal != null) ? ownTotal - ownHalf : null;
      opp = (oppHalf != null && oppTotal != null) ? oppTotal - oppHalf : null;
    } else {
      own = isHome ? m.home_goals : m.away_goals;
      opp = isHome ? m.away_goals : m.home_goals;
    }
    return {
      matchId: m.id,
      date: m.starts_at,
      opponent: isHome ? m.away_team_name : m.home_team_name,
      own,
      opp,
      gameIndex: i + 1,
    };
  });

  res.json(result);
});

module.exports = router;
