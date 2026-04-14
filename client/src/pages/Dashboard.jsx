import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function computeStats(matches) {
  const finished = matches.filter((m) => m.state === 'Post' && m.home_goals != null);
  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;

  for (const m of finished) {
    const own = m.is_home_game ? m.home_goals : m.away_goals;
    const opp = m.is_home_game ? m.away_goals : m.home_goals;
    goalsFor += own;
    goalsAgainst += opp;
    if (own > opp) wins++;
    else if (own === opp) draws++;
    else losses++;
  }

  return { played: finished.length, wins, draws, losses, goalsFor, goalsAgainst };
}

function resultColor(m) {
  if (m.state !== 'Post' || m.home_goals == null) return 'bg-gray-600';
  const own = m.is_home_game ? m.home_goals : m.away_goals;
  const opp = m.is_home_game ? m.away_goals : m.home_goals;
  if (own > opp) return 'bg-green-500';
  if (own < opp) return 'bg-red-500';
  return 'bg-yellow-500';
}

function resultLabel(m) {
  if (m.state !== 'Post' || m.home_goals == null) return '–';
  const own = m.is_home_game ? m.home_goals : m.away_goals;
  const opp = m.is_home_game ? m.away_goals : m.home_goals;
  if (own > opp) return 'S';
  if (own < opp) return 'N';
  return 'U';
}

export default function Dashboard() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/matches')
      .then((r) => r.json())
      .then(setMatches)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-lg text-gray-400">Laden...</div>
      </div>
    );
  }

  const stats = computeStats(matches);
  const finished = matches.filter((m) => m.state === 'Post' && m.home_goals != null);
  const recentFive = [...finished].slice(0, 5);
  const upcoming = matches.filter((m) => m.state !== 'Post').slice(-3).reverse();

  const formData = [...finished]
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .map((m) => {
      const own = m.is_home_game ? m.home_goals : m.away_goals;
      const opp = m.is_home_game ? m.away_goals : m.home_goals;
      return {
        id: m.id,
        diff: own - opp,
        own,
        opp,
        opponent: m.is_home_game ? m.away_team_name : m.home_team_name,
      };
    });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Season record */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm text-gray-400 uppercase tracking-wide mb-4">Saison 2025/26</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400">{stats.wins}</div>
            <div className="text-xs text-gray-500 mt-1">Siege</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400">{stats.draws}</div>
            <div className="text-xs text-gray-500 mt-1">Unentschieden</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-400">{stats.losses}</div>
            <div className="text-xs text-gray-500 mt-1">Niederlagen</div>
          </div>
        </div>
        <div className="flex justify-center gap-6 text-sm text-gray-400 border-t border-gray-700 pt-3">
          <span>{stats.played} Spiele</span>
          <span className="text-gray-600">·</span>
          <span>
            {stats.goalsFor}:{stats.goalsAgainst} Tore
          </span>
          <span className="text-gray-600">·</span>
          <span className={stats.goalsFor - stats.goalsAgainst >= 0 ? 'text-green-400' : 'text-red-400'}>
            {stats.goalsFor - stats.goalsAgainst >= 0 ? '+' : ''}
            {stats.goalsFor - stats.goalsAgainst}
          </span>
        </div>
      </div>

      {/* Recent form */}
      {recentFive.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-5">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide mb-4">Letzte 5 Spiele</h2>
          <div className="space-y-2">
            {recentFive.map((m) => {
              const own = m.is_home_game ? m.home_goals : m.away_goals;
              const opp = m.is_home_game ? m.away_goals : m.home_goals;
              const opponent = m.is_home_game ? m.away_team_name : m.home_team_name;
              return (
                <Link
                  key={m.id}
                  to={`/matches/${m.id}`}
                  className="flex items-center gap-3 hover:opacity-80"
                >
                  <span
                    className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center text-white shrink-0 ${resultColor(m)}`}
                  >
                    {resultLabel(m)}
                  </span>
                  <span className="text-xs text-gray-500 w-24 shrink-0">
                    {formatDate(m.starts_at)}
                  </span>
                  <span className="flex-1 truncate text-sm">{opponent}</span>
                  <span className="text-sm font-bold whitespace-nowrap">
                    {own} : {opp}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Formkurve */}
      {formData.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-5">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide mb-1">Formkurve</h2>
          <p className="text-xs text-gray-500 mb-4">Tordifferenz pro Spiel</p>
          {(() => {
            const maxAbs = Math.max(...formData.map((d) => Math.abs(d.diff)), 1);
            return (
              <div className="flex items-stretch gap-0.5" style={{ height: 64 }}>
                {formData.map((d) => {
                  const barH = Math.max(Math.round((Math.abs(d.diff) / maxAbs) * 28), 2);
                  const isPos = d.diff > 0;
                  const isNeg = d.diff < 0;
                  const barColor = isPos ? '#22c55e' : isNeg ? '#ef4444' : '#eab308';
                  return (
                    <div
                      key={d.id}
                      className="flex-1 flex flex-col items-center cursor-default"
                      title={`${d.opponent}: ${d.own}:${d.opp} (${d.diff >= 0 ? '+' : ''}${d.diff})`}
                    >
                      <div style={{ height: 30, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                        {isPos && (
                          <div style={{ width: '100%', height: barH, backgroundColor: barColor, borderRadius: '2px 2px 0 0' }} />
                        )}
                      </div>
                      <div style={{ width: '100%', height: 2, backgroundColor: '#4b5563' }} />
                      <div style={{ height: 30, display: 'flex', alignItems: 'flex-start', width: '100%' }}>
                        {isNeg && (
                          <div style={{ width: '100%', height: barH, backgroundColor: barColor, borderRadius: '0 0 2px 2px' }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>Spieltag 1</span>
            <span>Spieltag {formData.length}</span>
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-5">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide mb-4">Nächste Spiele</h2>
          <div className="space-y-2">
            {upcoming.map((m) => {
              const opponent = m.is_home_game ? m.away_team_name : m.home_team_name;
              const venue = m.is_home_game ? 'Heim' : 'Auswärts';
              return (
                <div key={m.id} className="flex items-center gap-3 text-sm">
                  <span className="text-xs text-gray-500 w-24 shrink-0">
                    {formatDate(m.starts_at)}
                  </span>
                  <span className="flex-1 truncate">{opponent}</span>
                  <span className="text-xs text-gray-500">{venue}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/matches"
          className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors"
        >
          <div className="font-semibold mb-1">Alle Spiele</div>
          <div className="text-xs text-gray-400">{matches.length} Einträge</div>
        </Link>
        <Link
          to="/players"
          className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors"
        >
          <div className="font-semibold mb-1">Spielerstatistik</div>
          <div className="text-xs text-gray-400">Saison-Übersicht</div>
        </Link>
        <Link
          to="/team"
          className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors"
        >
          <div className="font-semibold mb-1">Teamanalyse</div>
          <div className="text-xs text-gray-400">Heim/Auswärts, Trends</div>
        </Link>
      </div>
    </div>
  );
}
