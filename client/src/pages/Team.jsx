import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

function computeSplit(matches, filter) {
  const games = matches.filter(filter);
  let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
  for (const m of games) {
    const own = m.is_home_game ? m.home_goals : m.away_goals;
    const opp = m.is_home_game ? m.away_goals : m.home_goals;
    gf += own; ga += opp;
    if (own > opp) wins++;
    else if (own === opp) draws++;
    else losses++;
  }
  return { played: games.length, wins, draws, losses, gf, ga, diff: gf - ga };
}

function buildOpponentStats(finished) {
  const map = {};
  for (const m of finished) {
    const name = m.is_home_game ? m.away_team_name : m.home_team_name;
    const own = m.is_home_game ? m.home_goals : m.away_goals;
    const opp = m.is_home_game ? m.away_goals : m.home_goals;
    if (!map[name]) map[name] = { name, games: [] };
    map[name].games.push({ own, opp, id: m.id, isHome: !!m.is_home_game });
  }
  return Object.values(map)
    .map((o) => {
      const net = o.games.reduce((s, g) => s + (g.own - g.opp), 0);
      return { ...o, net };
    })
    .sort((a, b) => b.net - a.net);
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
          <span className="text-green-400">{data.won}× gewonnen</span>
          <span>{data.neutral}× neutral</span>
          <span className="text-red-400">{data.lost}× verloren</span>
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

export default function Team() {
  const [matches, setMatches] = useState([]);
  const [phases, setPhases] = useState([]);
  const [phaseExtremes, setPhaseExtremes] = useState(null);
  const [powerplay, setPowerplay] = useState(null);
  const [comebacks, setComebacks] = useState([]);
  const [formData, setFormData] = useState([]);
  const [goalsTrend, setGoalsTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('uebersicht');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterHalf, setFilterHalf] = useState('all');
  const [filterLoading, setFilterLoading] = useState(false);
  const [trendLocation, setTrendLocation] = useState('all');
  const [trendHalf, setTrendHalf] = useState('all');
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/matches').then((r) => r.json()),
      fetch('/api/stats/phases').then((r) => r.json()),
      fetch('/api/stats/phases/extremes').then((r) => r.json()),
      fetch('/api/stats/powerplay').then((r) => r.json()),
      fetch('/api/stats/comebacks').then((r) => r.json()),
      fetch('/api/stats/form').then((r) => r.json()),
      fetch('/api/stats/goals-trend').then((r) => r.json()),
    ])
      .then(([m, p, pe, pp, cb, fd, gt]) => {
        setMatches(m);
        setPhases(p);
        setPhaseExtremes(pe);
        setPowerplay(pp);
        setComebacks(cb);
        setFormData(fd);
        setGoalsTrend(gt);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== 'phasen') return;
    setFilterLoading(true);
    const params = new URLSearchParams({ location: filterLocation, half: filterHalf });
    Promise.all([
      fetch(`/api/stats/phases?${params}`).then((r) => r.json()),
      fetch(`/api/stats/phases/extremes?${params}`).then((r) => r.json()),
      fetch(`/api/stats/powerplay?${params}`).then((r) => r.json()),
    ])
      .then(([p, pe, pp]) => {
        setPhases(p);
        setPhaseExtremes(pe);
        setPowerplay(pp);
      })
      .catch(console.error)
      .finally(() => setFilterLoading(false));
  }, [filterLocation, filterHalf, activeTab]);

  useEffect(() => {
    setTrendLoading(true);
    const params = new URLSearchParams({ location: trendLocation, half: trendHalf });
    fetch(`/api/stats/goals-trend?${params}`)
      .then((r) => r.json())
      .then(setGoalsTrend)
      .catch(console.error)
      .finally(() => setTrendLoading(false));
  }, [trendLocation, trendHalf]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-lg text-gray-400">Laden...</div>
      </div>
    );
  }

  const finished = matches.filter((m) => m.state === 'Post' && m.home_goals != null);
  const home = computeSplit(finished, (m) => m.is_home_game === 1);
  const away = computeSplit(finished, (m) => m.is_home_game === 0);
  const total = computeSplit(finished, () => true);
  const hinrunde = computeSplit(finished, (m) => new Date(m.starts_at) < new Date('2026-01-01'));
  const rueckrunde = computeSplit(finished, (m) => new Date(m.starts_at) >= new Date('2026-01-01'));

  const avgGf = total.played ? (total.gf / total.played).toFixed(1) : '–';
  const avgGa = total.played ? (total.ga / total.played).toFixed(1) : '–';

  const results = finished.map((m) => ({
    ...m,
    own: m.is_home_game ? m.home_goals : m.away_goals,
    opp: m.is_home_game ? m.away_goals : m.home_goals,
    opponent: m.is_home_game ? m.away_team_name : m.home_team_name,
  }));

  const wins = results
    .filter((r) => r.own > r.opp)
    .sort((a, b) => b.own - b.opp - (a.own - a.opp));
  const losses = results
    .filter((r) => r.own < r.opp)
    .sort((a, b) => a.own - a.opp - (b.own - b.opp));

  const opponents = buildOpponentStats(finished);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Teamanalyse</h1>
        <p className="text-sm text-gray-400 mt-0.5">Saison 2025/26 · TSV Wolfschlugen</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'uebersicht', label: 'Übersicht' },
          { id: 'phasen', label: 'Phasenanalyse' },
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

      {activeTab === 'phasen' && (
        <div className="space-y-6">
          {/* Filters */}
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

          {/* Power / Death Phase */}
          {phaseExtremes && (phaseExtremes.powerPhase || phaseExtremes.deathPhase) && (
            <div className="grid grid-cols-2 gap-4">
              {phaseExtremes.powerPhase && (
                <div className="rounded-lg p-4 border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40">
                  <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">
                    Stärkste Phase
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {phaseExtremes.powerPhase.start}. – {phaseExtremes.powerPhase.end}. Minute
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Wolfschl. Tore</span>
                      <span className="font-medium text-green-400">{phaseExtremes.powerPhase.wolfGoals}</span>
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
                  <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">
                    Schwächste Phase
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {phaseExtremes.deathPhase.start}. – {phaseExtremes.deathPhase.end}. Minute
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Wolfschl. Tore</span>
                      <span className="font-medium text-green-400">{phaseExtremes.deathPhase.wolfGoals}</span>
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

          {/* Schwächephasen */}
          {phases.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
              <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Schwächephasen</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Tore pro 5-Minuten-Block</p>
              <div className="space-y-1.5">
                {phases.map((p) => {
                  const maxVal = Math.max(...phases.map((x) => Math.max(x.wolfGoals, x.oppGoals)), 1);
                  const wolfW = Math.round((p.wolfGoals / maxVal) * 100);
                  const oppW = Math.round((p.oppGoals / maxVal) * 100);
                  const netColor = p.net > 0 ? 'text-green-400' : p.net < 0 ? 'text-red-400' : 'text-gray-500';
                  return (
                    <div key={p.block} className="flex items-center gap-2 text-xs">
                      <span className="w-14 text-right text-gray-400 dark:text-gray-500 shrink-0">{p.label}</span>
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <div className="h-3 bg-green-600 rounded-sm" style={{ width: `${wolfW}%`, minWidth: wolfW > 0 ? 4 : 0 }} />
                          <span className="text-gray-400">{p.wolfGoals}</span>
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
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-green-600 rounded-sm inline-block" /> Wolfschlugen</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-700 rounded-sm inline-block" /> Gegner</span>
              </div>
            </div>
          )}

          {/* Über-/Unterzahl + Gleichzahl */}
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
                          <span className="text-green-400 font-medium">{ratio}% Wolf</span>
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
      )}

      {activeTab === 'uebersicht' && <div className="space-y-6">

      {/* Formkurve */}
      {formData.length > 0 && (() => {
        const last5 = [...formData].slice(-5);
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
                {last5.map((d, i) => (
                  <Link key={d.matchId} to={`/matches/${d.matchId}`} className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center hover:opacity-80 ${resultBadge(d)}`}>
                    {resultLabel(d)}
                  </Link>
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

      {/* Tore / Gegentore Entwicklung */}
      {goalsTrend.filter((d) => d.own != null).length > 0 && (() => {
        const validData = goalsTrend.filter((d) => d.own != null);
        const CustomTooltip = ({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0]?.payload;
          if (!d) return null;
          return (
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs shadow">
              <div className="font-medium text-gray-900 dark:text-white mb-0.5">
                Sp. {d.gameIndex}: {d.opponent}
              </div>
              <div className="text-green-400">{d.own} erzielt</div>
              <div className="text-red-400">{d.opp} kassiert</div>
            </div>
          );
        };
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
              <div>
                <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tore / Gegentore</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Entwicklung über die Saison</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterToggle
                  options={[
                    { value: 'all', label: 'Alle' },
                    { value: 'home', label: 'Heim' },
                    { value: 'away', label: 'Auswärts' },
                  ]}
                  value={trendLocation}
                  onChange={setTrendLocation}
                />
                <FilterToggle
                  options={[
                    { value: 'all', label: 'Gesamt' },
                    { value: '1', label: '1. HZ' },
                    { value: '2', label: '2. HZ' },
                  ]}
                  value={trendHalf}
                  onChange={setTrendHalf}
                />
              </div>
            </div>
            {trendLoading ? (
              <div className="text-xs text-gray-400 py-4 text-center">Lädt...</div>
            ) : (
              <div style={{ height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={validData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <XAxis dataKey="gameIndex" tick={false} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="own" stroke="#22c55e" strokeWidth={2} dot={false} name="Erzielt" />
                    <Line type="monotone" dataKey="opp" stroke="#ef4444" strokeWidth={2} dot={false} name="Kassiert" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-green-500 inline-block" /> Tore erzielt</span>
              <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-red-500 inline-block" /> Tore kassiert</span>
            </div>
          </div>
        );
      })()}

      {/* Overall stats */}
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

      {/* Home vs Away */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
        <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Heim vs. Auswärts</h2>
        <div className="grid grid-cols-3 text-sm">
          <div></div>
          <div className="text-center font-medium text-gray-600 dark:text-gray-300 pb-2">Heim</div>
          <div className="text-center font-medium text-gray-600 dark:text-gray-300 pb-2">Auswärts</div>
          {[
            ['Spiele', home.played, away.played],
            ['Siege', home.wins, away.wins],
            ['Unentschieden', home.draws, away.draws],
            ['Niederlagen', home.losses, away.losses],
            ['Tore', `${home.gf}:${home.ga}`, `${away.gf}:${away.ga}`],
            [
              'Tordiff.',
              <span className={home.diff >= 0 ? 'text-green-400' : 'text-red-400'}>{home.diff >= 0 ? '+' : ''}{home.diff}</span>,
              <span className={away.diff >= 0 ? 'text-green-400' : 'text-red-400'}>{away.diff >= 0 ? '+' : ''}{away.diff}</span>,
            ],
          ].map(([label, h, a]) => (
            <>
              <div key={`${label}-l`} className="text-gray-600 dark:text-gray-400 py-2 border-t border-gray-100 dark:border-gray-700">{label}</div>
              <div key={`${label}-h`} className="text-center py-2 border-t border-gray-100 dark:border-gray-700 font-medium">{h}</div>
              <div key={`${label}-a`} className="text-center py-2 border-t border-gray-100 dark:border-gray-700 font-medium">{a}</div>
            </>
          ))}
        </div>
      </div>

      {/* Hin-/Rückrunde */}
      {(hinrunde.played > 0 || rueckrunde.played > 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Hin-/Rückrunde</h2>
          <div className="grid grid-cols-3 text-sm">
            <div></div>
            <div className="text-center font-medium text-gray-600 dark:text-gray-300 pb-2">Hinrunde</div>
            <div className="text-center font-medium text-gray-600 dark:text-gray-300 pb-2">Rückrunde</div>
            {[
              ['Spiele', hinrunde.played, rueckrunde.played],
              ['Siege', hinrunde.wins, rueckrunde.wins],
              ['Unentschieden', hinrunde.draws, rueckrunde.draws],
              ['Niederlagen', hinrunde.losses, rueckrunde.losses],
              ['Tore', `${hinrunde.gf}:${hinrunde.ga}`, `${rueckrunde.gf}:${rueckrunde.ga}`],
              [
                'Tordiff.',
                <span className={hinrunde.diff >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {hinrunde.diff >= 0 ? '+' : ''}{hinrunde.diff}
                </span>,
                <span className={rueckrunde.diff >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {rueckrunde.diff >= 0 ? '+' : ''}{rueckrunde.diff}
                </span>,
              ],
            ].map(([label, h, a]) => (
              <>
                <div key={`${label}-l`} className="text-gray-600 dark:text-gray-400 py-2 border-t border-gray-100 dark:border-gray-700">{label}</div>
                <div key={`${label}-h`} className="text-center py-2 border-t border-gray-100 dark:border-gray-700 font-medium">{h}</div>
                <div key={`${label}-a`} className="text-center py-2 border-t border-gray-100 dark:border-gray-700 font-medium">{a}</div>
              </>
            ))}
          </div>
        </div>
      )}

      {/* Gegner-Vergleich */}
      {opponents.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Gegner-Vergleich</h2>
          <div className="space-y-0">
            {opponents.map((o) => (
              <div
                key={o.name}
                className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 text-sm"
              >
                <span
                  className={`font-bold w-10 text-right shrink-0 ${
                    o.net > 0
                      ? 'text-green-400'
                      : o.net < 0
                      ? 'text-red-400'
                      : 'text-yellow-400'
                  }`}
                >
                  {o.net > 0 ? `+${o.net}` : o.net}
                </span>
                <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{o.name}</span>
                <div className="flex gap-2 shrink-0">
                  {o.games.map((g, i) => (
                    <Link
                      key={i}
                      to={`/matches/${g.id}`}
                      className={`text-xs font-medium hover:opacity-80 ${
                        g.own > g.opp
                          ? 'text-green-400'
                          : g.own < g.opp
                          ? 'text-red-400'
                          : 'text-yellow-400'
                      }`}
                      title={g.isHome ? 'Heim' : 'Auswärts'}
                    >
                      {g.own}:{g.opp}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">Ergebnisse klickbar</p>
        </div>
      )}

      {/* Best wins */}
      {wins.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Größte Siege</h2>
          <div className="space-y-2">
            {wins.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-sm">
                <span className="text-green-400 font-bold w-10 text-right shrink-0">
                  +{r.own - r.opp}
                </span>
                <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{r.opponent}</span>
                <span className="text-gray-400 font-medium whitespace-nowrap">
                  {r.own}:{r.opp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Worst losses */}
      {losses.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Höchste Niederlagen</h2>
          <div className="space-y-2">
            {losses.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-sm">
                <span className="text-red-400 font-bold w-10 text-right shrink-0">
                  {r.own - r.opp}
                </span>
                <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{r.opponent}</span>
                <span className="text-gray-400 font-medium whitespace-nowrap">
                  {r.own}:{r.opp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comebacks */}
      {comebacks.filter((c) => c.deficit > 2).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Comeback-Spiele</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Spiele wo Wolf mehr als 2 Tore zurücklag und nicht verlor</p>
          <div className="space-y-2">
            {comebacks.filter((c) => c.deficit > 2).map((c) => (
              <Link
                key={c.id}
                to={`/matches/${c.id}`}
                className="flex items-center gap-3 text-sm hover:opacity-80"
              >
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    c.result === 'win'
                      ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
                      : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400'
                  }`}
                >
                  {c.result === 'win' ? 'Sieg' : 'Unent.'}
                </span>
                <span className="text-red-400 font-medium shrink-0 w-8 text-center">
                  -{c.deficit}
                </span>
                <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{c.opponent}</span>
                <span className="text-gray-400 font-medium whitespace-nowrap">
                  {c.finalOwn}:{c.finalOpp}
                </span>
              </Link>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">Klickbar · Zahl = max. Rückstand</p>
        </div>
      )}
      </div>}
    </div>
  );
}
