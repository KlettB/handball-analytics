require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const { getDb } = require('./db');
const { fetchAllGames } = require('./fetcher/index');
const matchesRouter = require('./routes/matches');
const fetchDataRouter = require('./routes/fetchData');
const statsRouter = require('./routes/stats');

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Nightly data fetch cron job: every day at 03:00
cron.schedule('0 3 * * *', async () => {
  console.log('[cron] Starting nightly data fetch...');
  try {
    const summary = await fetchAllGames(
      process.env.TEAM_ID,
      process.env.SEASON_START,
      process.env.SEASON_END
    );
    console.log('[cron] Nightly data fetch complete:', summary);
  } catch (err) {
    console.error('[cron] Nightly data fetch failed:', err);
  }
});

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
