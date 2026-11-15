import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDashed,
  FlaskConical,
  Moon,
  Radio,
  Route,
  Square,
  Sun,
  Thermometer,
  TrendingUp,
} from 'lucide-react';
import SidePanel from './SidePanel.jsx';
import { YEAR_MAX, YEAR_MIN } from '../data/cities.js';
import { MONTH_NAMES, fmtP, signed } from '../lib/format.js';

function Pill({ className, Icon, children }) {
  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${className}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {children}
    </div>
  );
}

function SignificancePill({ pValue, delta }) {
  if (pValue == null)
    return (
      <Pill className="border-slate-500/30 bg-slate-500/10 text-slate-400" Icon={CircleDashed}>
        Insufficient data for test
      </Pill>
    );
  if (pValue < 0.05 && delta > 0)
    return (
      <Pill
        className="border-emerald-400/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.45)]"
        Icon={CheckCircle2}
      >
        Statistically Significant ({fmtP(pValue)})
      </Pill>
    );
  if (pValue < 0.05)
    return (
      <Pill className="border-sky-400/40 bg-sky-500/10 text-sky-300" Icon={AlertTriangle}>
        Significant, but cooler ({fmtP(pValue)})
      </Pill>
    );
  return (
    <Pill className="border-slate-500/30 bg-slate-500/10 text-slate-300" Icon={CircleDashed}>
      Not significant ({fmtP(pValue)})
    </Pill>
  );
}

