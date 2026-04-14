import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import LeadTracker from '../components/LeadTracker';
import MomentumChart from '../components/MomentumChart';

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

const EVENT_LABELS = {
  Goal: 'Tor',
  SevenMeterGoal: '7m Tor',
  SevenMeterMissed: '7m daneben',
  TwoMinutePenalty: '2 Min',
  Warning: 'Gelb',
  Timeout: 'Auszeit',
  Disqualification: 'Rot',
  StopPeriod: '',
};

const EVENT_COLORS = {
  Goal: 'text-green-400',
  SevenMeterGoal: 'text-green-400',
  SevenMeterMissed: 'text-red-400',
  TwoMinutePenalty: 'text-yellow-400',
  Warning: 'text-yellow-300',
  Timeout: 'text-blue-400',
  Disqualification: 'text-red-500',
  StopPeriod: 'text-gray-500',
};

// --- Analysis helpers ---

function detectRuns(events, minLength = 3) {
  const goals = events
    .filter((e) => ['Goal', 'SevenMeterGoal'].includes(e.type) && e.score_home != null)
    .sort((a, b) => (a.elapsed_seconds || 0) - (b.elapsed_seconds || 0));

  if (goals.length === 0) return [];

  const runs = [];
  let runTeam = goals[0].team;
  let runGoals = [goals[0]];

  const flush = () => {
    if (runGoals.length >= minLength) {
      const first = runGoals[0];
      const last = runGoals[runGoals.length - 1];
      const durationMin = Math.round(
        ((last.elapsed_seconds || 0) - (first.elapsed_seconds || 0)) / 60
      );
      runs.push({
        team: runTeam,
        goals: runGoals.length,
        startTime: first.time,
        endTime: last.time,
        durationMin,
        scoreStart: `${first.score_home}:${first.score_away}`,
        scoreEnd: `${last.score_home}:${last.score_away}`,
      });
    }
  };

  for (let i = 1; i < goals.length; i++) {
    const g = goals[i];
    if (g.team === runTeam) {
      runGoals.push(g);
    } else {
      flush();
      runTeam = g.team;
      runGoals = [g];
    }
  }
  flush();

  return runs.sort((a, b) => b.goals - a.goals);
}

function getHalftimeFromEvents(events) {
  const stops = events
    .filter((e) => e.type === 'StopPeriod' && e.score_home != null)
    .sort((a, b) => (a.elapsed_seconds || 0) - (b.elapsed_seconds || 0));
  if (stops.length === 0) return null;
  return { home: stops[0].score_home, away: stops[0].score_away };
}

function analyzeTimeouts(events) {
  const timeouts = events.filter((e) => e.type === 'Timeout');
  const sorted = [...events]
    .filter((e) => e.elapsed_seconds != null)
    .sort((a, b) => (a.elapsed_seconds || 0) - (b.elapsed_seconds || 0) || a.event_id - b.event_id);
  const goals = sorted.filter((e) => ['Goal', 'SevenMeterGoal'].includes(e.type) && e.score_home != null);

  return timeouts.map((t, idx) => {
    const start = t.elapsed_seconds || 0;
    // Cap window at end of current period (first half = 1800s, second half = 3600s)
    const periodEnd = start < 1800 ? 1800 : 3600;
    const maxWindowEnd = start + 240; // 4 min

    // Check if another timeout occurs before the 4-min window ends
    const nextTimeout = timeouts.find(
      (ot, i) => i !== idx && (ot.elapsed_seconds || 0) > start && (ot.elapsed_seconds || 0) < maxWindowEnd
    );
    const nextTimeoutEnd = nextTimeout ? (nextTimeout.elapsed_seconds || 0) : Infinity;

    const windowEnd = Math.min(maxWindowEnd, periodEnd, nextTimeoutEnd);
    const windowSeconds = windowEnd - start;
    const cutShort = windowEnd < maxWindowEnd;
    let cutReason = null;
    if (cutShort) {
      if (nextTimeoutEnd <= periodEnd && nextTimeoutEnd < maxWindowEnd) cutReason = 'auszeit';
      else if (periodEnd === 1800) cutReason = 'halbzeit';
      else cutReason = 'spielende';
    }

    const after = goals.filter(
      (g) => (g.elapsed_seconds || 0) > start && (g.elapsed_seconds || 0) <= windowEnd
    );
    const forGoals = after.filter((g) => g.team === t.team).length;
    const againstGoals = after.filter((g) => g.team !== t.team).length;

    // First event of any type directly after the timeout (within same period)
    const nextEvent = sorted.find(
      (e) => (e.elapsed_seconds || 0) > start && (e.elapsed_seconds || 0) <= periodEnd && e.type !== 'Timeout'
    );

    return { time: t.time, team: t.team, forGoals, againstGoals, nextEvent, windowSeconds, cutShort, cutReason };
  });
}

