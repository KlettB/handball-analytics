const express = require('express');
const { fetchAllGames, fetchLeagueGames } = require('../fetcher/index');
const { fetchStandings } = require('../fetcher/standings');

const router = express.Router();

let fetching = false;
let fetchingLeague = false;

/**
 * POST /api/fetch-data
 * Manually trigger a data fetch. Only one fetch can run at a time.
 */
router.post('/', async (req, res) => {
  if (fetching) {
    return res.status(409).json({ error: 'Fetch already in progress' });
  }

  const teamId = process.env.TEAM_ID;
  const dateFrom = process.env.SEASON_START;
  const dateTo = process.env.SEASON_END;

  if (!teamId || !dateFrom || !dateTo) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  fetching = true;
  try {
    const [summary] = await Promise.all([
      fetchAllGames(teamId, dateFrom, dateTo),
      fetchStandings().catch((err) => console.error('[fetch-data] Standings fetch failed:', err.message)),
    ]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fetching = false;
  }
});

/**
 * POST /api/fetch-league
 * Trigger a league-wide data fetch. Fetches schedules + tickers for all teams.
 */
router.post('/league', async (req, res) => {
  if (fetchingLeague) {
    return res.status(409).json({ error: 'League fetch already in progress' });
  }

  const dateFrom = process.env.SEASON_START;
  const dateTo = process.env.SEASON_END;

  if (!dateFrom || !dateTo) {
    return res.status(500).json({ error: 'Missing SEASON_START/SEASON_END environment variables' });
  }

  fetchingLeague = true;
  try {
    const summary = await fetchLeagueGames(dateFrom, dateTo);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fetchingLeague = false;
  }
});

module.exports = router;
