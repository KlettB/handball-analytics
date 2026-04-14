const express = require('express');
const { fetchAllGames } = require('../fetcher/index');

const router = express.Router();

let fetching = false;

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
    const summary = await fetchAllGames(teamId, dateFrom, dateTo);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fetching = false;
  }
});

module.exports = router;
