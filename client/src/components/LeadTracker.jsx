import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

/**
 * Build chart data from match events.
 * Each goal event creates a data point with the running score.
 */
function buildChartData(events, homeTeamName, awayTeamName) {
  // Start with 0:0
  const data = [{ minute: 0, home: 0, away: 0, diff: 0, label: 'Anpfiff' }];

  // Filter to scoring events only and sort by time
  const goalEvents = events
    .filter((e) =>
      ['Goal', 'SevenMeterGoal'].includes(e.type) &&
      e.score_home != null &&
      e.score_away != null
    )
    .sort((a, b) => (a.elapsed_seconds || 0) - (b.elapsed_seconds || 0));

  for (const evt of goalEvents) {
    const minute = evt.elapsed_seconds ? +(evt.elapsed_seconds / 60).toFixed(1) : 0;
    data.push({
      minute,
      home: evt.score_home,
      away: evt.score_away,
      diff: evt.score_home - evt.score_away,
      label: evt.message || '',
    });
  }

  return data;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  const d = payload[0].payload;
  return (
    <div className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm shadow-lg">
      <div className="font-bold mb-1">
        {d.home} : {d.away}
      </div>
      <div className="text-gray-400 text-xs">{Math.floor(d.minute)}&apos; min</div>
      {d.label && d.label !== 'Anpfiff' && (
        <div className="text-gray-300 text-xs mt-1 max-w-[200px]">{d.label}</div>
      )}
    </div>
  );
}

export default function LeadTracker({ events, homeTeamName, awayTeamName }) {
  const data = buildChartData(events, homeTeamName, awayTeamName);

  if (data.length <= 1) {
    return <div className="text-gray-500 text-center py-8">Keine Tordaten vorhanden</div>;
  }

  return (
    <div>
      <h2 className="text-base font-semibold mb-4">Spielstand</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="minute"
            type="number"
            domain={[0, 60]}
            ticks={[0, 10, 20, 30, 40, 50, 60]}
            tickFormatter={(v) => `${v}'`}
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis stroke="#6b7280" fontSize={12} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={30} stroke="#4b5563" strokeDasharray="3 3" label="" />
          <Line
            type="stepAfter"
            dataKey="home"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            name={homeTeamName}
          />
          <Line
            type="stepAfter"
            dataKey="away"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name={awayTeamName}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 mt-2 text-sm">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-red-500 inline-block"></span>
          {homeTeamName}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-blue-500 inline-block"></span>
          {awayTeamName}
        </span>
      </div>
    </div>
  );
}
