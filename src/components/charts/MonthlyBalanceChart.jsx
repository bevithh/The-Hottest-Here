import { useState } from 'react';

// Validated pair (dark surface): supply teal-600, demand violet-500
export const SUPPLY = '#0d9488';
export const DEMAND = '#8b5cf6';
const M = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Grouped monthly bars: heating demand of connected homes vs. routable waste heat (GWh). */
export default function MonthlyBalanceChart({ monthly }) {
  const [hover, setHover] = useState(null);
  const W = 300;
  const H = 120;
  const pad = { l: 4, r: 4, t: 6, b: 16 };
  const max = Math.max(...monthly.flatMap((m) => [m.demand, m.supply]), 0.001);
  const cw = (W - pad.l - pad.r) / 12;
  const bw = (cw - 6) / 2;
  const sy = (v) => (v / max) * (H - pad.t - pad.b);
  const hm = hover != null ? monthly[hover] : null;

  return (
    <div className="relative">
      <div className="mb-1.5 flex items-center gap-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: DEMAND }} /> Home heating demand
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: SUPPLY }} /> Routable heat
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Monthly heat demand versus routable supply">
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#334155" />
        {monthly.map((m, i) => {
          const x = pad.l + i * cw + 3;
          return (
            <g
              key={i}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              opacity={hover == null || hover === i ? 1 : 0.45}
            >
              <rect x={pad.l + i * cw} y={pad.t} width={cw} height={H - pad.t - pad.b} fill="transparent" />
              <rect x={x} y={H - pad.b - sy(m.demand)} width={bw} height={Math.max(0, sy(m.demand))} rx={2} fill={DEMAND} />
              <rect x={x + bw + 2} y={H - pad.b - sy(m.supply)} width={bw} height={sy(m.supply)} rx={2} fill={SUPPLY} />
              <text x={pad.l + i * cw + cw / 2} y={H - 4} textAnchor="middle" className="fill-slate-500 text-[9px]">
                {M[i]}
              </text>
            </g>
          );
        })}
      </svg>
      {hm && (
        <div className="pointer-events-none absolute right-0 top-0 rounded-lg border border-white/10 bg-slate-950/95 px-2.5 py-1.5 text-[11px] shadow-lg">
          <div className="font-medium text-white">{MONTH[hm.month]}</div>
          <div className="tabular-nums text-slate-300">Demand {hm.demand.toFixed(1)} GWh</div>
          <div className="tabular-nums text-slate-300">Routable {hm.supply.toFixed(1)} GWh</div>
          <div className="tabular-nums text-slate-500">
            {hm.demand > 0 ? `${Math.round(Math.min(1, hm.supply / hm.demand) * 100)}% of demand met` : 'No heating needed'}
          </div>
        </div>
      )}
    </div>
  );
}
