import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { dimensions } from '../../data/dimensions';
import { ACT_COLORS } from '../../data/plotStructures';

function ChartTooltip({ active, payload, structureBeats, prefix = '' }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  const labelKey = prefix ? `${prefix}label` : 'label';
  const beatKey = prefix ? `${prefix}beat` : 'beat';
  const label = data[labelKey] || data.label || '';
  const beat = data[beatKey] || data.beat || '';
  const beatName = structureBeats?.[beat]?.name || beat;

  return (
    <div className="bg-slate-800 border border-purple-500 rounded p-3 max-w-xs">
      <p className="font-bold text-purple-300 text-sm">{label}</p>
      {beatName && (
        <p className="text-xs text-purple-200 mb-2">Beat: {beatName} ({data.time}%)</p>
      )}
      {payload.map((entry, index) => (
        <p key={index} style={{ color: entry.color }} className="text-xs">
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
        </p>
      ))}
    </div>
  );
}

export default function NarrativeChart({
  data,
  visibleDims,
  structureName = '',
  structureBeats = {},
  actStructure = null,
  height = 500,
  overlayData = null,
  showProjected = false,
}) {
  const isOverlay = overlayData !== null;
  const chartData = isOverlay ? overlayData : data;
  const actStructureName = actStructure?.name || '';
  const xLabel = structureName && actStructureName && actStructureName !== structureName
    ? `${structureName} (${actStructureName})`
    : structureName || actStructureName || 'Story Progress (%)';

  return (
    <div
      className="bg-white/10 backdrop-blur rounded-lg p-6 mb-6"
      role="img"
      aria-label="Story progression chart showing narrative dimension intensities over time"
    >
      <h2 className="text-2xl font-bold mb-4 text-center">Story Progression</h2>

      {/* Act Structure Legend */}
      {actStructure?.acts?.length > 0 && (
        <div className="mb-4 p-4 bg-slate-800/70 rounded border border-purple-500/50">
          <h3 className="text-base font-bold mb-3 text-purple-300">
            {actStructureName} - Act Structure
          </h3>
          <div className="flex flex-wrap gap-2 text-xs">
            {actStructure.acts.map((act, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900/50 rounded-full border border-slate-700/50"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: ACT_COLORS[i % ACT_COLORS.length] }}
                />
                <span className="font-semibold whitespace-nowrap">{act.name}</span>
                <span className="text-purple-400 text-[10px]">
                  {act.range[0] === act.range[1] ? `${act.range[0]}%` : `${act.range[0]}-${act.range[1]}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 55 }}>
          {/* Act structure background bands */}
          {actStructure?.acts?.map((act, i) => {
            const width = act.range[1] - act.range[0];
            return (
              <ReferenceArea
                key={`act-${i}`}
                x1={act.range[0]}
                x2={act.range[1]}
                fill={ACT_COLORS[i % ACT_COLORS.length]}
                fillOpacity={0.12}
                stroke={ACT_COLORS[i % ACT_COLORS.length]}
                strokeOpacity={0.3}
                label={width >= 10 ? {
                  value: act.name,
                  position: 'insideTop',
                  fill: ACT_COLORS[i % ACT_COLORS.length],
                  fontSize: 11,
                  fontWeight: 600,
                  opacity: 0.7,
                } : undefined}
              />
            );
          })}

          {/* Vertical lines at act boundaries (skip first act's start) */}
          {actStructure?.acts?.slice(1).map((act, i) => (
            <ReferenceLine
              key={`ab-${i}`}
              x={act.range[0]}
              stroke={ACT_COLORS[(i + 1) % ACT_COLORS.length]}
              strokeDasharray="4 4"
              strokeOpacity={0.4}
            />
          ))}

          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
          <XAxis
            dataKey="time"
            type="number"
            domain={[0, 100]}
            stroke="#fff"
            label={{ value: xLabel, position: 'bottom', offset: 10, fill: '#fff' }}
          />
          <YAxis
            stroke="#fff"
            domain={[-5, 10]}
            label={{ value: 'Intensity', angle: -90, position: 'left', offset: 0, fill: '#fff' }}
          />
          <Tooltip
            content={<ChartTooltip structureBeats={structureBeats} />}
          />
          <Legend wrapperStyle={{ paddingTop: '30px' }} iconType="line" />
          <ReferenceLine y={0} stroke="#ffffff40" strokeDasharray="3 3" />

          {isOverlay ? (
            <>
              {Object.entries(dimensions).map(([key, dim]) =>
                visibleDims[key] && (
                  <React.Fragment key={key}>
                    <Line
                      type="monotone"
                      dataKey={`actual_${key}`}
                      stroke={dim.color}
                      strokeWidth={2}
                      name={`${dim.name} (actual)`}
                      dot={{ r: 4 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey={`ideal_${key}`}
                      stroke={dim.color}
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      strokeOpacity={0.4}
                      name={`${dim.name} (ideal)`}
                      dot={false}
                      connectNulls
                    />
                    {showProjected && (
                      <Line
                        type="monotone"
                        dataKey={`projected_${key}`}
                        stroke={dim.color}
                        strokeWidth={2}
                        strokeDasharray="2 4"
                        name={`${dim.name} (projected)`}
                        dot={{ r: 3, strokeDasharray: '' }}
                        connectNulls
                      />
                    )}
                  </React.Fragment>
                )
              )}
              {visibleDims.tension && (
                <>
                  <Line
                    type="monotone"
                    dataKey="actual_tension"
                    stroke="#ff0000"
                    strokeWidth={3}
                    name="TENSION (actual)"
                    dot={{ r: 5, fill: '#ff0000' }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="ideal_tension"
                    stroke="#ff0000"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    strokeOpacity={0.4}
                    name="TENSION (ideal)"
                    dot={false}
                    connectNulls
                  />
                  {showProjected && (
                    <Line
                      type="monotone"
                      dataKey="projected_tension"
                      stroke="#ff0000"
                      strokeWidth={2}
                      strokeDasharray="2 4"
                      name="TENSION (projected)"
                      dot={{ r: 3, fill: '#ff0000', strokeDasharray: '' }}
                      connectNulls
                    />
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {Object.entries(dimensions).map(([key, dim]) =>
                visibleDims[key] && (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={dim.color}
                    strokeWidth={2}
                    name={dim.name}
                    dot={{ r: 4 }}
                  />
                )
              )}
              {visibleDims.tension && (
                <Line
                  type="monotone"
                  dataKey="tension"
                  stroke="#ff0000"
                  strokeWidth={3}
                  name="TENSION (derived)"
                  dot={{ r: 5, fill: '#ff0000' }}
                />
              )}
            </>
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Visually-hidden data table for screen readers (F-004) */}
      {chartData && chartData.length > 0 && (
        <table
          className="sr-only"
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
        >
          <caption>Story progression data values</caption>
          <thead>
            <tr>
              <th>Time (%)</th>
              {Object.entries(dimensions).map(([key, dim]) =>
                visibleDims[key] ? <th key={key}>{dim.name}</th> : null
              )}
              {visibleDims.tension && <th>Tension</th>}
            </tr>
          </thead>
          <tbody>
            {chartData.map((row, i) => (
              <tr key={i}>
                <td>{row.time}</td>
                {Object.entries(dimensions).map(([key]) =>
                  visibleDims[key] ? (
                    <td key={key}>
                      {isOverlay
                        ? `${row[`actual_${key}`] ?? '—'} / ${row[`ideal_${key}`] ?? '—'}`
                        : row[key] ?? '—'}
                    </td>
                  ) : null
                )}
                {visibleDims.tension && (
                  <td>{isOverlay ? `${row.actual_tension ?? '—'} / ${row.ideal_tension ?? '—'}` : row.tension ?? '—'}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
