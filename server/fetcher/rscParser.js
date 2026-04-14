/**
 * Parses Next.js RSC (React Server Components) flight responses.
 *
 * The flight format is line-based:
 *   LINE_ID:PAYLOAD
 *
 * Payloads that start with [ or { are JSON. We extract those and search
 * for the data objects we need (GameSummary, events, etc.).
 */

/**
 * Extract JSON objects from an RSC flight response string.
 * Returns an array of parsed JS values (objects/arrays).
 */
function parseFlightResponse(text) {
  const results = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const payload = line.slice(colonIdx + 1);
    if (!payload) continue;

    // Only try to parse lines whose payload looks like JSON
    const first = payload[0];
    if (first === '[' || first === '{') {
      try {
        results.push(JSON.parse(payload));
      } catch {
        // Not valid JSON, skip
      }
    }
  }

  return results;
}

/**
 * Recursively walk a parsed RSC structure to find objects matching a predicate.
 */
function findInTree(node, predicate, results = []) {
  if (node === null || node === undefined) return results;

  if (typeof node === 'object' && !Array.isArray(node)) {
    if (predicate(node)) {
      results.push(node);
    }
    for (const val of Object.values(node)) {
      findInTree(val, predicate, results);
    }
  } else if (Array.isArray(node)) {
    for (const item of node) {
      findInTree(item, predicate, results);
    }
  }

  return results;
}

/**
 * Extract all GameSummary objects from an RSC flight response.
 */
function extractGames(text) {
  const parsed = parseFlightResponse(text);
  const games = [];

  for (const item of parsed) {
    findInTree(item, (obj) => obj.type === 'GameSummary' && obj.id, games);
  }

  // Deduplicate by id (RSC often includes the same data twice)
  const seen = new Set();
  return games.filter((g) => {
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });
}

/**
 * Extract game + events from a ticker page RSC response.
 */
function extractTickerData(text) {
  const parsed = parseFlightResponse(text);

  let game = null;
  let events = null;

  for (const item of parsed) {
    // Find initialGame
    const games = [];
    findInTree(item, (obj) => obj.initialGame && obj.initialGame.type === 'GameSummary', games);
    if (games.length > 0 && !game) {
      game = games[0].initialGame;
    }

    // Find initialEvents
    const eventContainers = [];
    findInTree(item, (obj) => Array.isArray(obj.initialEvents), eventContainers);
    if (eventContainers.length > 0 && !events) {
      events = eventContainers[0].initialEvents;
    }
  }

  return { game, events };
}

module.exports = { parseFlightResponse, findInTree, extractGames, extractTickerData };
