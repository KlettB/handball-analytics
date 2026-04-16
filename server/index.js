require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const { getDb } = require('./db');
const { fetchAllGames, fetchLeagueGames } = require('./fetcher/index');
const { fetchStandings } = require('./fetcher/standings');
const matchesRouter = require('./routes/matches');
const fetchDataRouter = require('./routes/fetchData');
const statsRouter = require('./routes/stats');
const standingsRouter = require('./routes/standings');
const configRouter = require('./routes/config');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// Initialize database on startup
getDb();

// API routes
app.use('/api/matches', matchesRouter);
app.use('/api/fetch-data', fetchDataRouter);
app.use('/api/stats', statsRouter);
app.use('/api/standings', standingsRouter);
app.use('/api/config', configRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Nightly data fetch cron job: every day at 03:00
cron.schedule('0 3 * * *', async () => {
  console.log('[cron] Starting nightly data fetch...');
  try {
    const [summary] = await Promise.all([
      fetchAllGames(process.env.TEAM_ID, process.env.SEASON_START, process.env.SEASON_END),
      fetchStandings().catch((err) => console.error('[cron] Standings fetch failed:', err.message)),
    ]);
    console.log('[cron] Nightly data fetch complete:', summary);
  } catch (err) {
    console.error('[cron] Nightly data fetch failed:', err);
  }
});

// Weekly league-wide fetch: every Sunday at 04:00 (opt-in via FETCH_LEAGUE_WIDE=true)
if (process.env.FETCH_LEAGUE_WIDE === 'true') {
  cron.schedule('0 4 * * 0', async () => {
    console.log('[cron] Starting weekly league-wide fetch...');
    try {
      const summary = await fetchLeagueGames(process.env.SEASON_START, process.env.SEASON_END);
      console.log('[cron] League-wide fetch complete:', summary);
    } catch (err) {
      console.error('[cron] League-wide fetch failed:', err);
    }
  });
  console.log('[cron] League-wide fetch enabled (Sundays 04:00)');
}

// Serve React app in production
if (isProd) {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
