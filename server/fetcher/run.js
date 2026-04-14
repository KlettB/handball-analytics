/**
 * Standalone script to fetch data manually: npm run fetch-data
 */
require('dotenv').config();
const { fetchAllGames } = require('./index');

const teamId = process.env.TEAM_ID;
const dateFrom = process.env.SEASON_START;
const dateTo = process.env.SEASON_END;

if (!teamId || !dateFrom || !dateTo) {
  console.error('Missing TEAM_ID, SEASON_START, or SEASON_END in .env');
  process.exit(1);
}

fetchAllGames(teamId, dateFrom, dateTo)
  .then((summary) => {
    console.log('Fetch complete:', summary);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fetch failed:', err);
    process.exit(1);
  });
