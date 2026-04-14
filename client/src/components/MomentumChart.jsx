import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

function buildMomentumData(events) {
  const data = [{ minute: 0, diff: 0, pos: 0, neg: 0, score: '0:0' }];

  const goals = events
    .filter((e) => ['Goal', 'SevenMeterGoal'].includes(e.type) && e.score_home != null)
    .sort((a, b) => (a.elapsed_seconds || 0) - (b.elapsed_seconds || 0));

  for (const evt of goals) {
    const minute = evt.elapsed_seconds ? +(evt.elapsed_seconds / 60).toFixed(1) : 0;
    const diff = evt.score_home - evt.score_away;
    data.push({
      minute,
      diff,
      pos: diff >= 0 ? diff : 0,
      neg: diff <= 0 ? diff : 0,
      score: `${evt.score_home}:${evt.score_away}`,
    });
  }

  return data;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const leading = d.diff > 0 ? 'Heim führt' : d.diff < 0 ? 'Gast führt' : 'Ausgeglichen';
  return (
    <div className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm shadow-lg">
      <div className="font-bold">{d.score}</div>
      <div className="text-gray-400 text-xs">{Math.floor(d.minute)}&apos; · {leading}</div>
    </div>
  );
}

export default function MomentumChart({ events, homeTeamName, awayTeamName }) {
  const data = buildMomentumData(events);

  if (data.length <= 1) {
    return <div className="text-gray-500 text-center py-8">Keine Tordaten vorhanden</div>;
  }

  return (
    <div>
      <h2 className="text-base font-semibold mb-1">Tordifferenz</h2>
      <p className="text-xs text-gray-500 mb-4">
        Positiv = Heimteam führt · Negativ = Gast führt
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="negGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
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
          <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1.5} />
          <ReferenceLine x={30} stroke="#4b5563" strokeDasharray="3 3" />
          <Area
            type="stepAfter"
            dataKey="pos"
            stroke="#ef4444"
            strokeWidth={2}
            fill="url(#posGrad)"
            dot={false}
            legendType="none"
          />
          <Area
            type="stepAfter"
            dataKey="neg"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#negGrad)"
            dot={false}
            legendType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 bg-red-500/40 inline-block rounded-sm"></span>
          {homeTeamName} führt
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 bg-blue-500/40 inline-block rounded-sm"></span>
          {awayTeamName} führt
        </span>
      </div>
    </div>
  );
}
