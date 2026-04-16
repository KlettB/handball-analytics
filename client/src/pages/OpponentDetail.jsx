import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTeam } from '../TeamContext';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

function StatBox({ label, value, color = 'text-gray-900 dark:text-white' }) {
  return (
    <div className="bg-gray-100 dark:bg-gray-700 rounded p-4 text-center">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function computeSplit(matches, filter, teamId) {
  const games = matches.filter(filter);
  let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
  for (const m of games) {
    const isH = m.home_team_id === teamId;
    const own = isH ? m.home_goals : m.away_goals;
    const opp = isH ? m.away_goals : m.home_goals;
    gf += own; ga += opp;
    if (own > opp) wins++;
    else if (own === opp) draws++;
    else losses++;
  }
  return { played: games.length, wins, draws, losses, gf, ga, diff: gf - ga };
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function OpponentDetail() {
  const { teamId: oppTeamId } = useParams();
  const { teamId: ownTeamId, teamName: ownTeamName } = useTeam();

  const [oppName, setOppName] = useState('');
  const [matches, setMatches] = useState([]);
  const [formData, setFormData] = useState([]);
  const [goalsTrend, setGoalsTrend] = useState([]);
  const [players, setPlayers] = useState([]);
  const [standing, setStanding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('uebersicht');

  useEffect(() => {
    const q = `?teamId=${encodeURIComponent(oppTeamId)}`;
    Promise.all([
      fetch(`/api/matches${q}`).then((r) => r.json()),
      fetch(`/api/stats/form${q}`).then((r) => r.json()),
      fetch(`/api/stats/goals-trend${q}`).then((r) => r.json()),
      fetch(`/api/stats/players${q}`).then((r) => r.json()),
      fetch('/api/standings').then((r) => r.json()),
    ])
      .then(([m, fd, gt, pl, st]) => {
        setMatches(m);
        setFormData(fd);
        setGoalsTrend(gt);
        setPlayers(pl);
        const teamStanding = st.find((s) => s.team_id === oppTeamId);
        setStanding(teamStanding || null);
        const sample = m.find((x) => x.home_team_id === oppTeamId);
        setOppName(
          teamStanding?.team_name ||
          (sample ? sample.home_team_name : m[0]?.away_team_name) ||
          oppTeamId
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [oppTeamId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-lg text-gray-400">Laden...</div>
      </div>
    );
  }

  const finished = matches.filter((m) => m.state === 'Post' && m.home_goals != null);
  const total = computeSplit(finished, () => true, oppTeamId);
  const home = computeSplit(finished, (m) => m.home_team_id === oppTeamId, oppTeamId);
  const away = computeSplit(finished, (m) => m.away_team_id === oppTeamId, oppTeamId);

  const avgGf = total.played ? (total.gf / total.played).toFixed(1) : '–';
  const avgGa = total.played ? (total.ga / total.played).toFixed(1) : '–';

  // Head-to-head: games between opponent and own team
  const h2hGames = finished
    .filter((m) =>
      (m.home_team_id === oppTeamId && m.away_team_id === ownTeamId) ||
      (m.away_team_id === oppTeamId && m.home_team_id === ownTeamId)
    )
    .sort((a, b) => a.starts_at - b.starts_at);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">{oppName}</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Saison 2025/26
          {standing && <span> · Platz {standing.rank}</span>}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'uebersicht', label: 'Übersicht' },
          { id: 'spieler', label: 'Spieler' },
          { id: 'h2h', label: `Gegen ${ownTeamName || 'uns'}` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'uebersicht' && (
        <OverviewTab
          total={total} home={home} away={away} avgGf={avgGf} avgGa={avgGa}
          formData={formData} goalsTrend={goalsTrend} oppName={oppName}
        />
      )}

      {activeTab === 'spieler' && <PlayersTab players={players} />}

      {activeTab === 'h2h' && (
        <H2HTab
          h2hGames={h2hGames} oppTeamId={oppTeamId} ownTeamId={ownTeamId}
          oppName={oppName} ownTeamName={ownTeamName}
        />
      )}
    </div>
  );
}

function OverviewTab({ total, home, away, avgGf, avgGa, formData, goalsTrend, oppName }) {
  return (
    <div className="space-y-6">
      {/* Formkurve */}
      {formData.length > 0 && (() => {
        const last5 = formData.slice(-5);
        const resultLabel = (r) => r.result === 'win' ? 'S' : r.result === 'draw' ? 'U' : 'N';
        const resultBadge = (r) => r.result === 'win'
          ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
          : r.result === 'draw'
          ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400'
          : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400';
        const chartData = formData.map((d) => ({ ...d, diffDisplay: d.diff }));
        const CustomTooltip = ({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0]?.payload;
          if (!d) return null;
          return (
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs shadow">
              <div className="font-medium text-gray-900 dark:text-white mb-0.5">
                Sp. {d.gameIndex}: {d.opponent}
              </div>
              <div className="text-gray-500">{d.own}:{d.opp} · {d.cumulativePoints} Pkt</div>
            </div>
          );
        };
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Formkurve</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Tordifferenz + kumulierte Punkte</p>
              </div>
              <div className="flex gap-1">
                {last5.map((d) => (
                  <span key={d.matchId} className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${resultBadge(d)}`}>
                    {resultLabel(d)}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3" style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 4, right: 24, bottom: 0, left: -16 }}>
                  <XAxis dataKey="gameIndex" tick={false} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#60a5fa' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine yAxisId="left" y={0} stroke="#6b7280" strokeWidth={1} />
                  <Bar yAxisId="left" dataKey="diffDisplay" radius={[2, 2, 0, 0]} maxBarSize={20}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.diff > 0 ? '#22c55e' : d.diff < 0 ? '#ef4444' : '#eab308'} />
                    ))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="cumulativePoints" stroke="#60a5fa" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> Tordiff.</span>
              <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-blue-400 inline-block" /> Punkte (kum.)</span>
            </div>
          </div>
        );
      })()}

      {/* Tore / Gegentore */}
      {goalsTrend.filter((d) => d.own != null).length > 0 && (() => {
        const validData = goalsTrend.filter((d) => d.own != null);
        const CustomTooltip = ({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0]?.payload;
          if (!d) return null;
          return (
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs shadow">
              <div className="font-medium text-gray-900 dark:text-white mb-0.5">Sp. {d.gameIndex}: {d.opponent}</div>
              <div className="text-green-400">{d.own} erzielt</div>
              <div className="text-red-400">{d.opp} kassiert</div>
            </div>
          );
        };
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
            <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tore / Gegentore</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 mb-3">Entwicklung über die Saison</p>
            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={validData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <XAxis dataKey="gameIndex" tick={false} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="own" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="opp" stroke="#ef4444" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-green-500 inline-block" /> Tore erzielt</span>
              <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-red-500 inline-block" /> Tore kassiert</span>
            </div>
          </div>
        );
      })()}

      {/* Gesamt */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
        <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Gesamt</h2>
        <div className="grid grid-cols-4 gap-3">
          <StatBox label="Spiele" value={total.played} />
          <StatBox label="Tore/Spiel" value={avgGf} color="text-green-400" />
          <StatBox label="Gegen/Spiel" value={avgGa} color="text-red-400" />
          <StatBox
            label="Tordiff."
            value={`${total.diff > 0 ? '+' : ''}${total.diff}`}
            color={total.diff >= 0 ? 'text-green-400' : 'text-red-400'}
          />
        </div>
      </div>

      {/* Heim vs Auswärts */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
        <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Heim vs. Auswärts</h2>
        <div className="grid grid-cols-3 text-sm">
          <div></div>
          <div className="text-center font-medium text-gray-600 dark:text-gray-300 pb-2">Heim</div>
          <div className="text-center font-medium text-gray-600 dark:text-gray-300 pb-2">Auswärts</div>
          {[
            ['Spiele', home.played, away.played],
            ['Siege', home.wins, away.wins],
            ['U', home.draws, away.draws],
            ['Niederlagen', home.losses, away.losses],
            ['Tore', `${home.gf}:${home.ga}`, `${away.gf}:${away.ga}`],
            [
              'Tordiff.',
              <span key="hd" className={home.diff >= 0 ? 'text-green-400' : 'text-red-400'}>{home.diff >= 0 ? '+' : ''}{home.diff}</span>,
              <span key="ad" className={away.diff >= 0 ? 'text-green-400' : 'text-red-400'}>{away.diff >= 0 ? '+' : ''}{away.diff}</span>,
            ],
          ].map(([label, h, a], idx) => (
            <div key={idx} className="contents">
              <div className="text-gray-600 dark:text-gray-400 py-2 border-t border-gray-100 dark:border-gray-700">{label}</div>
              <div className="text-center py-2 border-t border-gray-100 dark:border-gray-700 font-medium">{h}</div>
              <div className="text-center py-2 border-t border-gray-100 dark:border-gray-700 font-medium">{a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayersTab({ players }) {
  const [sortKey, setSortKey] = useState('goals');

  const sorted = [...players].sort((a, b) => {
    if (sortKey === 'name') return a.player_name.localeCompare(b.player_name);
    return (b[sortKey] || 0) - (a[sortKey] || 0);
  });

  const cols = [
    { key: 'goals', label: 'Tore', title: 'Tore gesamt' },
    { key: 'seven_meter_goals', label: '7m', title: '7-Meter Tore' },
    { key: 'two_minute_penalties', label: "2'", title: '2-Minuten Strafen' },
    { key: 'warnings', label: 'G', title: 'Gelbe Karten' },
    { key: 'disqualifications', label: 'R', title: 'Rote Karten' },
    { key: 'games_played', label: 'Sp', title: 'Spiele' },
  ];

  const colColors = {
    goals: 'text-green-500 dark:text-green-400',
    seven_meter_goals: 'text-green-600 dark:text-green-300',
    two_minute_penalties: 'text-yellow-500 dark:text-yellow-400',
    warnings: 'text-yellow-600 dark:text-yellow-300',
    disqualifications: 'text-red-600 dark:text-red-500',
    games_played: 'text-gray-600 dark:text-gray-300',
  };

  if (sorted.length === 0) {
    return <p className="text-gray-400 text-center py-12">Keine Spielerdaten vorhanden.</p>;
  }

  return (
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
            <tr key={p.player_name} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-750">
              <td className="px-4 py-2.5 font-medium">{p.player_name}</td>
              {cols.map((c) => (
                <td key={c.key} className={`px-2 py-2.5 text-center ${p[c.key] > 0 ? colColors[c.key] : 'text-gray-300 dark:text-gray-600'}`}>
                  {p[c.key] > 0 ? p[c.key] : '–'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 dark:text-gray-600 py-2 text-center">
        Klick auf Spaltenüberschrift zum Sortieren
      </p>
    </div>
  );
}

function H2HTab({ h2hGames, oppTeamId, ownTeamId, oppName, ownTeamName }) {
  if (h2hGames.length === 0) {
    return <p className="text-gray-400 text-center py-12">Noch keine direkten Begegnungen.</p>;
  }

  let ownWins = 0, oppWins = 0, draws = 0, ownGf = 0, oppGf = 0;
  for (const m of h2hGames) {
    const ownIsHome = m.home_team_id === ownTeamId;
    const ownGoals = ownIsHome ? m.home_goals : m.away_goals;
    const oppGoals = ownIsHome ? m.away_goals : m.home_goals;
    ownGf += ownGoals;
    oppGf += oppGoals;
    if (ownGoals > oppGoals) ownWins++;
    else if (ownGoals < oppGoals) oppWins++;
    else draws++;
  }

  return (
    <div className="space-y-6">
      {/* Bilanz */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
        <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Direkte Bilanz</h2>
        <div className="grid grid-cols-3 gap-4 text-center mb-4">
          <div>
            <div className="text-2xl font-bold text-green-400">{ownWins}</div>
            <div className="text-xs text-gray-500">Siege {ownTeamName || 'Wir'}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-400">{draws}</div>
            <div className="text-xs text-gray-500">Unentschieden</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-400">{oppWins}</div>
            <div className="text-xs text-gray-500">Siege {oppName}</div>
          </div>
        </div>
        <div className="text-center text-sm text-gray-400">
          Tore: {ownGf}:{oppGf}
        </div>
      </div>

      {/* Einzelne Spiele */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
        <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Spiele</h2>
        <div className="space-y-2">
          {h2hGames.map((m) => {
            const ownIsHome = m.home_team_id === ownTeamId;
            const ownGoals = ownIsHome ? m.home_goals : m.away_goals;
            const oppGoals = ownIsHome ? m.away_goals : m.home_goals;
            const resultColor = ownGoals > oppGoals ? 'text-green-400' : ownGoals < oppGoals ? 'text-red-400' : 'text-yellow-400';
            return (
              <Link
                key={m.id}
                to={`/matches/${m.id}`}
                className="flex items-center gap-3 text-sm hover:opacity-80 py-1.5"
              >
                <span className="text-xs text-gray-500 w-16 shrink-0">{formatDate(m.starts_at)}</span>
                <span className="text-xs text-gray-400 w-8 shrink-0 text-center">{ownIsHome ? 'H' : 'A'}</span>
                <span className={`font-bold ${resultColor}`}>
                  {m.home_goals}:{m.away_goals}
                </span>
                <span className="text-gray-400 text-xs truncate">
                  {m.home_team_name} – {m.away_team_name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
