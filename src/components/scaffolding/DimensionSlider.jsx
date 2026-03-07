import React from 'react';

export default function DimensionSlider({ dimKey, dim, value, onChange }) {
  const [min, max] = dim.range;

  return (
    <div className="flex items-center gap-2">
      <span
        style={{ color: dim.color }}
        className="text-xs font-semibold w-24 truncate"
        title={dim.name}
      >
        {dim.name}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => onChange(dimKey, parseFloat(e.target.value))}
        className="flex-1 h-1.5 accent-purple-500"
        style={{ accentColor: dim.color }}
        aria-label={dim.name}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(dimKey, Math.max(min, Math.min(max, v)));
        }}
        className="w-14 bg-slate-700 border border-purple-500/50 rounded px-1 py-0.5 text-xs text-center text-white"
        aria-label={`${dim.name} value`}
      />
    </div>
  );
}
