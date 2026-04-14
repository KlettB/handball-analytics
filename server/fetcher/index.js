const { fetchSchedule, fetchTicker, sleep } = require('./handballNet');
const { extractGames, extractTickerData } = require('./rscParser');
const { getDb } = require('../db');

/**
 * Parse "MM:SS" time string to total elapsed seconds.
 */
function parseTime(timeStr) {
  if (!timeStr) return null;
  const [min, sec] = timeStr.split(':').map(Number);
  if (isNaN(min) || isNaN(sec)) return null;
  return min * 60 + sec;
}

/**
 * Parse player name and number from event message.
 * Examples:
 *   "Tor durch Felix Mendler (21.) (TSV Wolfschlugen)"
 *   "7-Meter Tor durch Patrick Kohl (5.) (TSV Wolfschlugen)"
 *   "Jonas Jacobs (24.) (TSV Wolfschlugen) erhält eine 2-Minuten Strafe"
 *   "Jonas Jacobs (24.) (TSV Wolfschlugen) wurde verwarnt"
 */
function parsePlayerFromMessage(message) {
  if (!message) return { playerName: null, playerNumber: null };

  // "Tor durch NAME (NUM.) (TEAM)" or "7-Meter Tor durch NAME (NUM.) (TEAM)"
  const throughMatch = message.match(/durch\s+([\p{L}\- ]+?)\s*\((\d+)\.\)/u);
  if (throughMatch) {
    return { playerName: throughMatch[1].trim(), playerNumber: parseInt(throughMatch[2], 10) };
  }

  // "NAME (NUM.) (TEAM) erhält eine 2-Minuten Strafe" / "wurde verwarnt"
  const subjectMatch = message.match(/^([\p{L}\- ]+?)\s*\((\d+)\.\)/u);
  if (subjectMatch) {
    return { playerName: subjectMatch[1].trim(), playerNumber: parseInt(subjectMatch[2], 10) };
  }

  return { playerName: null, playerNumber: null };
}

/**
 * Parse score string like "33:30" into [home, away].
 */
function parseScore(scoreStr) {
  if (!scoreStr) return [null, null];
  const parts = scoreStr.split(':').map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return [null, null];
  return parts;
}

/**
 * Save a game and its events to the database.
 */
function saveGame(game, events, teamId) {
  const db = getDb();
  const isHome = game.homeTeam?.id === teamId;

  const upsertMatch = db.prepare(`
    INSERT INTO matches (id, home_team_id, home_team_name, away_team_id, away_team_name,
      home_goals, away_goals, home_goals_half, away_goals_half, starts_at, state,
      venue_name, venue_city, league, referee_info, attendance, game_number, is_home_game, fetched_at)
    VALUES (@id, @home_team_id, @home_team_name, @away_team_id, @away_team_name,
      @home_goals, @away_goals, @home_goals_half, @away_goals_half, @starts_at, @state,
      @venue_name, @venue_city, @league, @referee_info, @attendance, @game_number, @is_home_game, @fetched_at)
    ON CONFLICT(id) DO UPDATE SET
      home_goals = @home_goals, away_goals = @away_goals,
      home_goals_half = @home_goals_half, away_goals_half = @away_goals_half,
      state = @state, attendance = @attendance, referee_info = @referee_info,
      fetched_at = @fetched_at
  `);

  const deleteEvents = db.prepare('DELETE FROM match_events WHERE match_id = ?');

  const insertEvent = db.prepare(`
    INSERT INTO match_events (match_id, event_id, type, time, elapsed_seconds,
      score_home, score_away, team, player_name, player_number, message)
    VALUES (@match_id, @event_id, @type, @time, @elapsed_seconds,
      @score_home, @score_away, @team, @player_name, @player_number, @message)
  `);

  const transaction = db.transaction(() => {
    upsertMatch.run({
      id: game.id,
      home_team_id: game.homeTeam?.id || '',
      home_team_name: game.homeTeam?.name || '',
      away_team_id: game.awayTeam?.id || '',
      away_team_name: game.awayTeam?.name || '',
      home_goals: game.homeGoals ?? null,
      away_goals: game.awayGoals ?? null,
      home_goals_half: game.homeGoalsHalf ?? null,
      away_goals_half: game.awayGoalsHalf ?? null,
      starts_at: game.startsAt,
      state: game.state || 'Unknown',
      venue_name: game.field?.name || null,
      venue_city: game.field?.city || null,
      league: game.tournament?.name || null,
      referee_info: game.refereeInfo || null,
      attendance: game.attendance ?? null,
      game_number: game.gameNumber || null,
      is_home_game: isHome ? 1 : 0,
      fetched_at: new Date().toISOString(),
    });

    if (events && events.length > 0) {
      deleteEvents.run(game.id);
      for (const evt of events) {
        const [scoreHome, scoreAway] = parseScore(evt.score);
        const { playerName, playerNumber } = parsePlayerFromMessage(evt.message);

        insertEvent.run({
          match_id: game.id,
          event_id: evt.id,
          type: evt.type,
          time: evt.time,
          elapsed_seconds: parseTime(evt.time),
          score_home: scoreHome,
          score_away: scoreAway,
          team: evt.team || null,
          player_name: playerName,
          player_number: playerNumber,
          message: evt.message || null,
        });
      }
    }
  });

  transaction();
}

/**
 * Run the full data-fetching pipeline.
 */
async function fetchAllGames(teamId, dateFrom, dateTo) {
  console.log(`[fetcher] Starting fetch for ${teamId} (${dateFrom} – ${dateTo})`);

  // 1. Fetch schedule
  console.log('[fetcher] Fetching schedule...');
  const scheduleRsc = await fetchSchedule(teamId, dateFrom, dateTo);
  const games = extractGames(scheduleRsc);
  console.log(`[fetcher] Found ${games.length} games`);

  // 2. Filter to finished games only
  const finishedGames = games.filter((g) => g.state === 'Post');
  console.log(`[fetcher] ${finishedGames.length} finished games to fetch`);

  let fetched = 0;
  let errors = 0;

  for (const game of finishedGames) {
    try {
      await sleep(1500); // 1.5s pause between requests

      console.log(`[fetcher] Fetching ticker for ${game.id} (${game.homeTeam?.name} vs ${game.awayTeam?.name})...`);
      const tickerRsc = await fetchTicker(game.id);
      const { game: fullGame, events } = extractTickerData(tickerRsc);

      // Use the ticker's fullGame if available (has more data), fallback to schedule game
      const gameData = fullGame || game;
      saveGame(gameData, events || [], teamId);

      fetched++;
      console.log(`[fetcher]   -> ${events?.length || 0} events saved`);
    } catch (err) {
      errors++;
      console.error(`[fetcher] Error fetching ${game.id}: ${err.message}`);
    }
  }

  // 3. Also save future/upcoming games (without events)
  const upcomingGames = games.filter((g) => g.state !== 'Post');
  for (const game of upcomingGames) {
    try {
      saveGame(game, [], teamId);
    } catch (err) {
      console.error(`[fetcher] Error saving upcoming game ${game.id}: ${err.message}`);
    }
  }

  const summary = {
    total: games.length,
    fetched,
    errors,
    upcoming: upcomingGames.length,
  };
  console.log(`[fetcher] Done.`, summary);
  return summary;
}

module.exports = { fetchAllGames };
