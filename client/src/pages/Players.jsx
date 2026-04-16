import { useEffect, useState } from 'react';
import { useTeam } from '../TeamContext';

export default function Players() {
  const { teamName } = useTeam();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('goals');

  useEffect(() => {
    fetch('/api/stats/players')
      .then((r) => r.json())
      .then(setPlayers)
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

  const sorted = [...players].sort((a, b) => {
    if (sortKey === 'name') return a.player_name.localeCompare(b.player_name);
    return (b[sortKey] || 0) - (a[sortKey] || 0);
  });

  const cols = [
    { key: 'goals', label: 'Tore', title: 'Tore gesamt' },
    { key: 'seven_meter_goals', label: '7m', title: '7-Meter Tore' },
    { key: 'seven_meter_missed', label: '7✗', title: '7-Meter daneben' },
    { key: 'two_minute_penalties', label: "2'", title: '2-Minuten Strafen' },
    { key: 'warnings', label: 'G', title: 'Gelbe Karten' },
    { key: 'disqualifications', label: 'R', title: 'Rote Karten' },
    { key: 'games_played', label: 'Sp', title: 'Spiele' },
  ];

  const colColors = {
    goals: 'text-green-500 dark:text-green-400',
    seven_meter_goals: 'text-green-600 dark:text-green-300',
    seven_meter_missed: 'text-red-500 dark:text-red-400',
    two_minute_penalties: 'text-yellow-500 dark:text-yellow-400',
    warnings: 'text-yellow-600 dark:text-yellow-300',
    disqualifications: 'text-red-600 dark:text-red-500',
    games_played: 'text-gray-600 dark:text-gray-300',
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Spielerstatistik</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Saison 2025/26 · {teamName}</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg overflow-x-auto shadow-sm dark:shadow-none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              <th
                className={`text-left px-4 py-3 cursor-pointer hover:text-gray-900 dark:hover:text-white ${sortKey === 'name' ? 'text-gray-900 dark:text-white' : ''}`}
                onClick={() => setSortKey('name')}
              >
                Spieler
              </th>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={`px-2 py-3 text-center w-10 cursor-pointer hover:text-gray-900 dark:hover:text-white ${sortKey === c.key ? 'text-gray-900 dark:text-white' : ''}`}
                  title={c.title}
                  onClick={() => setSortKey(c.key)}
                >
                  {c.label}
                  {sortKey === c.key && <span className="ml-0.5">↓</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr
                key={p.player_name}
                className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-750"
              >
                <td className="px-4 py-2.5 font-medium">{p.player_name}</td>
                {cols.map((c) => (
                  <td
                    key={c.key}
                    className={`px-2 py-2.5 text-center ${p[c.key] > 0 ? colColors[c.key] : 'text-gray-300 dark:text-gray-600'}`}
                  >
                    {p[c.key] > 0 ? p[c.key] : '–'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-600 mt-2 text-center">
        Klick auf Spaltenüberschrift zum Sortieren
      </p>
    </div>
  );
}