function analyzePenaltySessions(events, isHomeGame) {
  const wolfTeam = isHomeGame === 1 ? 'Home' : 'Away';
  const oppTeam = isHomeGame === 1 ? 'Away' : 'Home';

  const penalties = events
    .filter((e) => e.type === 'TwoMinutePenalty' && e.elapsed_seconds != null)
    .sort((a, b) => a.elapsed_seconds - b.elapsed_seconds);

  const goals = events.filter(
    (e) => ['Goal', 'SevenMeterGoal'].includes(e.type) && e.elapsed_seconds != null
  );

  return penalties.map((pen) => {
    const start = pen.elapsed_seconds;
    const end = start + 120;
    const wolfInUnterzahl = pen.team === wolfTeam;

    // Check if the opposing team also gets penalized during this window
    // (→ Gleichzahl wieder) or same team gets another penalty (→ doppelte Unterzahl)
    const concurrent = penalties.filter(
      (p) => p !== pen && p.elapsed_seconds > start && p.elapsed_seconds < end
    );
    const equalizer = concurrent.find((p) => p.team !== pen.team); // other team also penalized
    const doubler = concurrent.find((p) => p.team === pen.team);   // same team penalized again

    const windowGoals = goals.filter(
      (g) => g.elapsed_seconds > start && g.elapsed_seconds <= end
    );
    const wolfGoals = windowGoals.filter((g) => g.team === wolfTeam).length;
    const oppGoals = windowGoals.filter((g) => g.team === oppTeam).length;
    const net = wolfGoals - oppGoals;

    return {
      time: pen.time,
      playerName: pen.player_name,
      wolfInUnterzahl,
      wolfGoals,
      oppGoals,
      net,
      equalizer: equalizer ? equalizer.time : null,
      doubler: doubler ? doubler.time : null,
    };
  });
}

function buildPlayerStats(events, isHomeGame) {
  const wolfTeam = isHomeGame === 1 ? 'Home' : 'Away';
  const map = {};

  for (const e of events) {
    if (e.team !== wolfTeam || !e.player_name) continue;
    const p = map[e.player_name] || {
      name: e.player_name,
      number: e.player_number,
      goals: 0,
      sevenMeter: 0,
      sevenMeterMissed: 0,
      twoMin: 0,
      yellow: 0,
      red: 0,
    };
    if (e.type === 'Goal') p.goals++;
    if (e.type === 'SevenMeterGoal') { p.goals++; p.sevenMeter++; }
    if (e.type === 'SevenMeterMissed') p.sevenMeterMissed++;
    if (e.type === 'TwoMinutePenalty') p.twoMin++;
    if (e.type === 'Warning') p.yellow++;
    if (e.type === 'Disqualification') p.red++;
    map[e.player_name] = p;
  }

  return Object.values(map).sort(
    (a, b) => b.goals - a.goals || a.name.localeCompare(b.name)
  );
}

// --- Tab components ---

