import { useMemo, useRef, useState } from 'react';

const TEAL = '#2dd4bf';
const toT = (v) => (typeof v === 'number' ? v : Number(v.slice(0, 4)) + (Number(v.slice(5, 7)) - 0.5) / 12);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const label = (v) => (typeof v === 'number' ? String(v) : `${MONTHS[Number(v.slice(5, 7)) - 1]} ${v.slice(0, 4)}`);

function niceTicks(lo, hi, count = 4) {
  const span = hi - lo || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

/**
 * Single-series time series: observations as dots, Sen's slope trend line,
 * and the 95 % slope confidence interval as a fan around the series centre.
 */
export default function TrendChart({ x, y, trend, unit = '°C', height = 190, valueDigits = 2, includeZero = true }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 640;
  const H = height;
  const pad = { l: 44, r: 12, t: 10, b: 24 };

  const pts = useMemo(
    () => x.map((xi, i) => ({ x: xi, t: toT(xi), v: y[i] })).filter((p) => p.v != null && Number.isFinite(p.v)),
    [x, y],
  );
  if (pts.length < 2) {
    return <div className="grid h-[160px] place-items-center text-sm text-slate-500">Not enough data for this series.</div>;
  }

  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const tMid = (t0 + t1) / 2;
  const fit = (t) => trend.intercept + trend.senSlopePerYear * t;
  const yMid = fit(tMid);
  const [ciLo, ciHi] = trend.senCI95PerYear;
  const fan = (t, s) => yMid + s * (t - tMid);

  const vals = pts.map((p) => p.v).concat([fan(t0, ciLo), fan(t0, ciHi), fan(t1, ciLo), fan(t1, ciHi)].concat(includeZero ? [0] : []));
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const padY = (hi - lo) * 0.08 || 0.5;
  lo -= padY;
  hi += padY;

  const sx = (t) => pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const sy = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const yTicks = niceTicks(lo, hi, 4);
  const xYears = [];
  for (let yr = Math.ceil(t0); yr <= Math.floor(t1); yr += t1 - t0 > 20 ? 5 : t1 - t0 > 8 ? 2 : 1) xYears.push(yr);

  const fanPath = `M${sx(t0)},${sy(fan(t0, ciHi))} L${sx(t1)},${sy(fan(t1, ciHi))} L${sx(t1)},${sy(fan(t1, ciLo))} L${sx(t0)},${sy(fan(t0, ciLo))} Z`;
  const linePath = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.t).toFixed(1)},${sy(p.v).toFixed(1)}`).join(' ');

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(sx(p.t) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover != null ? pts[hover] : null;

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Time series with trend line"
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} stroke={v === 0 ? '#64748b' : '#1e293b'} strokeDasharray={v === 0 ? '4 4' : undefined} />
            <text x={pad.l - 6} y={sy(v) + 3.5} textAnchor="end" className="fill-slate-500 text-[10px] tabular-nums">
              {includeZero && v > 0 ? '+' : ''}
              {v}
            </text>
          </g>
        ))}
        {xYears.map((yr) => (
          <text key={yr} x={sx(yr)} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[10px] tabular-nums">
            {yr}
          </text>
        ))}

        <path d={fanPath} fill={TEAL} opacity={0.12} />
        <path d={linePath} fill="none" stroke="#475569" strokeWidth={1} opacity={0.7} />
        {pts.map((p, i) => (
          <circle key={i} cx={sx(p.t)} cy={sy(p.v)} r={hover === i ? 4.5 : 2.2} fill={hover === i ? '#fff' : '#94a3b8'} />
        ))}
        <line x1={sx(t0)} y1={sy(fit(t0))} x2={sx(t1)} y2={sy(fit(t1))} stroke={TEAL} strokeWidth={2.5} strokeLinecap="round" />

        {hp && <line x1={sx(hp.t)} x2={sx(hp.t)} y1={pad.t} y2={H - pad.b} stroke="#94a3b8" strokeDasharray="2 3" />}
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-950/95 px-2.5 py-1.5 text-[11px] shadow-lg"
          style={{ left: `${Math.min(88, Math.max(12, (sx(hp.t) / W) * 100))}%` }}
        >
          <div className="font-medium text-white">{label(hp.x)}</div>
          <div className="tabular-nums text-slate-300">
            {includeZero && hp.v > 0 ? '+' : ''}
            {hp.v.toFixed(valueDigits)} {unit}
          </div>
          <div className="tabular-nums text-slate-500">
            trend {includeZero && fit(hp.t) > 0 ? '+' : ''}
            {fit(hp.t).toFixed(valueDigits)} {unit}
          </div>
        </div>
      )}
    </div>
  );
}
