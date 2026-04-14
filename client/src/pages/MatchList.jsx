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

export default function MatchList() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    fetch('/api/matches')
      .then((r) => r.json())
      .then(setMatches)
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
        <div className="text-lg text-gray-400">Laden...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {matches.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">Noch keine Spieldaten vorhanden.</p>
          <button
            onClick={triggerFetch}
            disabled={fetching}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            {fetching ? 'Daten werden geladen...' : 'Daten laden'}
          </button>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-400">{matches.length} Spiele</span>
            <button
              onClick={triggerFetch}
              disabled={fetching}
              className="text-sm px-3 py-1 border border-gray-600 rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {fetching ? 'Läuft...' : 'Aktualisieren'}
            </button>
          </div>
          <div className="space-y-2">
            {matches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MatchCard({ match }) {
  const isFinished = match.state === 'Post';
  const isHome = match.is_home_game === 1;

  let resultClass = 'text-gray-400';
  if (isFinished && match.home_goals != null) {
    const own = isHome ? match.home_goals : match.away_goals;
    const opp = isHome ? match.away_goals : match.home_goals;
    if (own > opp) resultClass = 'text-green-400';
    else if (own < opp) resultClass = 'text-red-400';
    else resultClass = 'text-yellow-400';
  }

  const inner = (
    <div className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 mb-1">
            {formatDate(match.starts_at)} · {formatTime(match.starts_at)}
            {match.venue_city && ` · ${match.venue_city}`}
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-semibold truncate ${isHome ? 'text-white' : ''}`}>
              {match.home_team_name}
            </span>
            <span className="text-gray-500">–</span>
            <span className={`font-semibold truncate ${!isHome ? 'text-white' : ''}`}>
              {match.away_team_name}
            </span>
          </div>
        </div>
        {isFinished && match.home_goals != null ? (
          <div className={`text-xl font-bold whitespace-nowrap ${resultClass}`}>
            {match.home_goals} : {match.away_goals}
          </div>
        ) : (
          <div className="text-sm text-gray-500 whitespace-nowrap">
            {formatTime(match.starts_at)}
          </div>
        )}
      </div>
    </div>
  );

  if (isFinished) {
    return <Link to={`/matches/${match.id}`} className="block">{inner}</Link>;
  }
  return inner;
}
