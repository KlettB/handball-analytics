const BASE_URL = 'https://www.handball.net';

const RSC_HEADERS = {
  'RSC': '1',
  'User-Agent': 'handball-statistics/1.0',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a handball.net page as RSC flight data.
 */
async function fetchRsc(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { headers: RSC_HEADERS });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  return res.text();
}

/**
 * Fetch the Spielplan (schedule) page for a team.
 */
async function fetchSchedule(teamId, dateFrom, dateTo) {
  const path = `/mannschaften/${teamId}/spielplan?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  return fetchRsc(path);
}

/**
 * Fetch the ticker (play-by-play) page for a game.
 */
async function fetchTicker(gameId) {
  const path = `/spiele/${gameId}/ticker`;
  return fetchRsc(path);
}

module.exports = { fetchSchedule, fetchTicker, sleep };
