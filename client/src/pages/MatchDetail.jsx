import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTeam } from '../TeamContext';
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

function analyzePenaltySessions(events, myTeam) {
  const oppTeam = myTeam === 'Home' ? 'Away' : 'Home';

  const penalties = events
    .filter((e) => e.type === 'TwoMinutePenalty' && e.elapsed_seconds != null)
    .sort((a, b) => a.elapsed_seconds - b.elapsed_seconds);

  const goals = events.filter(
    (e) => ['Goal', 'SevenMeterGoal'].includes(e.type) && e.elapsed_seconds != null
  );

  return penalties.map((pen) => {
    const start = pen.elapsed_seconds;
    const end = start + 120;
    const teamInUnterzahl = pen.team === myTeam;

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
    const teamGoals = windowGoals.filter((g) => g.team === myTeam).length;
    const oppGoals = windowGoals.filter((g) => g.team === oppTeam).length;
    const net = teamGoals - oppGoals;

    return {
      time: pen.time,
      playerName: pen.player_name,
      teamInUnterzahl,
      teamGoals,
      oppGoals,
      net,
      equalizer: equalizer ? equalizer.time : null,
      doubler: doubler ? doubler.time : null,
    };
  });
}

function detectMatchPhaseExtremes(events, myTeam) {
  const goals = events
    .filter((e) => ['Goal', 'SevenMeterGoal'].includes(e.type) && e.elapsed_seconds != null)
    .sort((a, b) => a.elapsed_seconds - b.elapsed_seconds);
  if (goals.length < 2) return null;

  // Build sequence: +1 for own goal, -1 for opponent goal
  const seq = goals.map((e) => ({
    value: e.team === myTeam ? 1 : -1,
    minute: Math.ceil(e.elapsed_seconds / 60),
  }));

  // Kadane's algorithm for max and min subarray
  function kadane(arr, findMax) {
    let bestSum = findMax ? -Infinity : Infinity;
    let bestStart = 0, bestEnd = 0;
    let curSum = 0, curStart = 0;
    for (let i = 0; i < arr.length; i++) {
      curSum += arr[i].value;
      const better = findMax ? curSum > bestSum : curSum < bestSum;
      if (better) {
        bestSum = curSum;
        bestStart = curStart;
        bestEnd = i;
      }
      const resetBetter = findMax ? curSum < 0 : curSum > 0;
      if (resetBetter) { curSum = 0; curStart = i + 1; }
    }
    if (!isFinite(bestSum)) return null;
    const subSeq = arr.slice(bestStart, bestEnd + 1);
    const own = subSeq.filter((s) => s.value === 1).length;
    const opp = subSeq.filter((s) => s.value === -1).length;
    return {
      startMinute: arr[bestStart].minute,
      endMinute: arr[bestEnd].minute,
      teamGoals: own,
      oppGoals: opp,
      net: bestSum,
    };
  }

  const power = kadane(seq, true);
  const death = kadane(seq, false);

  return {
    powerPhase: power && power.net > 0 ? power : null,
    deathPhase: death && death.net < 0 ? death : null,
  };
}

