import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
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
  if (m.state !== 'Post' || m.home_goals == null) return 'bg-gray-400 dark:bg-gray-600';
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

const WOLF_ID = 'handball4all.baden-wuerttemberg.1331231';
const TOTAL_TEAMS = 14;

function standingRowClass(rank) {
  if (rank <= 2) return 'text-green-600 dark:text-green-400';
  if (rank >= TOTAL_TEAMS - 2) return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-400';
}

export default function Dashboard() {
  const [matches, setMatches] = useState([]);
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/matches').then((r) => r.json()),
      fetch('/api/standings').then((r) => r.json()),
    ])
      .then(([m, s]) => { setMatches(m); setStandings(s); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-lg text-gray-500 dark:text-gray-400">Laden...</div>
      </div>
    );
  }

  const stats = computeStats(matches);
  const finished = matches.filter((m) => m.state === 'Post' && m.home_goals != null);
  const recentFive = [...finished].slice(0, 5);
  const upcoming = matches.filter((m) => m.state !== 'Post').slice(-5).reverse();

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
      <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
        <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Saison 2025/26</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-500 dark:text-green-400">{stats.wins}</div>
            <div className="text-xs text-gray-500 mt-1">Siege</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-500 dark:text-yellow-400">{stats.draws}</div>
            <div className="text-xs text-gray-500 mt-1">Unentschieden</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-500 dark:text-red-400">{stats.losses}</div>
            <div className="text-xs text-gray-500 mt-1">Niederlagen</div>
          </div>
        </div>
        <div className="flex justify-center gap-6 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
          <span>{stats.played} Spiele</span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span>{stats.goalsFor}:{stats.goalsAgainst} Tore</span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className={stats.goalsFor - stats.goalsAgainst >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
            {stats.goalsFor - stats.goalsAgainst >= 0 ? '+' : ''}
            {stats.goalsFor - stats.goalsAgainst}
          </span>
        </div>
      </div>

      {/* League table */}
      {standings.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
          <div className="mb-3">
            <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tabelle</h2>
          </div>
          <div className="space-y-0">
            {standings.map((s) => {
              const isWolf = s.team_id === WOLF_ID;
              const showPromotionBorder = s.rank === 3;
              const showRelegationBorder = s.rank === TOTAL_TEAMS - 2;
              return (
                <div
                  key={s.team_id}
                  className={`flex items-center gap-2 py-1.5 text-sm ${showPromotionBorder ? 'border-t border-t-green-300 dark:border-t-green-700' : showRelegationBorder ? 'border-t border-t-red-300 dark:border-t-red-800' : 'border-t border-gray-50 dark:border-gray-700/50'} ${isWolf ? 'font-semibold' : ''}`}
                >
                  <span className={`w-5 text-right text-xs shrink-0 font-medium ${standingRowClass(s.rank)}`}>
                    {s.rank}
                  </span>
                  <span className={`flex-1 truncate ${isWolf ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                    {s.team_name}
                    {isWolf && <span className="ml-1 text-blue-400 text-xs">◀</span>}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-6 text-center shrink-0">{s.games}</span>
                  <span className={`text-xs font-bold w-10 text-right shrink-0 ${standingRowClass(s.rank)}`}>
                    {s.points_pos}:{s.points_neg}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent form */}
      {recentFive.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Letzte 5 Spiele</h2>
          <div className="space-y-2">
            {recentFive.map((m) => {
              const own = m.is_home_game ? m.home_goals : m.away_goals;
              const opp = m.is_home_game ? m.away_goals : m.home_goals;
              const opponent = m.is_home_game ? m.away_team_name : m.home_team_name;
              return (
                <Link key={m.id} to={`/matches/${m.id}`} className="flex items-center gap-3 hover:opacity-80">
                  <span className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center text-white shrink-0 ${resultColor(m)}`}>
                    {resultLabel(m)}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-24 shrink-0">{formatDate(m.starts_at)}</span>
                  <span className="flex-1 truncate text-sm">{opponent}</span>
                  <span className="text-sm font-bold whitespace-nowrap">{own} : {opp}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Formkurve */}
      {formData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Formkurve</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Tordifferenz pro Spiel</p>
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
                        {isPos && <div style={{ width: '100%', height: barH, backgroundColor: barColor, borderRadius: '2px 2px 0 0' }} />}
                      </div>
                      <div style={{ width: '100%', height: 2, backgroundColor: '#6b7280' }} />
                      <div style={{ height: 30, display: 'flex', alignItems: 'flex-start', width: '100%' }}>
                        {isNeg && <div style={{ width: '100%', height: barH, backgroundColor: barColor, borderRadius: '0 0 2px 2px' }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div className="flex justify-between text-xs text-gray-400 dark:text-gray-600 mt-1">
            <span>Spieltag 1</span>
            <span>Spieltag {formData.length}</span>
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Nächste Spiele</h2>
          <div className="space-y-2">
            {upcoming.map((m) => {
              const opponent = m.is_home_game ? m.away_team_name : m.home_team_name;
              const isHome = m.is_home_game === 1;
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center shrink-0 border-2 bg-transparent ${
                    isHome
                      ? 'border-green-500 text-green-500'
                      : 'border-red-500 text-red-500'
                  }`}>
                    {isHome ? 'H' : 'A'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-24 shrink-0">{formatDate(m.starts_at)}</span>
                  <span className="flex-1 truncate text-sm">{opponent}</span>
                  <span className="text-sm font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">{formatTime(m.starts_at)} Uhr</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/matches" className="bg-white dark:bg-gray-800 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm dark:shadow-none">
          <div className="font-semibold mb-1">Alle Spiele</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{matches.length} Einträge</div>
        </Link>
<Link to="/players" className="bg-white dark:bg-gray-800 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm dark:shadow-none">
          <div className="font-semibold mb-1">Spielerstatistik</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Saison-Übersicht</div>
        </Link>
        <Link to="/team" className="bg-white dark:bg-gray-800 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm dark:shadow-none">
          <div className="font-semibold mb-1">Teamanalyse</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Heim/Auswärts, Trends</div>
        </Link>
      </div>
    </div>
  );
}
