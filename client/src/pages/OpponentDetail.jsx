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
  const [phases, setPhases] = useState([]);
  const [phaseExtremes, setPhaseExtremes] = useState(null);
  const [powerplay, setPowerplay] = useState(null);
  const [standing, setStanding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('uebersicht');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterHalf, setFilterHalf] = useState('all');
  const [filterLoading, setFilterLoading] = useState(false);

  useEffect(() => {
    const q = `?teamId=${encodeURIComponent(oppTeamId)}`;
    Promise.all([
      fetch(`/api/matches${q}`).then((r) => r.json()),
      fetch(`/api/stats/form${q}`).then((r) => r.json()),
      fetch(`/api/stats/goals-trend${q}`).then((r) => r.json()),
      fetch(`/api/stats/players${q}`).then((r) => r.json()),
      fetch(`/api/stats/phases${q}`).then((r) => r.json()),
      fetch(`/api/stats/phases/extremes${q}`).then((r) => r.json()),
      fetch(`/api/stats/powerplay${q}`).then((r) => r.json()),
      fetch('/api/standings').then((r) => r.json()),
    ])
      .then(([m, fd, gt, pl, ph, pe, pp, st]) => {
        setMatches(m);
        setFormData(fd);
        setGoalsTrend(gt);
        setPlayers(pl);
        setPhases(ph);
        setPhaseExtremes(pe);
        setPowerplay(pp);
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

  useEffect(() => {
    if (activeTab !== 'phasen') return;
    setFilterLoading(true);
    const params = new URLSearchParams({ teamId: oppTeamId, location: filterLocation, half: filterHalf });
    Promise.all([
      fetch(`/api/stats/phases?${params}`).then((r) => r.json()),
      fetch(`/api/stats/phases/extremes?${params}`).then((r) => r.json()),
      fetch(`/api/stats/powerplay?${params}`).then((r) => r.json()),
    ])
      .then(([ph, pe, pp]) => {
        setPhases(ph);
        setPhaseExtremes(pe);
        setPowerplay(pp);
      })
      .catch(console.error)
      .finally(() => setFilterLoading(false));
  }, [filterLocation, filterHalf, activeTab, oppTeamId]);

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
          { id: 'phasen', label: 'Phasenanalyse' },
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

      {activeTab === 'phasen' && (
        <PhasenTab
          phases={phases} phaseExtremes={phaseExtremes} powerplay={powerplay}
          oppName={oppName} filterLocation={filterLocation} filterHalf={filterHalf}
          setFilterLocation={setFilterLocation} setFilterHalf={setFilterHalf}
          filterLoading={filterLoading}
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

function FilterToggle({ options, value, onChange }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 transition-colors ${
            value === o.value
              ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
              : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PowerplayCard({ label, data, color, bg, border }) {
  if (!data) return null;
  return (
    <div className={`rounded-lg p-4 border ${bg} ${border}`}>
      <div className={`font-semibold mb-3 ${color}`}>{label}</div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Situationen</span>
          <span className="font-medium text-gray-900 dark:text-white">{data.total}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Tore erzielt</span>
          <span className="font-medium text-green-400">{data.goals}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Tore kassiert</span>
          <span className="font-medium text-red-400">{data.conceded}</span>
        </div>
        <div className="border-t border-gray-100 dark:border-gray-700 pt-1.5 flex justify-between gap-2 text-gray-500">
          <span className="text-green-400">{data.won}x gewonnen</span>
          <span>{data.neutral}x neutral</span>
          <span className="text-red-400">{data.lost}x verloren</span>
        </div>
        {data.total > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Gewinnquote</span>
            <span className={data.won / data.total >= 0.5 ? 'text-green-400' : 'text-red-400'}>
              {((data.won / data.total) * 100).toFixed(0)}% ({data.won}/{data.total})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function PhasenTab({ phases, phaseExtremes, powerplay, oppName, filterLocation, filterHalf, setFilterLocation, setFilterHalf, filterLoading }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        <FilterToggle
          options={[
            { value: 'all', label: 'Alle Spiele' },
            { value: 'home', label: 'Heim' },
            { value: 'away', label: 'Auswärts' },
          ]}
          value={filterLocation}
          onChange={setFilterLocation}
        />
        <FilterToggle
          options={[
            { value: 'all', label: 'Beide HZ' },
            { value: '1', label: '1. Halbzeit' },
            { value: '2', label: '2. Halbzeit' },
          ]}
          value={filterHalf}
          onChange={setFilterHalf}
        />
        {filterLoading && <span className="text-xs text-gray-500">Lädt...</span>}
      </div>

      {phaseExtremes && (phaseExtremes.powerPhase || phaseExtremes.deathPhase) && (
        <div className="grid grid-cols-2 gap-4">
          {phaseExtremes.powerPhase && (
            <div className="rounded-lg p-4 border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40">
              <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">Stärkste Phase</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {phaseExtremes.powerPhase.start}. – {phaseExtremes.powerPhase.end}. Minute
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Eigene Tore</span>
                  <span className="font-medium text-green-400">{phaseExtremes.powerPhase.teamGoals}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Gegentore</span>
                  <span className="font-medium text-red-400">{phaseExtremes.powerPhase.oppGoals}</span>
                </div>
                <div className="flex justify-between border-t border-green-200 dark:border-green-800/40 pt-1">
                  <span className="text-gray-600 dark:text-gray-400">Netto</span>
                  <span className="font-bold text-green-400">+{phaseExtremes.powerPhase.net}</span>
                </div>
              </div>
            </div>
          )}
          {phaseExtremes.deathPhase && (
            <div className="rounded-lg p-4 border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40">
              <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Schwächste Phase</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {phaseExtremes.deathPhase.start}. – {phaseExtremes.deathPhase.end}. Minute
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Eigene Tore</span>
                  <span className="font-medium text-green-400">{phaseExtremes.deathPhase.teamGoals}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Gegentore</span>
                  <span className="font-medium text-red-400">{phaseExtremes.deathPhase.oppGoals}</span>
                </div>
                <div className="flex justify-between border-t border-red-200 dark:border-red-800/40 pt-1">
                  <span className="text-gray-600 dark:text-gray-400">Netto</span>
                  <span className="font-bold text-red-400">{phaseExtremes.deathPhase.net}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {phases.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Schwächephasen</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Tore pro 5-Minuten-Block</p>
          <div className="space-y-1.5">
            {phases.map((p) => {
              const maxVal = Math.max(...phases.map((x) => Math.max(x.teamGoals, x.oppGoals)), 1);
              const teamW = Math.round((p.teamGoals / maxVal) * 100);
              const oppW = Math.round((p.oppGoals / maxVal) * 100);
              const netColor = p.net > 0 ? 'text-green-400' : p.net < 0 ? 'text-red-400' : 'text-gray-500';
              return (
                <div key={p.block} className="flex items-center gap-2 text-xs">
                  <span className="w-14 text-right text-gray-400 dark:text-gray-500 shrink-0">{p.label}</span>
                  <div className="flex-1 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <div className="h-3 bg-green-600 rounded-sm" style={{ width: `${teamW}%`, minWidth: teamW > 0 ? 4 : 0 }} />
                      <span className="text-gray-400">{p.teamGoals}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-3 bg-red-700 rounded-sm" style={{ width: `${oppW}%`, minWidth: oppW > 0 ? 4 : 0 }} />
                      <span className="text-gray-500">{p.oppGoals}</span>
                    </div>
                  </div>
                  <span className={`w-8 text-right font-bold shrink-0 ${netColor}`}>
                    {p.net > 0 ? `+${p.net}` : p.net}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-green-600 rounded-sm inline-block" /> {oppName}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-700 rounded-sm inline-block" /> Gegner</span>
          </div>
        </div>
      )}

      {powerplay && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 space-y-4 shadow-sm dark:shadow-none">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Über-/Unterzahl</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <PowerplayCard label="Überzahl" data={powerplay.ueberzahl} color="text-green-600 dark:text-green-400" border="border-green-200 dark:border-green-800/40" bg="bg-green-50 dark:bg-green-900/20" />
            <PowerplayCard label="Unterzahl" data={powerplay.unterzahl} color="text-red-600 dark:text-red-400" border="border-red-200 dark:border-red-800/40" bg="bg-red-50 dark:bg-red-900/20" />
          </div>
          <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide pt-2 border-t border-gray-100 dark:border-gray-700">Gleichzahl</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2">Tore außerhalb von Über-/Unterzahl-Fenstern</p>
          {(() => {
            const gz = powerplay.gleichzahl;
            const total = gz.goals + gz.conceded;
            const ratio = total > 0 ? ((gz.goals / total) * 100).toFixed(0) : null;
            const barW = total > 0 ? (gz.goals / total) * 100 : 50;
            return (
              <div className="rounded-lg p-4 border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40 text-xs">
                <div className="grid grid-cols-3 gap-3 mb-3 text-center">
                  <div>
                    <div className="text-lg font-bold text-green-400">{gz.goals}</div>
                    <div className="text-gray-500">Tore erzielt</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{total}</div>
                    <div className="text-gray-500">Gesamt</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-red-400">{gz.conceded}</div>
                    <div className="text-gray-500">Tore kassiert</div>
                  </div>
                </div>
                {ratio && (
                  <>
                    <div className="flex rounded-full overflow-hidden h-2 mb-1.5">
                      <div className="bg-green-500" style={{ width: `${barW}%` }} />
                      <div className="bg-red-700 flex-1" />
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span className="text-green-400 font-medium">{ratio}% Eigen</span>
                      <span className="text-red-400 font-medium">{100 - Number(ratio)}% Gegner</span>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}
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
