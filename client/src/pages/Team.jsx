import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function StatBox({ label, value, color = 'text-white' }) {
  return (
    <div className="bg-gray-750 rounded p-4 text-center">
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

export default function Team() {
  const [matches, setMatches] = useState([]);
  const [phases, setPhases] = useState([]);
  const [powerplay, setPowerplay] = useState(null);
  const [comebacks, setComebacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/matches').then((r) => r.json()),
      fetch('/api/stats/phases').then((r) => r.json()),
      fetch('/api/stats/powerplay').then((r) => r.json()),
      fetch('/api/stats/comebacks').then((r) => r.json()),
    ])
      .then(([m, p, pp, cb]) => {
        setMatches(m);
        setPhases(p);
        setPowerplay(pp);
        setComebacks(cb);
      })
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

  const maxPhaseVal = phases.length
    ? Math.max(...phases.map((p) => Math.max(p.wolfGoals, p.oppGoals)))
    : 1;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Teamanalyse</h1>
        <p className="text-sm text-gray-400 mt-0.5">Saison 2025/26 · TSV Wolfschlugen</p>
      </div>

      {/* Overall stats */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm text-gray-400 uppercase tracking-wide mb-4">Gesamt</h2>
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
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm text-gray-400 uppercase tracking-wide mb-4">Heim vs. Auswärts</h2>
        <div className="grid grid-cols-3 text-sm">
          <div></div>
          <div className="text-center font-medium text-gray-300 pb-2">Heim</div>
          <div className="text-center font-medium text-gray-300 pb-2">Auswärts</div>
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
              <div key={`${label}-l`} className="text-gray-400 py-2 border-t border-gray-700">{label}</div>
              <div key={`${label}-h`} className="text-center py-2 border-t border-gray-700 font-medium">{h}</div>
              <div key={`${label}-a`} className="text-center py-2 border-t border-gray-700 font-medium">{a}</div>
            </>
          ))}
        </div>
      </div>

      {/* Hin-/Rückrunde */}
      {(hinrunde.played > 0 || rueckrunde.played > 0) && (
        <div className="bg-gray-800 rounded-lg p-5">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide mb-4">Hin-/Rückrunde</h2>
          <div className="grid grid-cols-3 text-sm">
            <div></div>
            <div className="text-center font-medium text-gray-300 pb-2">Hinrunde</div>
            <div className="text-center font-medium text-gray-300 pb-2">Rückrunde</div>
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
                <div key={`${label}-l`} className="text-gray-400 py-2 border-t border-gray-700">{label}</div>
                <div key={`${label}-h`} className="text-center py-2 border-t border-gray-700 font-medium">{h}</div>
                <div key={`${label}-a`} className="text-center py-2 border-t border-gray-700 font-medium">{a}</div>
              </>
            ))}
          </div>
        </div>
      )}

      {/* Schwächephasen */}
      {phases.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-5">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide mb-1">Schwächephasen</h2>
          <p className="text-xs text-gray-500 mb-4">
            Tore pro 5-Minuten-Block über alle Spiele
          </p>
          <div className="space-y-1.5">
            {phases.map((p) => {
              const wolfW = Math.round((p.wolfGoals / maxPhaseVal) * 100);
              const oppW = Math.round((p.oppGoals / maxPhaseVal) * 100);
              const netColor =
                p.net > 0 ? 'text-green-400' : p.net < 0 ? 'text-red-400' : 'text-gray-500';
              return (
                <div key={p.block} className="flex items-center gap-2 text-xs">
                  <span className="w-14 text-right text-gray-500 shrink-0">{p.label}</span>
                  <div className="flex-1 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <div
                        className="h-3 bg-green-600 rounded-sm"
                        style={{ width: `${wolfW}%`, minWidth: wolfW > 0 ? 4 : 0 }}
                      />
                      <span className="text-gray-400">{p.wolfGoals}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div
                        className="h-3 bg-red-700 rounded-sm"
                        style={{ width: `${oppW}%`, minWidth: oppW > 0 ? 4 : 0 }}
                      />
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
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 bg-green-600 rounded-sm inline-block" /> TSV Wolfschlugen
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 bg-red-700 rounded-sm inline-block" /> Gegner
            </span>
          </div>
        </div>
      )}

      {/* Über-/Unterzahl */}
      {powerplay && (
        <div className="bg-gray-800 rounded-lg p-5">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide mb-4">Über-/Unterzahl</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              {
                label: 'Überzahl',
                data: powerplay.ueberzahl,
                color: 'text-green-400',
                border: 'border-green-800/40',
                bg: 'bg-green-900/20',
              },
              {
                label: 'Unterzahl',
                data: powerplay.unterzahl,
                color: 'text-red-400',
                border: 'border-red-800/40',
                bg: 'bg-red-900/20',
              },
            ].map(({ label, data, color, border, bg }) => (
              <div key={label} className={`rounded-lg p-4 border ${bg} ${border}`}>
                <div className={`font-semibold mb-3 ${color}`}>{label}</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-400">
                    <span>Situationen</span>
                    <span className="font-medium text-white">{data.total}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Tore erzielt</span>
                    <span className="font-medium text-green-400">{data.goals}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Tore kassiert</span>
                    <span className="font-medium text-red-400">{data.conceded}</span>
                  </div>
                  <div className="border-t border-gray-700 pt-1.5 flex justify-between gap-2 text-gray-500">
                    <span className="text-green-400">{data.won}× gewonnen</span>
                    <span>{data.neutral}× neutral</span>
                    <span className="text-red-400">{data.lost}× verloren</span>
                  </div>
                  {data.total > 0 && (
                    <div className="flex justify-between text-gray-400">
                      <span>Gewinnquote</span>
                      <span className={data.won / data.total >= 0.5 ? 'text-green-400' : 'text-red-400'}>
                        {((data.won / data.total) * 100).toFixed(0)}% ({data.won}/{data.total})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gegner-Vergleich */}
      {opponents.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-5">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide mb-3">Gegner-Vergleich</h2>
          <div className="space-y-0">
            {opponents.map((o) => (
              <div
                key={o.name}
                className="flex items-start gap-3 py-2 border-b border-gray-700 last:border-0 text-sm"
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
                <span className="flex-1 truncate text-gray-300">{o.name}</span>
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
          <p className="text-xs text-gray-600 mt-2">Ergebnisse klickbar</p>
        </div>
      )}

      {/* Best wins */}
      {wins.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-5">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide mb-3">Größte Siege</h2>
          <div className="space-y-2">
            {wins.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-sm">
                <span className="text-green-400 font-bold w-10 text-right shrink-0">
                  +{r.own - r.opp}
                </span>
                <span className="flex-1 truncate text-gray-300">{r.opponent}</span>
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
        <div className="bg-gray-800 rounded-lg p-5">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide mb-3">Höchste Niederlagen</h2>
          <div className="space-y-2">
            {losses.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-sm">
                <span className="text-red-400 font-bold w-10 text-right shrink-0">
                  {r.own - r.opp}
                </span>
                <span className="flex-1 truncate text-gray-300">{r.opponent}</span>
                <span className="text-gray-400 font-medium whitespace-nowrap">
                  {r.own}:{r.opp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comebacks */}
      {comebacks.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-5">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide mb-1">Comeback-Spiele</h2>
          <p className="text-xs text-gray-500 mb-4">Spiele wo Wolf zurücklag und nicht verlor</p>
          <div className="space-y-2">
            {comebacks.map((c) => (
              <Link
                key={c.id}
                to={`/matches/${c.id}`}
                className="flex items-center gap-3 text-sm hover:opacity-80"
              >
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    c.result === 'win'
                      ? 'bg-green-900/50 text-green-400'
                      : 'bg-yellow-900/50 text-yellow-400'
                  }`}
                >
                  {c.result === 'win' ? 'Sieg' : 'Unent.'}
                </span>
                <span className="text-red-400 font-medium shrink-0 w-8 text-center">
                  -{c.deficit}
                </span>
                <span className="flex-1 truncate text-gray-300">{c.opponent}</span>
                <span className="text-gray-400 font-medium whitespace-nowrap">
                  {c.finalOwn}:{c.finalOpp}
                </span>
              </Link>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">Klickbar · Zahl = max. Rückstand</p>
        </div>
      )}
    </div>
  );
}
