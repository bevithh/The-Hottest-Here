import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, BookOpen, FlaskConical, TrendingDown, TrendingUp, Minus, X } from 'lucide-react';
import TrendChart from './charts/TrendChart.jsx';
import { fmtP, signed, verdict } from '../lib/format.js';

// Projection horizon for "if this trend continues" (a straight-line extrapolation, not a forecast)
const HORIZON = 2036;

// Plain-language definitions (audience: high-school / college / public)
export const VARIABLES = {
  gap: {
    label: 'Heat-island gap',
    source: 'MODIS LST',
    short: 'Target − Baseline',
    def: 'How much hotter the ground inside the data-centre target zone is than the surrounding area, month by month. Positive = the target zone is the hotter one.',
    subject: 'The gap',
  },
  target: {
    label: 'Target zone temperature',
    source: 'MODIS LST',
    short: 'Data-centre zone',
    def: 'Land Surface Temperature (LST): how hot the ground and rooftops are, as measured by the MODIS sensor on NASA’s Terra satellite. Not the same as air temperature, and it can be much hotter on sunny days.',
    subject: 'Target-zone LST',
  },
  baseline: {
    label: 'Baseline temperature',
    source: 'MODIS LST',
    short: 'Surrounding area',
    def: 'The same Land Surface Temperature measurement for a ring 5–10 km from the data centre (leaving a gap so heat spilling off the site is not counted). It is the “control group” we compare against.',
    subject: 'Baseline LST',
  },
  air: {
    label: 'Winter air temperature',
    source: 'MERRA-2',
    short: 'Winter mean, 2 m',
    def: 'Average air temperature 2 m above the ground during the three winter months, from NASA’s MERRA-2 reanalysis (a model that blends many observations into a consistent record).',
    subject: 'Winter air temperature',
  },
  hdd: {
    label: 'Heating degree-days',
    source: 'MERRA-2',
    short: 'Heating need per year',
    def: 'A measure of how much heating homes need. For every day, count how many degrees the outdoor temperature is below 18 °C, then add them up over the year. Higher means colder and more heating.',
    subject: 'Heating demand',
  },
};

const GLOSSARY = [
  ['Trend', 'A steady change in one direction over time, after the regular ups and downs (like summer vs. winter) are removed.'],
  ['Deseasonalized anomaly', 'Each month minus that calendar month’s average across all years. This removes the seasonal cycle so only the longer-term change is left.'],
  ['Mann-Kendall test', 'Compares every pair of points: is the later one higher or lower? If “higher” wins far more often than chance would allow, there is a trend. It works even when data aren’t bell-shaped.'],
  ["Sen's slope", 'The median of the slopes between all pairs of points: a robust “rate of change” that a few odd months can’t throw off.'],
  ['p-value', 'The chance of seeing a trend at least this strong if there were really no trend. Below 0.05 (5%) we call it statistically significant.'],
  ['95% confidence interval', 'The range the true rate of change most likely falls in. If it doesn’t include zero, the trend is significant.'],
  ['Autocorrelation correction', 'Neighbouring months tend to resemble each other, which can fake significance. We inflate the test’s variance to account for this (Hamed & Rao / Yue & Wang).'],
];

