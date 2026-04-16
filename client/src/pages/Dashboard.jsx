import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTeam } from '../TeamContext';

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

function isHome(m, teamId) {
  return m.home_team_id === teamId;
}

function ownGoals(m, teamId) {
  return isHome(m, teamId) ? m.home_goals : m.away_goals;
}

function oppGoals(m, teamId) {
  return isHome(m, teamId) ? m.away_goals : m.home_goals;
}

function computeStats(matches, teamId) {
  const finished = matches.filter((m) => m.state === 'Post' && m.home_goals != null);
  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;

  for (const m of finished) {
    const own = ownGoals(m, teamId);
    const opp = oppGoals(m, teamId);
    goalsFor += own;
    goalsAgainst += opp;
    if (own > opp) wins++;
    else if (own === opp) draws++;
    else losses++;
  }

  return { played: finished.length, wins, draws, losses, goalsFor, goalsAgainst };
}

function resultColor(m, teamId) {
  if (m.state !== 'Post' || m.home_goals == null) return 'bg-gray-400 dark:bg-gray-600';
  const own = ownGoals(m, teamId);
  const opp = oppGoals(m, teamId);
  if (own > opp) return 'bg-green-500';
  if (own < opp) return 'bg-red-500';
  return 'bg-yellow-500';
}

function resultLabel(m, teamId) {
  if (m.state !== 'Post' || m.home_goals == null) return '–';
  const own = ownGoals(m, teamId);
  const opp = oppGoals(m, teamId);
  if (own > opp) return 'S';
  if (own < opp) return 'N';
  return 'U';
}

const TOTAL_TEAMS = 14;

function standingRowClass(rank) {
  if (rank <= 2) return 'text-green-600 dark:text-green-400';
  if (rank >= TOTAL_TEAMS - 2) return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-400';
}

function rankBadgeClass(rank) {
  if (rank === 1) return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400';
  if (rank <= 2) return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400';
  if (rank >= TOTAL_TEAMS - 2) return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
}

export default function Dashboard() {
  const { teamId, teamName } = useTeam();
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

  const stats = computeStats(matches, teamId);
  const finished = matches.filter((m) => m.state === 'Post' && m.home_goals != null);
  const recentFive = [...finished].slice(0, 5);
  const upcoming = matches.filter((m) => m.state !== 'Post').slice(-5).reverse();

  const formData = [...finished]
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .map((m) => {
      const own = ownGoals(m, teamId);
      const opp = oppGoals(m, teamId);
      return {
        id: m.id,
        diff: own - opp,
        own,
        opp,
        opponent: isHome(m, teamId) ? m.away_team_name : m.home_team_name,
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
      {standings.length > 0 && (() => {
        const fetchedAt = standings[0]?.fetched_at
          ? new Date(standings[0].fetched_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : null;
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg overflow-x-auto shadow-sm dark:shadow-none">
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tabelle</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Männer-Oberliga BW Staffel 2
                {fetchedAt && <span className="ml-2 text-gray-400 dark:text-gray-600">Stand: {fetchedAt}</span>}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  <th className="text-center px-3 py-2 w-8">#</th>
                  <th className="text-left px-2 py-2">Mannschaft</th>
                  <th className="text-center px-2 py-2 w-8" title="Spiele">Sp</th>
                  <th className="text-center px-2 py-2 w-8" title="Siege">S</th>
                  <th className="text-center px-2 py-2 w-8" title="Unentschieden">U</th>
                  <th className="text-center px-2 py-2 w-8" title="Niederlagen">N</th>
                  <th className="text-center px-2 py-2 w-16" title="Tore">Tore</th>
                  <th className="text-center px-2 py-2 w-10" title="Tordifferenz">Diff</th>
                  <th className="text-center px-3 py-2 w-12" title="Punkte">Pkt</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, idx) => {
                  const isMyTeam = s.team_id === teamId;
                  const isRelegationZone = s.rank >= TOTAL_TEAMS - 2;
                  const showPromotionBorder = idx > 0 && standings[idx - 1].rank <= 2 && s.rank > 2;
                  const showRelegationBorder = !showPromotionBorder && idx > 0 && standings[idx - 1].rank < TOTAL_TEAMS - 2 && isRelegationZone;
                  return (
                    <tr
                      key={s.team_id}
                      className={`border-b border-gray-100 dark:border-gray-700 last:border-0 text-sm ${
                        isMyTeam ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      } ${showPromotionBorder ? 'border-t-2 border-t-green-300 dark:border-t-green-700' : ''} ${showRelegationBorder ? 'border-t-2 border-t-red-300 dark:border-t-red-800' : ''}`}
                    >
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${rankBadgeClass(s.rank)}`}>{s.rank}</span>
                      </td>
                      <td className="px-2 py-2">
                        {isMyTeam ? (
                          <span className="font-medium text-blue-700 dark:text-blue-300">
                            {s.team_name}
                            <span className="ml-1.5 text-xs text-blue-500 dark:text-blue-400">◀</span>
                          </span>
                        ) : (
                          <Link to={`/teams/${s.team_id}`} className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                            {s.team_name}
                          </Link>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center text-gray-600 dark:text-gray-400">{s.games}</td>
                      <td className="px-2 py-2 text-center text-green-600 dark:text-green-400 font-medium">{s.wins}</td>
                      <td className="px-2 py-2 text-center text-gray-500 dark:text-gray-400">{s.draws}</td>
                      <td className="px-2 py-2 text-center text-red-600 dark:text-red-400">{s.losses}</td>
                      <td className="px-2 py-2 text-center text-gray-600 dark:text-gray-400">{s.goals_for}:{s.goals_against}</td>
                      <td className={`px-2 py-2 text-center font-medium ${s.goal_diff > 0 ? 'text-green-600 dark:text-green-400' : s.goal_diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {s.goal_diff > 0 ? `+${s.goal_diff}` : s.goal_diff}
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-gray-900 dark:text-white">{s.points_pos}:{s.points_neg}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex gap-4 px-5 py-2 text-xs text-gray-400 dark:text-gray-600">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-green-400 dark:bg-green-700 inline-block rounded-full" />
                Aufstieg
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-red-400 dark:bg-red-800 inline-block rounded-full" />
                Abstieg
              </span>
            </div>
          </div>
        );
      })()}

      {/* Recent form */}
      {recentFive.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Letzte 5 Spiele</h2>
          <div className="space-y-2">
            {recentFive.map((m) => {
              const own = ownGoals(m, teamId);
              const opp = oppGoals(m, teamId);
              const opponent = isHome(m, teamId) ? m.away_team_name : m.home_team_name;
              return (
                <Link key={m.id} to={`/matches/${m.id}`} className="flex items-center gap-3 hover:opacity-80">
                  <span className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center text-white shrink-0 ${resultColor(m, teamId)}`}>
                    {resultLabel(m, teamId)}
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
              const opponent = isHome(m, teamId) ? m.away_team_name : m.home_team_name;
              const home = isHome(m, teamId);
              return (
                <Link key={m.id} to={`/matches/${m.id}`} className="flex items-center gap-3 hover:opacity-80">
                  <span className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center shrink-0 border-2 bg-transparent ${
                    home
                      ? 'border-green-500 text-green-500'
                      : 'border-red-500 text-red-500'
                  }`}>
                    {home ? 'H' : 'A'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-24 shrink-0">{formatDate(m.starts_at)}</span>
                  <span className="flex-1 truncate text-sm">{opponent}</span>
                  <span className="text-sm font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">{formatTime(m.starts_at)} Uhr</span>
                </Link>
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