function buildPlayerStats(events, myTeam) {
  const map = {};

  for (const e of events) {
    if (e.team !== myTeam || !e.player_name) continue;
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
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm dark:shadow-none">
        <LeadTracker
          events={events}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
        />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm dark:shadow-none">
        <h2 className="text-base font-semibold mb-3">Ereignisse</h2>
        {/* Column headers */}
        <div className="grid grid-cols-[44px_1fr_72px_1fr] text-xs text-gray-600 pb-2 mb-0.5 border-b border-gray-100 dark:border-gray-700">
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
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {dividerLabel}{evt.score_home != null ? ` · ${evt.score_home}:${evt.score_away}` : ''}
                    </span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
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
                  className="grid grid-cols-[44px_1fr_72px_1fr] items-center py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0 text-xs"
                >
                  {/* Time */}
                  <div className="text-gray-400 dark:text-gray-500 font-mono">{evt.time}</div>

                  {/* Home event */}
                  <div className="text-right pr-3">
                    {isHome && (
                      <>
                        <span className={`font-medium ${color}`}>{label}</span>
                        {evt.player_name && (
                          <span className="text-gray-700 dark:text-gray-300 ml-1">{evt.player_name}</span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Score */}
                  <div className="text-center">
                    {isGoal && evt.score_home != null && (
                      <span className="font-bold text-sm text-gray-900 dark:text-white">
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
                          <span className="text-gray-700 dark:text-gray-300 ml-1">{evt.player_name}</span>
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

function TabAnalyse({ events, match, teamId, teamName }) {
  const myTeam = match.home_team_id === teamId ? 'Home' : 'Away';
  const runs = detectRuns(events);
  const halftime = getHalftimeFromEvents(events);
  const timeouts = analyzeTimeouts(events);
  const penaltySessions = analyzePenaltySessions(events, myTeam);
  const phaseExtremes = detectMatchPhaseExtremes(events, myTeam);

  const finalHome = match.home_goals ?? 0;
  const finalAway = match.away_goals ?? 0;
  const htHome = halftime?.home ?? 0;
  const htAway = halftime?.away ?? 0;
  const h2Home = finalHome - htHome;
  const h2Away = finalAway - htAway;

  return (
    <div className="space-y-4">
      {/* Momentum */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm dark:shadow-none">
        <MomentumChart
          events={events}
          homeTeamName={match.home_team_name}
          awayTeamName={match.away_team_name}
        />
      </div>

      {/* Power / Death Phase */}
      {phaseExtremes && (phaseExtremes.powerPhase || phaseExtremes.deathPhase) && (
        <div className="grid grid-cols-2 gap-3">
          {phaseExtremes.powerPhase && (
            <div className="rounded-lg p-3 border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40">
              <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">
                Stärkste Phase
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {phaseExtremes.powerPhase.startMinute}. – {phaseExtremes.powerPhase.endMinute}. Minute
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
            <div className="rounded-lg p-3 border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40">
              <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">
                Schwächste Phase
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {phaseExtremes.deathPhase.startMinute}. – {phaseExtremes.deathPhase.endMinute}. Minute
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

      {/* Halftime comparison */}
      {halftime && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm dark:shadow-none">
          <h2 className="text-base font-semibold mb-3">Halbzeit-Vergleich</h2>
          <div className="grid grid-cols-3 text-sm text-center">
            <div className="text-gray-400 pb-2"></div>
            <div className="font-medium text-gray-300 pb-2">1. Halbzeit</div>
            <div className="font-medium text-gray-300 pb-2">2. Halbzeit</div>

            <div className="text-left text-gray-500 dark:text-gray-400 py-2 border-t border-gray-100 dark:border-gray-700">
              {match.home_team_name.split(' ').slice(0, 2).join(' ')}
            </div>
            <div className={`py-2 border-t border-gray-100 dark:border-gray-700 font-bold ${htHome > htAway ? 'text-green-400' : htHome < htAway ? 'text-red-400' : 'text-yellow-400'}`}>
              {htHome}
            </div>
            <div className={`py-2 border-t border-gray-100 dark:border-gray-700 font-bold ${h2Home > h2Away ? 'text-green-400' : h2Home < h2Away ? 'text-red-400' : 'text-yellow-400'}`}>
              {h2Home}
            </div>

            <div className="text-left text-gray-500 dark:text-gray-400 py-2 border-t border-gray-100 dark:border-gray-700">
              {match.away_team_name.split(' ').slice(0, 2).join(' ')}
            </div>
            <div className={`py-2 border-t border-gray-100 dark:border-gray-700 font-bold ${htAway > htHome ? 'text-green-400' : htAway < htHome ? 'text-red-400' : 'text-yellow-400'}`}>
              {htAway}
            </div>
            <div className={`py-2 border-t border-gray-100 dark:border-gray-700 font-bold ${h2Away > h2Home ? 'text-green-400' : h2Away < h2Home ? 'text-red-400' : 'text-yellow-400'}`}>
              {h2Away}
            </div>
          </div>
        </div>
      )}

      {/* Run detection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm dark:shadow-none">
        <h2 className="text-base font-semibold mb-3">Lauf-Erkennung</h2>
        {runs.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-500 text-sm">Keine Läufe von 3+ Toren erkannt.</p>
        ) : (
          <div className="space-y-2">
            {runs.map((r, i) => {
              const isMyTeam = r.team === myTeam;
              return (
                <div
                  key={i}
                  className={`rounded p-3 text-sm ${isMyTeam ? 'bg-green-50 border border-green-200 dark:bg-green-900/30 dark:border-green-800/50' : 'bg-red-50 border border-red-200 dark:bg-red-900/30 dark:border-red-800/50'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold ${isMyTeam ? 'text-green-400' : 'text-red-400'}`}>
                      {r.goals}:0 Lauf
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      {r.startTime} – {r.endTime}
                      {r.durationMin > 0 && ` (${r.durationMin} Min.)`}
                    </span>
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs">
                    {r.team === 'Home'
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
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm dark:shadow-none">
          <h2 className="text-base font-semibold mb-1">Über-/Unterzahl</h2>
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">Tore in den 2 Minuten nach einer Strafe</p>

          {/* Summary cards */}
          {(() => {
            const ueber = penaltySessions.filter((s) => !s.teamInUnterzahl);
            const unter = penaltySessions.filter((s) => s.teamInUnterzahl);
            const summary = (list) => ({
              total: list.length,
              goals: list.reduce((s, p) => s + p.teamGoals, 0),
              conceded: list.reduce((s, p) => s + p.oppGoals, 0),
              won: list.filter((p) => p.net > 0).length,
              neutral: list.filter((p) => p.net === 0).length,
              lost: list.filter((p) => p.net < 0).length,
            });
            return (
              <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                {[
                  { label: 'Überzahl', s: summary(ueber), color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800/40' },
                  { label: 'Unterzahl', s: summary(unter), color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800/40' },
                ].map(({ label, s, color, bg, border }) => (
                  <div key={label} className={`rounded-lg p-3 border ${bg} ${border}`}>
                    <div className={`font-semibold mb-2 ${color}`}>{label}</div>
                    <div className="space-y-1 text-gray-500 dark:text-gray-400">
                      <div className="flex justify-between">
                        <span>Situationen</span>
                        <span className="font-medium text-gray-900 dark:text-white">{s.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tore erzielt</span>
                        <span className="font-medium text-green-400">{s.goals}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tore kassiert</span>
                        <span className="font-medium text-red-400">{s.conceded}</span>
                      </div>
                      <div className="border-t border-gray-100 dark:border-gray-700 pt-1 flex justify-between gap-1 text-gray-500">
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
              const isUeber = !s.teamInUnterzahl;
              const netColor =
                s.net > 0 ? 'text-green-400' : s.net < 0 ? 'text-red-400' : 'text-gray-400';
              return (
                <div
                  key={i}
                  className="flex items-start gap-2 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 text-sm"
                >
                  <span className="text-gray-400 dark:text-gray-500 font-mono w-10 text-right shrink-0">
                    {s.time}
                  </span>
                  <span
                    className={`shrink-0 font-medium text-xs px-1.5 py-0.5 rounded ${
                      isUeber
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                    }`}
                  >
                    {isUeber ? 'Überzahl' : 'Unterzahl'}
                  </span>
                  <span className="flex-1 min-w-0 text-gray-500 dark:text-gray-400 text-xs">
                    {s.playerName && (
                      <span className="text-gray-700 dark:text-gray-300">{s.playerName} · </span>
                    )}
                    {s.teamGoals}:{s.oppGoals} Tore
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
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm dark:shadow-none">
          <h2 className="text-base font-semibold mb-3">Auszeit-Effektivität</h2>
          <div className="space-y-2">
            {timeouts.map((t, i) => {
              const isMyTeam = t.team === myTeam;
              // Express goals from own team's perspective
              const teamGoalsAfter = isMyTeam ? t.forGoals : t.againstGoals;
              const oppGoalsAfter = isMyTeam ? t.againstGoals : t.forGoals;
              const positive = teamGoalsAfter > oppGoalsAfter;
              const neutral = teamGoalsAfter === oppGoalsAfter;
              const ne = t.nextEvent;
              const nextIsMyTeam = ne && ne.team === myTeam;
              const nextLabel = ne ? (EVENT_LABELS[ne.type] || ne.type) : null;
              const nextTeamName = ne
                ? (ne.team === 'Home' ? match.home_team_name : match.away_team_name)
                : null;
              return (
                <div key={i} className="py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 dark:text-gray-500 font-mono w-10 text-right shrink-0">{t.time}</span>
                    <span className="text-blue-400 shrink-0">
                      Auszeit {t.team === 'Home' ? match.home_team_name : match.away_team_name}
                    </span>
                    <span className="flex-1" />
                    <div className="text-right">
                      <span className={`text-xs font-medium ${positive ? 'text-green-400' : neutral ? 'text-gray-400' : 'text-red-400'}`}>
                        {t.cutShort
                          ? `${Math.floor(t.windowSeconds / 60)}:${String(t.windowSeconds % 60).padStart(2, '0')} Min: `
                          : '4 Min danach: '
                        }{teamGoalsAfter}:{oppGoalsAfter}
                      </span>
                      {t.cutShort && t.cutReason && (
                        <div className="text-xs text-gray-400 dark:text-gray-600">
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
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
            Tore Eigene:Gegner · Fenster 4 Min, begrenzt auf Halbzeitende
          </p>
        </div>
      )}
    </div>
  );
}

function TabSpieler({ events, match, teamId }) {
  const myTeam = match.home_team_id === teamId ? 'Home' : 'Away';
  const players = buildPlayerStats(events, myTeam);

  if (players.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 text-gray-500 text-center py-8">
        Keine Spielerdaten verfügbar.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm dark:shadow-none">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs">
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
            <tr key={p.name} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-750">
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

// --- Match Preview for upcoming games ---

function MatchPreview({ match, teamId }) {
  const oppTeamId = match.home_team_id === teamId ? match.away_team_id : match.home_team_id;
  const oppName = match.home_team_id === teamId ? match.away_team_name : match.home_team_name;
  const isHome = match.home_team_id === teamId;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = `?teamId=${encodeURIComponent(oppTeamId)}`;
    Promise.all([
      fetch(`/api/matches${q}`).then((r) => r.json()),
      fetch(`/api/stats/form${q}`).then((r) => r.json()),
      fetch(`/api/stats/players${q}`).then((r) => r.json()),
      fetch(`/api/stats/phases/extremes${q}`).then((r) => r.json()),
      fetch(`/api/stats/powerplay${q}`).then((r) => r.json()),
      fetch('/api/standings').then((r) => r.json()),
    ])
      .then(([matches, form, players, extremes, powerplay, standings]) => {
        const finished = matches.filter((m) => m.state === 'Post' && m.home_goals != null);
        let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
        for (const m of finished) {
          const isH = m.home_team_id === oppTeamId;
          const own = isH ? m.home_goals : m.away_goals;
          const opp = isH ? m.away_goals : m.home_goals;
          gf += own; ga += opp;
          if (own > opp) wins++;
          else if (own === opp) draws++;
          else losses++;
        }

        const h2h = finished.filter((m) =>
          (m.home_team_id === oppTeamId && m.away_team_id === teamId) ||
          (m.away_team_id === oppTeamId && m.home_team_id === teamId)
        );

        const standing = standings.find((s) => s.team_id === oppTeamId);

        setData({
          played: finished.length, wins, draws, losses, gf, ga,
          form: form.slice(-5),
          topScorers: players.slice(0, 5),
          extremes,
          powerplay,
          h2h,
          standing,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [oppTeamId, teamId]);

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Gegner-Daten laden...</div>;
  }

  if (!data) {
    return <div className="text-center py-8 text-gray-500">Keine Daten verfügbar.</div>;
  }

  const avgGf = data.played ? (data.gf / data.played).toFixed(1) : '–';
  const avgGa = data.played ? (data.ga / data.played).toFixed(1) : '–';
  const diff = data.gf - data.ga;

  const resultLabel = (r) => r.result === 'win' ? 'S' : r.result === 'draw' ? 'U' : 'N';
  const resultBadge = (r) => r.result === 'win'
    ? 'bg-green-500 text-white'
    : r.result === 'draw'
    ? 'bg-yellow-500 text-white'
    : 'bg-red-500 text-white';

  return (
    <div className="space-y-4">
      <h2 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Gegner-Vorschau: {oppName}
      </h2>

      {/* Standing + Record */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link to={`/teams/${oppTeamId}`} className="font-bold text-lg hover:text-blue-500 dark:hover:text-blue-400">
              {oppName}
            </Link>
            {data.standing && (
              <p className="text-sm text-gray-400 mt-0.5">Platz {data.standing.rank} · {data.standing.points_pos}:{data.standing.points_neg} Pkt</p>
            )}
          </div>
          {data.form.length > 0 && (
            <div className="flex gap-1">
              {data.form.map((d) => (
                <span key={d.matchId} className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${resultBadge(d)}`}>
                  {resultLabel(d)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-3 text-center text-sm">
          <div>
            <div className="text-2xl font-bold">{data.played}</div>
            <div className="text-xs text-gray-500 mt-0.5">Spiele</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-500">{data.wins}</div>
            <div className="text-xs text-gray-500 mt-0.5">Siege</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-500">{data.draws}</div>
            <div className="text-xs text-gray-500 mt-0.5">Remis</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-500">{data.losses}</div>
            <div className="text-xs text-gray-500 mt-0.5">Niederlagen</div>
          </div>
        </div>
        <div className="flex justify-center gap-6 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3 mt-4">
          <span>{avgGf} Tore/Spiel</span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span>{avgGa} Gegentore/Spiel</span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className={diff >= 0 ? 'text-green-500' : 'text-red-500'}>
            {diff >= 0 ? '+' : ''}{diff}
          </span>
        </div>
      </div>

      {/* Power / Death Phase */}
      {data.extremes && (data.extremes.powerPhase || data.extremes.deathPhase) && (
        <div className="grid grid-cols-2 gap-3">
          {data.extremes.powerPhase && (
            <div className="rounded-lg p-3 border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40">
              <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">Stärkste Phase</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {data.extremes.powerPhase.start}. – {data.extremes.powerPhase.end}. Minute
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Eigene Tore</span>
                  <span className="font-medium text-green-400">{data.extremes.powerPhase.teamGoals}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Gegentore</span>
                  <span className="font-medium text-red-400">{data.extremes.powerPhase.oppGoals}</span>
                </div>
                <div className="flex justify-between border-t border-green-200 dark:border-green-800/40 pt-1">
                  <span className="text-gray-600 dark:text-gray-400">Netto</span>
                  <span className="font-bold text-green-400">+{data.extremes.powerPhase.net}</span>
                </div>
              </div>
            </div>
          )}
          {data.extremes.deathPhase && (
            <div className="rounded-lg p-3 border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40">
              <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">Schwächste Phase</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {data.extremes.deathPhase.start}. – {data.extremes.deathPhase.end}. Minute
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Eigene Tore</span>
                  <span className="font-medium text-green-400">{data.extremes.deathPhase.teamGoals}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Gegentore</span>
                  <span className="font-medium text-red-400">{data.extremes.deathPhase.oppGoals}</span>
                </div>
                <div className="flex justify-between border-t border-red-200 dark:border-red-800/40 pt-1">
                  <span className="text-gray-600 dark:text-gray-400">Netto</span>
                  <span className="font-bold text-red-400">{data.extremes.deathPhase.net}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Powerplay summary */}
      {data.powerplay && (data.powerplay.ueberzahl.total > 0 || data.powerplay.unterzahl.total > 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Über-/Unterzahl</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { label: 'In Überzahl', s: data.powerplay.ueberzahl, color: 'text-green-600 dark:text-green-400' },
              { label: 'In Unterzahl', s: data.powerplay.unterzahl, color: 'text-red-600 dark:text-red-400' },
            ].map(({ label, s, color }) => (
              <div key={label} className="space-y-1">
                <div className={`font-semibold mb-1 ${color}`}>{label} ({s.total}x)</div>
                <div className="flex justify-between text-gray-500 dark:text-gray-400">
                  <span>Tore erzielt</span>
                  <span className="font-medium text-green-400">{s.goals}</span>
                </div>
                <div className="flex justify-between text-gray-500 dark:text-gray-400">
                  <span>Tore kassiert</span>
                  <span className="font-medium text-red-400">{s.conceded}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top scorers */}
      {data.topScorers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Top-Torschützen</h3>
          <div className="space-y-2">
            {data.topScorers.map((p, i) => (
              <div key={p.player_name} className="flex items-center gap-3 text-sm">
                <span className="text-xs text-gray-400 w-4 text-right">{i + 1}.</span>
                <span className="flex-1 truncate">{p.player_name}</span>
                <span className="font-bold text-green-400">{p.goals}</span>
                <span className="text-xs text-gray-500 w-14 text-right">({p.games_played} Sp.)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* H2H */}
      {data.h2h.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm dark:shadow-none">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Direkter Vergleich</h3>
          <div className="space-y-2">
            {data.h2h.map((m) => {
              const ownGoals = m.home_team_id === teamId ? m.home_goals : m.away_goals;
              const oppG = m.home_team_id === teamId ? m.away_goals : m.home_goals;
              const won = ownGoals > oppG;
              const drew = ownGoals === oppG;
              return (
                <Link key={m.id} to={`/matches/${m.id}`} className="flex items-center gap-3 hover:opacity-80 text-sm">
                  <span className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center text-white shrink-0 ${
                    won ? 'bg-green-500' : drew ? 'bg-yellow-500' : 'bg-red-500'
                  }`}>
                    {won ? 'S' : drew ? 'U' : 'N'}
                  </span>
                  <span className="text-xs text-gray-400 w-20 shrink-0">
                    {new Date(m.starts_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>
                  <span className="flex-1 truncate text-gray-500">
                    {m.home_team_id === teamId ? 'H' : 'A'}
                  </span>
                  <span className="font-bold whitespace-nowrap">{ownGoals} : {oppG}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-center">
        <Link
          to={`/teams/${oppTeamId}`}
          className="text-sm text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
        >
          Vollständige Gegner-Analyse &rarr;
        </Link>
      </div>
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
  const { teamId, teamName } = useTeam();
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

  const isPreGame = match.state !== 'Post';
  const events = match.events || [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link to="/matches" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 inline-block">
        &larr; Alle Spiele
      </Link>

      {/* Match header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-4 shadow-sm dark:shadow-none">
        <div className="text-xs text-gray-400 dark:text-gray-500 text-center mb-3">
          {formatDate(match.starts_at)} · {formatTime(match.starts_at)}
          {match.venue_name && ` · ${match.venue_name}`}
          {match.venue_city && `, ${match.venue_city}`}
        </div>
        <div className="flex items-center justify-center gap-4">
          <div className="text-right flex-1">
            <div className="font-bold text-lg">{match.home_team_name}</div>
          </div>
          {isPreGame ? (
            <div className="text-xl font-bold px-4 text-gray-400 dark:text-gray-500">
              – : –
            </div>
          ) : (
            <div className="text-3xl font-bold px-4">
              {match.home_goals} : {match.away_goals}
            </div>
          )}
          <div className="text-left flex-1">
            <div className="font-bold text-lg">{match.away_team_name}</div>
          </div>
        </div>
        {!isPreGame && match.home_goals_half != null && (
          <div className="text-center text-sm text-gray-500 mt-1">
            Halbzeit: {match.home_goals_half} : {match.away_goals_half}
          </div>
        )}
        {!isPreGame && match.attendance && (
          <div className="text-center text-xs text-gray-600 mt-2">
            {match.attendance} Zuschauer
            {match.referee_info && ` · SR: ${match.referee_info}`}
          </div>
        )}
      </div>

      {isPreGame ? (
        <MatchPreview match={match} teamId={teamId} />
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-100 dark:border-gray-700 mb-4">
            {TABS.map((tab) => (
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

          {/* Tab content */}
          {activeTab === 'verlauf' && (
            <TabSpieldverlauf
              events={events}
              homeTeamName={match.home_team_name}
              awayTeamName={match.away_team_name}
            />
          )}
          {activeTab === 'analyse' && <TabAnalyse events={events} match={match} teamId={teamId} teamName={teamName} />}
          {activeTab === 'spieler' && <TabSpieler events={events} match={match} teamId={teamId} />}
        </>
      )}
    </div>
  );
}