function Seg({ options, value, onChange, small }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
      {options.map(([v, l, sub]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`rounded-lg px-2.5 ${small ? 'py-1' : 'py-1.5'} text-left text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 ${
            value === v
              ? 'bg-teal-500/20 text-teal-200 shadow-[0_0_12px_rgba(45,212,191,0.35)]'
              : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          {l}
          {sub && <span className="block text-[10px] font-normal opacity-60">{sub}</span>}
        </button>
      ))}
    </div>
  );
}

export default function TrendLab({ open, onClose, series, onSeries, layer, onLayer, layerData, climate, city }) {
  const isLst = ['gap', 'target', 'baseline'].includes(series);
  const v = VARIABLES[series];

  let x = [];
  let y = [];
  let tr = null;
  let unit = '°C';
  let scale = 10;
  let digits = 2;
  let includeZero = true;
  let yLabel = '';
  if (isLst && layerData) {
    x = layerData.monthly.t;
    y = layerData.monthly[`${series}Anom`];
    tr = layerData.trends[series];
    yLabel = 'Monthly anomaly vs. that month’s average (°C)';
  } else if (series === 'air' && climate) {
    x = climate.winterSeries.years;
    y = climate.winterSeries.meanC;
    tr = climate.winterTrend;
    includeZero = false;
    yLabel = 'Winter mean air temperature (°C)';
  } else if (series === 'hdd' && climate) {
    x = climate.hddSeries.years;
    y = climate.hddSeries.hdd;
    tr = climate.hddTrend;
    unit = 'HDD';
    digits = 0;
    includeZero = false;
    yLabel = 'Heating degree-days per year (base 18 °C)';
  }
  const verd = verdict(tr, { unit, scale, digits, subject: v.subject });
  const ToneIcon = verd.tone === 'up' ? TrendingUp : verd.tone === 'down' ? TrendingDown : Minus;
  const toneClass =
    verd.tone === 'up'
      ? 'border-orange-400/40 bg-orange-500/10 text-orange-300'
      : verd.tone === 'down'
        ? 'border-sky-400/40 bg-sky-500/10 text-sky-300'
        : 'border-slate-500/30 bg-slate-500/10 text-slate-300';
  const years = tr ? tr.end - tr.start : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          aria-label="Trend Lab"
          className="glass absolute inset-x-4 bottom-4 top-[132px] z-[1100] mx-auto max-w-[740px] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 p-5 shadow-[0_12px_48px_rgba(0,0,0,0.6)] sm:bottom-[150px] sm:top-auto sm:max-h-[calc(100%-260px)] lg:bottom-[140px]"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal-500/20 text-teal-400">
                <FlaskConical className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Trend Lab · {city.label}</h2>
                <p className="text-[11px] text-slate-400">What is changing, how fast, and is it significant?</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Trend Lab"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start">
            <div className="flex-1">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">1 · Pick a variable</div>
              <Seg
                value={series}
                onChange={onSeries}
                options={Object.entries(VARIABLES).map(([k, d]) => [k, d.label, d.source])}
              />
            </div>
            {isLst && (
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">2 · Satellite pass</div>
                <Seg
                  value={layer}
                  onChange={onLayer}
                  options={[
                    ['day', 'Day', '~10:30'],
                    ['night', 'Night', '~22:30'],
                  ]}
                />
              </div>
            )}
          </div>

          <p className="mb-3 text-xs leading-relaxed text-slate-400">
            <span className="font-medium text-slate-200">{v.label}:</span> {v.def}
          </p>

          {tr ? (
            <>
              <div className="mb-1 text-[11px] text-slate-500">{yLabel}</div>
              <TrendChart x={x} y={y} trend={tr} unit={unit} valueDigits={digits} includeZero={includeZero} />
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> observations
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded bg-teal-400" /> Sen’s slope trend
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-sm bg-teal-400/20" /> 95% confidence fan
                </span>
              </div>

              <div className={`mt-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${toneClass}`}>
                <ToneIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{verd.text}</span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
                {[
                  ['Rate (Sen’s slope)', `${signed(tr.senSlopePerYear * scale, digits)} ${unit}/decade`],
                  [
                    '95% CI',
                    `${signed(tr.senCI95PerYear[0] * scale, digits)} to ${signed(tr.senCI95PerYear[1] * scale, digits)}`,
                  ],
                  ['Mann-Kendall', `${fmtP(tr.mkP)}${tr.varianceInflation > 1.01 ? ' *' : ''}`],
                  ['Linear t-test', fmtP(tr.olsP)],
                  ['Total change', `${signed(tr.senSlopePerYear * years, digits)} ${unit} over ${years.toFixed(0)} yrs`],
                  [
                    `If it continues → ${HORIZON}`,
                    `${signed(tr.senSlopePerYear * (HORIZON - tr.end), digits)} ${unit} more (${signed(tr.senCI95PerYear[0] * (HORIZON - tr.end), digits)} to ${signed(tr.senCI95PerYear[1] * (HORIZON - tr.end), digits)})`,
                  ],
                  ['Samples', `${tr.n} ${isLst ? 'months' : 'years'}`],
                  ['Period', `${Math.floor(tr.start)}–${Math.floor(tr.end)}`],
                  ['Source', v.source === 'MODIS LST' ? 'MOD11A2 v061' : 'MERRA-2 (POWER)'],
                ].map(([k, val]) => (
                  <div key={k} className="rounded-lg bg-black/20 px-2.5 py-2">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-white">{val}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Projection = today’s rate carried forward in a straight line, with its 95% range. It is a what-if, not a forecast:
                new data centres, land use and climate can all bend the line.
              </p>
              {tr.varianceInflation > 1.01 && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  * corrected for autocorrelation (variance × {tr.varianceInflation.toFixed(2)})
                </p>
              )}

              {(series === 'target' || series === 'baseline') && (
                <div className="mt-3 flex gap-2.5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <b>Detective caution:</b> since 2020 the Terra satellite’s orbit has been drifting, so it passes over
                    earlier in the morning (and earlier at night) than it used to. That alone makes daytime LST look colder and
                    night-time LST look warmer over time. The <b>heat-island gap</b> compares two areas seen in the same pass,
                    so the drift largely cancels out. That is why we use the gap as our main evidence.
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center text-sm text-slate-400">
              No data for {city.label} yet. Add AppEEARS GeoTIFFs and run <code>npm run overlays</code>.
            </div>
          )}

          <details className="group mt-4 rounded-xl border border-white/10 bg-black/10 px-3.5 py-2.5">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-slate-300">
              <BookOpen className="h-3.5 w-3.5 text-teal-400" /> Detective’s glossary: how the test works
            </summary>
            <dl className="mt-3 space-y-2 text-xs leading-relaxed">
              {GLOSSARY.map(([term, d]) => (
                <div key={term}>
                  <dt className="font-medium text-slate-200">{term}</dt>
                  <dd className="text-slate-400">{d}</dd>
                </div>
              ))}
            </dl>
          </details>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
