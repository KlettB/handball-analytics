import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const WOLF_ID = 'handball4all.baden-wuerttemberg.1331231';

export default function MatchList() {
  const [matches, setMatches] = useState([]);
  const [standings, setStandings] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/matches').then((r) => r.json()),
      fetch('/api/standings').then((r) => r.json()),
    ])
      .then(([m, s]) => {
        setMatches(m);
        // Build a map: team_id -> rank
        const map = {};
        for (const entry of s) map[entry.team_id] = entry.rank;
        setStandings(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function triggerFetch() {
    setFetching(true);
    try {
      await fetch('/api/fetch-data', { method: 'POST' });
      const res = await fetch('/api/matches');
      setMatches(await res.json());
    } catch (err) {
      console.error('Fetch failed:', err);
    } finally {
      setFetching(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-lg text-gray-500 dark:text-gray-400">Laden...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {matches.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Noch keine Spieldaten vorhanden.</p>
          <button
            onClick={triggerFetch}
            disabled={fetching}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {fetching ? 'Daten werden geladen...' : 'Daten laden'}
          </button>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">{matches.length} Spiele</span>
            <button
              onClick={triggerFetch}
              disabled={fetching}
              className="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              {fetching ? 'Läuft...' : 'Aktualisieren'}
            </button>
          </div>
          <div className="space-y-2">
            {matches.map((m) => (
              <MatchCard key={m.id} match={m} standings={standings} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function rankBadgeClass() {
  return 'text-gray-400 dark:text-gray-500';
}

function MatchCard({ match, standings }) {
  const isFinished = match.state === 'Post';
  const isHome = match.is_home_game === 1;

  const homeRank = standings[match.home_team_id];
  const awayRank = standings[match.away_team_id];

  let resultClass = 'text-gray-400 dark:text-gray-500';
  if (isFinished && match.home_goals != null) {
    const own = isHome ? match.home_goals : match.away_goals;
    const opp = isHome ? match.away_goals : match.home_goals;
    if (own > opp) resultClass = 'text-green-500 dark:text-green-400';
    else if (own < opp) resultClass = 'text-red-500 dark:text-red-400';
    else resultClass = 'text-yellow-500 dark:text-yellow-400';
  }

  const inner = (
    <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-3 shadow-sm dark:shadow-none">
      {/* Top row: date / time / venue */}
      <div className="text-xs text-gray-400 dark:text-gray-500 mb-2.5">
        {formatDate(match.starts_at)} · {formatTime(match.starts_at)}
        {match.venue_city && ` · ${match.venue_city}`}
      </div>

      {/* Main row: home | score | away */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Home team */}
        <div className="min-w-0">
          <div className={`font-semibold text-sm truncate ${isHome ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
            {match.home_team_name}
          </div>
          {homeRank && (
            <div className={`text-xs mt-0.5 ${rankBadgeClass()}`}>
              Aktuell Platz {homeRank}
            </div>
          )}
        </div>

        {/* Score / time */}
        <div className="text-center shrink-0">
          {isFinished && match.home_goals != null ? (
            <div className={`text-xl font-bold whitespace-nowrap ${resultClass}`}>
              {match.home_goals}:{match.away_goals}
            </div>
          ) : (
            <div className="text-sm font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap px-2">
              {formatTime(match.starts_at)}
            </div>
          )}
        </div>

        {/* Away team */}
        <div className="min-w-0 text-right">
          <div className={`font-semibold text-sm truncate ${!isHome ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
            {match.away_team_name}
          </div>
          {awayRank && (
            <div className={`text-xs mt-0.5 ${rankBadgeClass(awayRank)}`}>
              Aktuell Platz {awayRank}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isFinished) {
    return <Link to={`/matches/${match.id}`} className="block">{inner}</Link>;
  }
  return inner;
}