/** Per-year gap bars (target − baseline). */
function GapHistory({ years, currentYear }) {
  const range = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);
  const vals = range.map((y) => years?.[y]?.deltaC ?? null);
  const maxAbs = Math.max(0.5, ...vals.filter((v) => v != null).map(Math.abs));
  const H = 26;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500">
        <span>Yearly gap, target − baseline</span>
        <span className="tabular-nums">±{maxAbs.toFixed(1)}°C</span>
      </div>
      <div className="relative flex h-[52px] items-center gap-[3px]">
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
        {range.map((y, i) => {
          const v = vals[i];
          const h = v == null ? 0 : Math.max(2, (Math.abs(v) / maxAbs) * H);
          const active = y === currentYear;
          return (
            <div key={y} className="relative flex h-full flex-1 flex-col" title={v == null ? `${y}: no data` : `${y}: ${signed(v)}°C`}>
              <div className="flex flex-1 items-end">
                {v != null && v > 0 && (
                  <div className={`w-full rounded-t-[3px] ${active ? 'bg-orange-400' : 'bg-orange-400/50'}`} style={{ height: h }} />
                )}
              </div>
              <div className="flex flex-1 items-start">
                {v != null && v <= 0 && (
                  <div className={`w-full rounded-b-[3px] ${active ? 'bg-sky-400' : 'bg-sky-400/45'}`} style={{ height: h }} />
                )}
              </div>
              {active && <div className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-teal-400" />}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] tabular-nums text-slate-600">
        <span>{YEAR_MIN}</span>
        <span>{YEAR_MAX}</span>
      </div>
    </div>
  );
}

const SEASON_ROWS = [
  ['summer', 'Summer'],
  ['winter', 'Winter'],
  ['annual', 'All year'],
];

function GapCell({ g }) {
  if (!g) return <div className="rounded-lg bg-black/20 px-2 py-1.5 text-[11px] text-slate-500">no data</div>;
  const sig = g.significant;
  const tone = !sig ? 'text-slate-300' : g.meanC > 0 ? 'text-orange-300' : 'text-sky-300';
  return (
    <div
      className="rounded-lg bg-black/20 px-2 py-1.5"
      title={`${signed(g.meanC)} °C, 95% CI ${g.ci95 ? `${signed(g.ci95[0])} to ${signed(g.ci95[1])}` : 'n/a'}, n = ${g.n} ${
        g.unit === 'year' ? 'years' : 'seasons'
      } (${g.nComposites} composites), ${fmtP(g.pValue)}`}
    >
      <div className={`text-sm font-semibold tabular-nums ${tone}`}>{signed(g.meanC)}°C</div>
      <div className="text-[10px] tabular-nums text-slate-500">
        {g.ci95 ? `${signed(g.ci95[0])} to ${signed(g.ci95[1])}` : 'CI n/a'} · n={g.n}
      </div>
      <div className={`text-[10px] font-medium ${sig ? 'text-emerald-300' : 'text-slate-500'}`}>
        {sig ? `significant, ${fmtP(g.pValue)}` : `not significant, ${fmtP(g.pValue)}`}
      </div>
    </div>
  );
}

/** Gap before vs after the data centre opened (Welch t-test on season / year means). */
function BeforeAfter({ ba, name }) {
  const opened = new Date(ba.day.opening).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  return (
    <div className="mt-3 border-t border-white/10 pt-2.5">
      <div className="text-[11px] text-slate-300">
        Before vs after {name} opened <span className="text-slate-500">({opened})</span>
      </div>
      <div className="mt-1.5 grid grid-cols-[52px_1fr_1fr] gap-1.5">
        <div />
        <div className="text-[10px] text-slate-500">Day</div>
        <div className="text-[10px] text-slate-500">Night</div>
        {SEASON_ROWS.map(([key, label]) => [
          <div key={`${key}-l`} className="pt-1 text-[11px] text-slate-300">{label}</div>,
          ...['day', 'night'].map((l) => {
            const b = ba[l]?.[key];
            if (!b) return <div key={`${key}-${l}`} className="rounded-lg bg-black/20 px-2 py-1 text-[10px] text-slate-500">n/a</div>;
            return (
              <div
                key={`${key}-${l}`}
                className="rounded-lg bg-black/20 px-2 py-1"
                title={`${signed(b.beforeC)} °C (n=${b.nBefore}) → ${signed(b.afterC)} °C (n=${b.nAfter}); change 95% CI ${signed(b.ci95[0])} to ${signed(b.ci95[1])}, ${fmtP(b.pValue)}`}
              >
                <div className="text-[11px] tabular-nums text-slate-400">
                  {signed(b.beforeC)} → {signed(b.afterC)}
                </div>
                <div className={`text-[10px] font-medium ${b.significant ? 'text-emerald-300' : 'text-slate-500'}`}>
                  {signed(b.diffC)}°C · {b.significant ? 'significant' : 'not sig.'}, {fmtP(b.pValue)}
                </div>
              </div>
            );
          }),
        ])}
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
        Only {ba.day.annual?.nAfter ?? 0} full years since opening, so this test has little power. Construction before opening and
        Terra’s orbit drift after 2020 both fall inside this window.
      </p>
    </div>
  );
}

/** Seasonal heat-island gap (target − baseline ring), day and night, with 95 % CIs. */
function HeatIslandGap({ city, cityData }) {
  const gs = cityData?.gapSummary;
  const base = cityData?.baseline;
  return (
    <section className="rounded-xl border border-white/10 bg-black/20 p-3.5">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Thermometer className="h-3.5 w-3.5 text-orange-300" />
        Heat island gap
        <span className="ml-auto text-[10px] text-slate-500">target − baseline · 95% CI</span>
      </div>

      {!gs ? (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          Not computed yet for {city.label}: its data-centre coordinates are being updated, so it still uses the older
          “rest of the tile” baseline. Seasonal gaps will appear after the next <code className="text-slate-300">npm run overlays</code>.
        </p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-[52px_1fr_1fr] gap-1.5 text-xs">
            <div />
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Sun className="h-3 w-3" /> Day
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Moon className="h-3 w-3" /> Night
            </div>
            {SEASON_ROWS.map(([key, label]) => {
              const months = gs.layers.day?.[key]?.months;
              return [
                <div key={`${key}-l`} className="pt-1.5 text-[11px] leading-tight text-slate-300">
                  {label}
                  {months && <div className="text-[10px] text-slate-500">{months.map((m) => MONTH_NAMES[m - 1][0]).join('')}</div>}
                </div>,
                <GapCell key={`${key}-d`} g={gs.layers.day?.[key]} />,
                <GapCell key={`${key}-n`} g={gs.layers.night?.[key]} />,
              ];
            })}
            <div className="pt-1.5 text-[11px] leading-tight text-slate-300">Trend</div>
            {['day', 'night'].map((l) => {
              const tr = cityData.layers[l]?.trends?.gap;
              return (
                <div key={l} className="rounded-lg bg-black/20 px-2 py-1.5">
                  {tr ? (
                    <>
                      <div className="text-sm font-semibold tabular-nums text-slate-200">{signed(tr.senSlopePerYear * 10)}°C</div>
                      <div className="text-[10px] tabular-nums text-slate-500">
                        per decade · {signed(tr.senCI95PerYear[0] * 10)} to {signed(tr.senCI95PerYear[1] * 10)}
                      </div>
                      <div className={`text-[10px] font-medium ${tr.mkP < 0.05 ? 'text-emerald-300' : 'text-slate-500'}`}>
                        {tr.mkP < 0.05 ? 'significant' : 'not significant'}, {fmtP(tr.mkP)}
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-slate-500">no data</div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            Baseline = {base.innerKm}–{base.outerKm} km ring ({base.baselinePixels} px) vs. {cityData.targetRadiusKm} km target (
            {base.targetPixels} px). n = number of seasons or years.
            {base.ringCoveragePct < 50 && (
              <span className="text-amber-300/80">
                {' '}
                Only {Math.round(base.ringCoveragePct)}% of the ring lies inside the satellite tile, mostly to the{' '}
                {Object.entries(base.ringSectors)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([k]) => k)
                  .join('/')}
                , so the comparison is one-sided.
              </span>
            )}
          </p>

          {gs.layers.day?.beforeAfter && (
            <BeforeAfter ba={{ day: gs.layers.day.beforeAfter, night: gs.layers.night?.beforeAfter }} name={city.dataCenter.name} />
          )}
        </>
      )}

      <details className="mt-2 text-[11px] text-slate-400">
        <summary className="cursor-pointer select-none text-amber-300/90">Read before quoting these numbers</summary>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 leading-relaxed">
          <li>This is land surface temperature (how hot roofs, roads and fields are), not the air temperature people feel.</li>
          <li>
            A gap shows an association, not proof that the data centre caused it. Roofs, car parks, roads and other industry
            heat surfaces too.
          </li>
          <li>One MODIS pixel is about 1 km across, much coarser than a single building.</li>
          <li>
            Terra’s overpass time has drifted, which biases absolute daytime temperature trends. Comparing target with
            baseline cancels most of that, so the gap is the headline number.
          </li>
        </ul>
      </details>
    </section>
  );
}

export default function AnalyticsWidget({
  city,
  cityData,
  layer,
  layerData,
  currentYear,
  yearStats,
  isSimulating,
  onToggleSimulate,
  onOpenTrendLab,
  mobileOpen,
}) {
  const delta = yearStats?.deltaC;
  const hotter = delta != null && delta > 0;
  const gapTrend = layerData?.trends?.gap;
  const LayerIcon = layer === 'night' ? Moon : Sun;

  return (
    <SidePanel side="right" title="Thermal AI Console" Icon={BrainCircuit} mobileOpen={mobileOpen}>
      <div className="space-y-5">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">Anomaly Status</h3>
            <span className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <LayerIcon className="h-3 w-3" /> {layer === 'night' ? 'Night' : 'Day'}
              </span>
              <span className="flex items-center gap-1">
                <Radio className="h-3 w-3 text-teal-400" /> {currentYear}
              </span>
            </span>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${city.id}-${layer}-${currentYear}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className={`rounded-xl border p-4 ${
                !yearStats
                  ? 'border-white/10 bg-white/[0.03]'
                  : hotter
                    ? 'border-orange-400/30 bg-orange-500/10 shadow-[inset_0_0_24px_rgba(251,146,60,0.12)]'
                    : 'border-sky-400/25 bg-sky-500/[0.08]'
              }`}
            >
              {yearStats && delta != null ? (
                <>
                  <div className="text-xs text-slate-400">Target zone vs. baseline</div>
                  <div
                    className={`mt-1 text-4xl font-semibold tabular-nums ${
                      hotter ? 'text-orange-400 [text-shadow:0_0_20px_rgba(251,146,60,0.55)]' : 'text-sky-300'
                    }`}
                  >
                    {signed(delta)}°C
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-black/20 px-2.5 py-2">
                      <div className="text-slate-500">Target ({cityData.targetRadiusKm} km)</div>
                      <div className="mt-0.5 font-semibold tabular-nums text-white">{yearStats.targetC?.toFixed(1)}°C</div>
                    </div>
                    <div className="rounded-lg bg-black/20 px-2.5 py-2">
                      <div className="text-slate-500">
                        Baseline{cityData.baseline ? ` (${cityData.baseline.innerKm}–${cityData.baseline.outerKm} km ring)` : ''}
                      </div>
                      <div className="mt-0.5 font-semibold tabular-nums text-white">{yearStats.baselineC?.toFixed(1)}°C</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    {yearStats.composites} × 8-day composites, QC-filtered{yearStats.partial ? ' · partial year' : ''}
                  </div>
                </>
              ) : (
                <div className="py-2 text-sm text-slate-400">
                  No MODIS data for {city.label} in {currentYear}.
                  <div className="mt-1 text-[11px] text-slate-500">
                    Add GeoTIFFs to nasa_raw_tiffs/{city.id}/ and run <code className="text-slate-400">npm run overlays</code>.
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-3">
            <SignificancePill pValue={yearStats?.pValue} delta={delta} />
          </div>
        </section>

        <GapHistory years={layerData?.years} currentYear={currentYear} />

        {/* Decade trend of the gap: the challenge's core question */}
        {gapTrend && (
          <section className="rounded-xl border border-white/10 bg-black/20 p-3.5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <TrendingUp className="h-3.5 w-3.5 text-teal-400" />
              Gap trend {cityData.period[0].slice(0, 4)}–{cityData.period[1].slice(0, 4)}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-2xl font-semibold tabular-nums ${gapTrend.senSlopePerYear > 0 ? 'text-orange-300' : 'text-sky-300'}`}>
                {signed(gapTrend.senSlopePerYear * 10)}°C
              </span>
              <span className="text-xs text-slate-400">per decade</span>
            </div>
            <div className={`mt-1 text-[11px] ${gapTrend.mkP < 0.05 ? 'text-emerald-300' : 'text-slate-400'}`}>
              Mann-Kendall {fmtP(gapTrend.mkP)} · {gapTrend.mkP < 0.05 ? 'significant' : 'not significant'}
            </div>
            <button
              type="button"
              onClick={onOpenTrendLab}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
            >
              <FlaskConical className="h-3.5 w-3.5 text-teal-400" /> Open Trend Lab
            </button>
          </section>
        )}

        <HeatIslandGap city={city} cityData={cityData} />

        <motion.button
          type="button"
          onClick={onToggleSimulate}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          aria-pressed={isSimulating}
          className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${
            isSimulating
              ? 'border-teal-300/60 bg-teal-400 text-slate-950 shadow-[0_0_25px_rgba(45,212,191,0.75)]'
              : 'border-teal-400/50 bg-teal-500/20 text-teal-300 shadow-[0_0_15px_rgba(45,212,191,0.5)] hover:bg-teal-500/30'
          }`}
        >
          {isSimulating ? <Square className="h-4 w-4" /> : <Route className="h-4 w-4" />}
          {isSimulating ? 'Stop Simulation' : 'Simulate Heat Routing'}
        </motion.button>
      </div>
    </SidePanel>
  );
}
