import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTeam } from '../TeamContext';

const TOTAL_TEAMS = 14;
// Bottom 2 are relegated, top 2 promoted (adjust if known)
const RELEGATION_ZONE = TOTAL_TEAMS - 1; // rank >= this = danger

function rankBadgeClass(rank) {
  if (rank === 1) return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400';
  if (rank <= 2) return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400';
  if (rank >= TOTAL_TEAMS - 1) return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
}

export default function Standings() {
  const { teamId } = useTeam();
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/standings')
      .then((r) => r.json())
      .then(setStandings)
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

  if (standings.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-gray-500 dark:text-gray-400 text-center py-12">Keine Tabellendaten vorhanden.</p>
      </div>
    );
  }

  const fetchedAt = standings[0]?.fetched_at
    ? new Date(standings[0].fetched_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Tabelle</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Männer-Oberliga BW Staffel 2 · Saison 2025/26
          {fetchedAt && <span className="ml-2 text-xs text-gray-400 dark:text-gray-600">Stand: {fetchedAt}</span>}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg overflow-x-auto shadow-sm dark:shadow-none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              <th className="text-center px-3 py-3 w-8">#</th>
              <th className="text-left px-2 py-3">Mannschaft</th>
              <th className="text-center px-2 py-3 w-8" title="Spiele">Sp</th>
              <th className="text-center px-2 py-3 w-8" title="Siege">S</th>
              <th className="text-center px-2 py-3 w-8" title="Unentschieden">U</th>
              <th className="text-center px-2 py-3 w-8" title="Niederlagen">N</th>
              <th className="text-center px-2 py-3 w-16" title="Tore">Tore</th>
              <th className="text-center px-2 py-3 w-10" title="Tordifferenz">Diff</th>
              <th className="text-center px-3 py-3 w-12" title="Punkte">Pkt</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, idx) => {
              const isMyTeam = s.team_id === teamId;
              const isPromotionZone = s.rank <= 2;
              const isRelegationZone = s.rank >= TOTAL_TEAMS - 1;

              // Zone separator: draw a line above rank 3 and above rank 13
              const showPromotionBorder = idx > 0 && standings[idx - 1].rank <= 2 && s.rank > 2;
              const showRelegationBorder = !showPromotionBorder && idx > 0 && standings[idx - 1].rank < TOTAL_TEAMS - 1 && isRelegationZone;

              return (
                <tr
                  key={s.team_id}
                  className={`border-b border-gray-100 dark:border-gray-700 last:border-0 text-sm ${
                    isMyTeam ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  } ${showPromotionBorder ? 'border-t-2 border-t-green-300 dark:border-t-green-700' : ''} ${showRelegationBorder ? 'border-t-2 border-t-red-300 dark:border-t-red-800' : ''}`}
                >
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${rankBadgeClass(s.rank)}`}>
                      {s.rank}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
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
                  <td className="px-2 py-2.5 text-center text-gray-600 dark:text-gray-400">{s.games}</td>
                  <td className="px-2 py-2.5 text-center text-green-600 dark:text-green-400 font-medium">{s.wins}</td>
                  <td className="px-2 py-2.5 text-center text-gray-500 dark:text-gray-400">{s.draws}</td>
                  <td className="px-2 py-2.5 text-center text-red-600 dark:text-red-400">{s.losses}</td>
                  <td className="px-2 py-2.5 text-center text-gray-600 dark:text-gray-400">{s.goals_for}:{s.goals_against}</td>
                  <td className={`px-2 py-2.5 text-center font-medium ${s.goal_diff > 0 ? 'text-green-600 dark:text-green-400' : s.goal_diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {s.goal_diff > 0 ? `+${s.goal_diff}` : s.goal_diff}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-gray-900 dark:text-white">
                    {s.points_pos}:{s.points_neg}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 mt-3 text-xs text-gray-400 dark:text-gray-600">
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
}