function TabSpieldverlauf({ events, homeTeamName, awayTeamName }) {
  const sortedEvents = [...events].sort(
    (a, b) => (a.elapsed_seconds || 0) - (b.elapsed_seconds || 0) || a.event_id - b.event_id
  );

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg p-4">
        <LeadTracker
          events={events}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
        />
      </div>
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-base font-semibold mb-3">Ereignisse</h2>
        {/* Column headers */}
        <div className="grid grid-cols-[44px_1fr_72px_1fr] text-xs text-gray-600 pb-2 mb-0.5 border-b border-gray-700">
          <div />
          <div className="text-right pr-3 truncate">{homeTeamName}</div>
          <div />
          <div className="text-left pl-3 truncate">{awayTeamName}</div>
        </div>
        {sortedEvents.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Keine Events vorhanden</p>
        ) : (
          <div>
            {(() => {
              let stopPeriodCount = 0;
              let lastStopScore = null;
              return sortedEvents.map((evt) => {
              if (evt.type === 'StopPeriod') {
                const scoreKey = `${evt.score_home}:${evt.score_away}`;
                if (stopPeriodCount > 0 && scoreKey === lastStopScore) return null; // duplicate
                const isFirst = stopPeriodCount === 0;
                stopPeriodCount++;
                lastStopScore = scoreKey;
                const dividerLabel = isFirst ? 'Halbzeit' : 'Endstand';
                return (
                  <div key={evt.event_id} className="flex items-center gap-2 py-2 my-0.5">
                    <div className="flex-1 h-px bg-gray-700" />
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {dividerLabel}{evt.score_home != null ? ` · ${evt.score_home}:${evt.score_away}` : ''}
                    </span>
                    <div className="flex-1 h-px bg-gray-700" />
                  </div>
                );
              }

              const isHome = evt.team === 'Home';
              const isGoal = ['Goal', 'SevenMeterGoal'].includes(evt.type);
              const color = EVENT_COLORS[evt.type] || 'text-gray-400';
              const label = EVENT_LABELS[evt.type] || evt.type;

              return (
                <div
                  key={evt.event_id}
                  className="grid grid-cols-[44px_1fr_72px_1fr] items-center py-1.5 border-b border-gray-700/50 last:border-0 text-xs"
                >
                  {/* Time */}
                  <div className="text-gray-500 font-mono">{evt.time}</div>

                  {/* Home event */}
                  <div className="text-right pr-3">
                    {isHome && (
                      <>
                        <span className={`font-medium ${color}`}>{label}</span>
                        {evt.player_name && (
                          <span className="text-gray-300 ml-1">{evt.player_name}</span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Score */}
                  <div className="text-center">
                    {isGoal && evt.score_home != null && (
                      <span className="font-bold text-sm text-white">
                        {evt.score_home}:{evt.score_away}
                      </span>
                    )}
                  </div>

                  {/* Away event */}
                  <div className="text-left pl-3">
                    {!isHome && evt.team && (
                      <>
                        <span className={`font-medium ${color}`}>{label}</span>
                        {evt.player_name && (
                          <span className="text-gray-300 ml-1">{evt.player_name}</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function TabAnalyse({ events, match }) {
  const runs = detectRuns(events);
  const halftime = getHalftimeFromEvents(events);
  const timeouts = analyzeTimeouts(events);
  const penaltySessions = analyzePenaltySessions(events, match.is_home_game);
  const wolfTeam = match.is_home_game ? 'Home' : 'Away';

  const finalHome = match.home_goals ?? 0;
  const finalAway = match.away_goals ?? 0;
  const htHome = halftime?.home ?? 0;
  const htAway = halftime?.away ?? 0;
  const h2Home = finalHome - htHome;
  const h2Away = finalAway - htAway;

  return (
    <div className="space-y-4">
      {/* Momentum */}
      <div className="bg-gray-800 rounded-lg p-4">
        <MomentumChart
          events={events}
          homeTeamName={match.home_team_name}
          awayTeamName={match.away_team_name}
        />
      </div>

      {/* Halftime comparison */}
      {halftime && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-base font-semibold mb-3">Halbzeit-Vergleich</h2>
          <div className="grid grid-cols-3 text-sm text-center">
            <div className="text-gray-400 pb-2"></div>
            <div className="font-medium text-gray-300 pb-2">1. Halbzeit</div>
            <div className="font-medium text-gray-300 pb-2">2. Halbzeit</div>

            <div className="text-left text-gray-400 py-2 border-t border-gray-700">
              {match.home_team_name.split(' ').slice(0, 2).join(' ')}
            </div>
            <div className={`py-2 border-t border-gray-700 font-bold ${htHome > htAway ? 'text-green-400' : htHome < htAway ? 'text-red-400' : 'text-yellow-400'}`}>
              {htHome}
            </div>
            <div className={`py-2 border-t border-gray-700 font-bold ${h2Home > h2Away ? 'text-green-400' : h2Home < h2Away ? 'text-red-400' : 'text-yellow-400'}`}>
              {h2Home}
            </div>

            <div className="text-left text-gray-400 py-2 border-t border-gray-700">
              {match.away_team_name.split(' ').slice(0, 2).join(' ')}
            </div>
            <div className={`py-2 border-t border-gray-700 font-bold ${htAway > htHome ? 'text-green-400' : htAway < htHome ? 'text-red-400' : 'text-yellow-400'}`}>
              {htAway}
            </div>
            <div className={`py-2 border-t border-gray-700 font-bold ${h2Away > h2Home ? 'text-green-400' : h2Away < h2Home ? 'text-red-400' : 'text-yellow-400'}`}>
              {h2Away}
            </div>
          </div>
        </div>
      )}

      {/* Run detection */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-base font-semibold mb-3">Lauf-Erkennung</h2>
        {runs.length === 0 ? (
          <p className="text-gray-500 text-sm">Keine Läufe von 3+ Toren erkannt.</p>
        ) : (
          <div className="space-y-2">
            {runs.map((r, i) => {
              const isWolf = r.team === wolfTeam;
              return (
                <div
                  key={i}
                  className={`rounded p-3 text-sm ${isWolf ? 'bg-green-900/30 border border-green-800/50' : 'bg-red-900/30 border border-red-800/50'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold ${isWolf ? 'text-green-400' : 'text-red-400'}`}>
                      {r.goals}:0 Lauf
                    </span>
                    <span className="text-gray-400 text-xs">
                      {r.startTime} – {r.endTime}
                      {r.durationMin > 0 && ` (${r.durationMin} Min.)`}
                    </span>
                  </div>
                  <div className="text-gray-400 text-xs">
                    {isWolf
                      ? match.home_team_name === 'TSV Wolfschlugen' || match.is_home_game
                        ? 'TSV Wolfschlugen'
                        : 'TSV Wolfschlugen'
                      : r.team === 'Home'
                      ? match.home_team_name
                      : match.away_team_name}
                    {' · '}
                    Stand: {r.scoreStart} → {r.scoreEnd}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Timeout effectiveness */}
      {/* Powerplay / Shorthanded */}
      {penaltySessions.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-base font-semibold mb-1">Über-/Unterzahl</h2>
          <p className="text-xs text-gray-500 mb-3">Tore in den 2 Minuten nach einer Strafe</p>

          {/* Summary cards */}
          {(() => {
            const ueber = penaltySessions.filter((s) => !s.wolfInUnterzahl);
            const unter = penaltySessions.filter((s) => s.wolfInUnterzahl);
            const summary = (list) => ({
              total: list.length,
              goals: list.reduce((s, p) => s + p.wolfGoals, 0),
              conceded: list.reduce((s, p) => s + p.oppGoals, 0),
              won: list.filter((p) => p.net > 0).length,
              neutral: list.filter((p) => p.net === 0).length,
              lost: list.filter((p) => p.net < 0).length,
            });
            return (
              <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                {[
                  { label: 'Überzahl', s: summary(ueber), color: 'text-green-400', bg: 'bg-green-900/20', border: 'border-green-800/40' },
                  { label: 'Unterzahl', s: summary(unter), color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-800/40' },
                ].map(({ label, s, color, bg, border }) => (
                  <div key={label} className={`rounded-lg p-3 border ${bg} ${border}`}>
                    <div className={`font-semibold mb-2 ${color}`}>{label}</div>
                    <div className="space-y-1 text-gray-400">
                      <div className="flex justify-between">
                        <span>Situationen</span>
                        <span className="font-medium text-white">{s.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tore erzielt</span>
                        <span className="font-medium text-green-400">{s.goals}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tore kassiert</span>
                        <span className="font-medium text-red-400">{s.conceded}</span>
                      </div>
                      <div className="border-t border-gray-700 pt-1 flex justify-between gap-1 text-gray-500">
                        <span className="text-green-400">{s.won}× gew.</span>
                        <span>{s.neutral}× neut.</span>
                        <span className="text-red-400">{s.lost}× verl.</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="space-y-1">
            {penaltySessions.map((s, i) => {
              const isUeber = !s.wolfInUnterzahl;
              const netColor =
                s.net > 0 ? 'text-green-400' : s.net < 0 ? 'text-red-400' : 'text-gray-400';
              return (
                <div
                  key={i}
                  className="flex items-start gap-2 py-2 border-b border-gray-700 last:border-0 text-sm"
                >
                  <span className="text-gray-500 font-mono w-10 text-right shrink-0">
                    {s.time}
                  </span>
                  <span
                    className={`shrink-0 font-medium text-xs px-1.5 py-0.5 rounded ${
                      isUeber
                        ? 'bg-green-900/40 text-green-400'
                        : 'bg-red-900/40 text-red-400'
                    }`}
                  >
                    {isUeber ? 'Überzahl' : 'Unterzahl'}
                  </span>
                  <span className="flex-1 min-w-0 text-gray-400 text-xs">
                    {s.playerName && (
                      <span className="text-gray-300">{s.playerName} · </span>
                    )}
                    {s.wolfGoals}:{s.oppGoals} Tore
                    {s.equalizer && (
                      <span className="text-yellow-500 ml-1">
                        · Gleichzahl ab {s.equalizer}
                      </span>
                    )}
                    {s.doubler && (
                      <span className="text-red-500 ml-1">
                        · 2. Strafe ab {s.doubler}
                      </span>
                    )}
                  </span>
                  <span className={`font-bold shrink-0 ${netColor}`}>
                    {s.net > 0 ? `+${s.net}` : s.net}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {timeouts.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-base font-semibold mb-3">Auszeit-Effektivität</h2>
          <div className="space-y-2">
            {timeouts.map((t, i) => {
              const isWolf = t.team === wolfTeam;
              // Always express goals from Wolf's perspective
              const wolfGoalsAfter = isWolf ? t.forGoals : t.againstGoals;
              const oppGoalsAfter = isWolf ? t.againstGoals : t.forGoals;
              const positive = wolfGoalsAfter > oppGoalsAfter;
              const neutral = wolfGoalsAfter === oppGoalsAfter;
              const ne = t.nextEvent;
              const nextIsWolf = ne && ne.team === wolfTeam;
              const nextLabel = ne ? (EVENT_LABELS[ne.type] || ne.type) : null;
              const nextTeamName = ne
                ? (nextIsWolf ? 'TSV Wolfschlugen' : ne.team === 'Home' ? match.home_team_name : match.away_team_name)
                : null;
              return (
                <div key={i} className="py-2 border-b border-gray-700 last:border-0 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 font-mono w-10 text-right shrink-0">{t.time}</span>
                    <span className="text-blue-400 shrink-0">
                      Auszeit {isWolf ? 'TSV Wolfschlugen' : t.team === 'Home' ? match.home_team_name : match.away_team_name}
                    </span>
                    <span className="flex-1" />
                    <div className="text-right">
                      <span className={`text-xs font-medium ${positive ? 'text-green-400' : neutral ? 'text-gray-400' : 'text-red-400'}`}>
                        {t.cutShort
                          ? `${Math.floor(t.windowSeconds / 60)}:${String(t.windowSeconds % 60).padStart(2, '0')} Min: `
                          : '4 Min danach: '
                        }{wolfGoalsAfter}:{oppGoalsAfter}
                      </span>
                      {t.cutShort && t.cutReason && (
                        <div className="text-xs text-gray-600">
                          {t.cutReason === 'halbzeit' && 'bis Halbzeit'}
                          {t.cutReason === 'spielende' && 'bis Spielende'}
                          {t.cutReason === 'auszeit' && 'bis nächste Auszeit'}
                        </div>
                      )}
                    </div>
                  </div>
                  {ne && (
                    <div className="flex items-center gap-3 mt-0.5 ml-[52px]">
                      <span className="text-xs text-gray-500">
                        Nächste Aktion: {nextLabel}
                        {' '}{nextTeamName}
                        {ne.time && <span className="text-gray-600 ml-1">({ne.time})</span>}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Tore Wolf:Gegner · Fenster 4 Min, begrenzt auf Halbzeitende
          </p>
        </div>
      )}
    </div>
  );
}

function TabSpieler({ events, match }) {
  const players = buildPlayerStats(events, match.is_home_game);

  if (players.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 text-gray-500 text-center py-8">
        Keine Spielerdaten verfügbar.
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400 text-xs">
            <th className="text-left px-4 py-3">Spieler</th>
            <th className="px-2 py-3 text-center w-10" title="Tore">T</th>
            <th className="px-2 py-3 text-center w-10" title="7-Meter Tore">7m</th>
            <th className="px-2 py-3 text-center w-10" title="7-Meter daneben">7✗</th>
            <th className="px-2 py-3 text-center w-10" title="2-Minuten">2'</th>
            <th className="px-2 py-3 text-center w-10" title="Gelbe Karte">G</th>
            <th className="px-2 py-3 text-center w-10" title="Rote Karte">R</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.name} className="border-b border-gray-700 last:border-0 hover:bg-gray-750">
              <td className="px-4 py-2.5">
                {p.name}
                {p.number && (
                  <span className="text-gray-500 ml-1 text-xs">({p.number})</span>
                )}
              </td>
              <td className="px-2 py-2.5 text-center font-bold text-green-400">
                {p.goals > 0 ? p.goals : <span className="text-gray-600">–</span>}
              </td>
              <td className="px-2 py-2.5 text-center text-gray-300">
                {p.sevenMeter > 0 ? p.sevenMeter : <span className="text-gray-600">–</span>}
              </td>
              <td className="px-2 py-2.5 text-center text-red-400">
                {p.sevenMeterMissed > 0 ? p.sevenMeterMissed : <span className="text-gray-600">–</span>}
              </td>
              <td className="px-2 py-2.5 text-center text-yellow-400">
                {p.twoMin > 0 ? p.twoMin : <span className="text-gray-600">–</span>}
              </td>
              <td className="px-2 py-2.5 text-center text-yellow-300">
                {p.yellow > 0 ? p.yellow : <span className="text-gray-600">–</span>}
              </td>
              <td className="px-2 py-2.5 text-center text-red-500">
                {p.red > 0 ? p.red : <span className="text-gray-600">–</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Main component ---

const TABS = [
  { id: 'verlauf', label: 'Spielverlauf' },
  { id: 'analyse', label: 'Analyse' },
  { id: 'spieler', label: 'Spieler' },
];

export default function MatchDetail() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('verlauf');

  useEffect(() => {
    fetch(`/api/matches/${id}`)
      .then((r) => r.json())
      .then(setMatch)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-lg text-gray-400">Laden...</div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-gray-400">Spiel nicht gefunden.</p>
        <Link to="/matches" className="text-gray-400 underline mt-2 inline-block">
          Zurück
        </Link>
      </div>
    );
  }

  const events = match.events || [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link to="/matches" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Alle Spiele
      </Link>

      {/* Score header */}
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="text-xs text-gray-500 text-center mb-3">
          {formatDate(match.starts_at)} · {formatTime(match.starts_at)}
          {match.venue_name && ` · ${match.venue_name}`}
          {match.venue_city && `, ${match.venue_city}`}
        </div>
        <div className="flex items-center justify-center gap-4">
          <div className="text-right flex-1">
            <div className="font-bold text-lg">{match.home_team_name}</div>
          </div>
          <div className="text-3xl font-bold px-4">
            {match.home_goals} : {match.away_goals}
          </div>
          <div className="text-left flex-1">
            <div className="font-bold text-lg">{match.away_team_name}</div>
          </div>
        </div>
        {match.home_goals_half != null && (
          <div className="text-center text-sm text-gray-500 mt-1">
            Halbzeit: {match.home_goals_half} : {match.away_goals_half}
          </div>
        )}
        {match.attendance && (
          <div className="text-center text-xs text-gray-600 mt-2">
            {match.attendance} Zuschauer
            {match.referee_info && ` · SR: ${match.referee_info}`}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-white text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'verlauf' && (
        <TabSpieldverlauf
          events={events}
          homeTeamName={match.home_team_name}
          awayTeamName={match.away_team_name}
        />
      )}
      {activeTab === 'analyse' && <TabAnalyse events={events} match={match} />}
      {activeTab === 'spieler' && <TabSpieler events={events} match={match} />}
    </div>
  );
}
