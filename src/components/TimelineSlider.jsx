import { motion } from 'framer-motion';
import { Moon, Pause, Play, SkipBack, SkipForward, Sun } from 'lucide-react';
import { YEAR_MAX, YEAR_MIN } from '../data/cities.js';

const INFERNO = 'linear-gradient(90deg,#000004,#1b0c41,#4a0c6b,#781c6d,#a52c60,#cf4446,#ed6925,#fb9b06,#f7d13d,#fcffa4)';
const RDBU = 'linear-gradient(90deg,#053061,#2166ac,#4393c3,#92c5de,#d1e5f0,#f7f7f7,#fddbc7,#f4a582,#d6604d,#b2182b,#67001f)';

function IconButton({ onClick, label, disabled, primary, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`grid place-items-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 disabled:cursor-not-allowed disabled:opacity-35 ${
        primary
          ? 'h-11 w-11 border-teal-400/50 bg-teal-500/20 text-teal-300 shadow-[0_0_15px_rgba(45,212,191,0.5)] hover:bg-teal-500/30'
          : 'h-9 w-9 border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-white/10 bg-black/20 p-0.5">
      {options.map(([v, l, Icon]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
            value === v ? 'bg-teal-500/20 text-teal-200' : 'text-slate-400 hover:text-white'
          }`}
        >
          {Icon && <Icon className="h-3 w-3" />}
          {l}
        </button>
      ))}
    </div>
  );
}

export default function TimelineSlider({
  currentYear,
  onYearChange,
  isPlaying,
  onTogglePlay,
  onStep,
  availableYears,
  layer,
  onLayer,
  mapMode,
  onMapMode,
  layerData,
}) {
  const years = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);
  const hasData = new Set(availableYears);
  const pct = ((currentYear - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
  const trendMode = mapMode === 'trend';
  const colorScale = layerData?.colorScaleC;
  const trendScale = layerData?.trendMap?.scalePerDecade;
  const partial = layerData?.years?.[currentYear]?.partial;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
      className="glass absolute inset-x-4 bottom-4 z-[1000] mx-auto max-w-[880px] rounded-2xl border border-white/10 px-4 pb-4 pt-3 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-6 lg:bottom-6"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            label="Satellite pass"
            value={layer}
            onChange={onLayer}
            options={[
              ['day', 'Day', Sun],
              ['night', 'Night', Moon],
            ]}
          />
          <Toggle
            label="Map shows"
            value={mapMode}
            onChange={onMapMode}
            options={[
              ['annual', 'Yearly heat'],
              ['trend', 'Where it’s changing'],
            ]}
          />
        </div>
        <div className="flex w-full items-center gap-2 sm:w-[200px]">
          <div className="flex-1">
            <div className="h-2 rounded-full" style={{ background: trendMode ? RDBU : INFERNO }} />
            <div className="mt-0.5 flex justify-between text-[10px] tabular-nums text-slate-400">
              {trendMode ? (
                <>
                  <span>{trendScale ? `${trendScale[0]}°` : '—'}</span>
                  <span className="text-slate-500">°C / decade</span>
                  <span>{trendScale ? `+${trendScale[1]}°` : '—'}</span>
                </>
              ) : (
                <>
                  <span>{colorScale ? `${colorScale[0]}°` : '—'}</span>
                  <span className="text-slate-500">surface °C</span>
                  <span>{colorScale ? `${colorScale[1]}°` : '—'}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {trendMode ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
          <span className="font-semibold text-white">
            Per-pixel trend, {layerData?.monthly?.t?.[0]?.slice(0, 4)}–{layerData?.monthly?.t?.at(-1)?.slice(0, 4)}
          </span>
          {layerData?.trendMap && (
            <>
              <span className="text-orange-300">{Math.round(layerData.trendMap.sigWarmingPct)}% of area significantly warming</span>
              <span className="text-sky-300">{Math.round(layerData.trendMap.sigCoolingPct)}% significantly cooling</span>
            </>
          )}
          <span className="text-slate-500">Faded pixels: not significant (p ≥ 0.05)</span>
          <button type="button" onClick={() => onMapMode('annual')} className="ml-auto text-teal-300 hover:text-teal-200">
            Back to time-lapse →
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
          <div className="flex items-center gap-2">
            <IconButton label="Previous year" onClick={() => onStep(-1)} disabled={currentYear <= YEAR_MIN}>
              <SkipBack className="h-4 w-4" />
            </IconButton>
            <IconButton label={isPlaying ? 'Pause' : 'Play'} onClick={onTogglePlay} primary>
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </IconButton>
            <IconButton label="Next year" onClick={() => onStep(1)} disabled={currentYear >= YEAR_MAX}>
              <SkipForward className="h-4 w-4" />
            </IconButton>
          </div>

          <div className="min-w-[72px] text-center">
            <div className="text-2xl font-semibold tabular-nums text-white [text-shadow:0_0_14px_rgba(45,212,191,0.45)]">
              {currentYear}
            </div>
            <div className={`text-[10px] uppercase tracking-wider ${hasData.has(currentYear) ? 'text-teal-400' : 'text-slate-500'}`}>
              {hasData.has(currentYear) ? (partial ? 'Partial year' : 'MODIS LST') : 'No data'}
            </div>
          </div>

          <div className="order-last w-full flex-1 sm:order-none sm:w-auto">
            <div className="relative">
              <div
                className="pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-teal-400/70"
                style={{ width: `${pct}%` }}
              />
              <input
                type="range"
                min={YEAR_MIN}
                max={YEAR_MAX}
                step={1}
                value={currentYear}
                onChange={(e) => onYearChange(Number(e.target.value))}
                aria-label="Year"
                className="timeline-range relative h-5 w-full cursor-pointer"
              />
            </div>
            <div className="mt-1 flex justify-between px-[2px]">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => onYearChange(y)}
                  className={`flex w-6 flex-col items-center gap-1 text-[10px] tabular-nums transition ${
                    y === currentYear ? 'text-teal-300' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span className={`h-1 w-1 rounded-full ${hasData.has(y) ? 'bg-teal-400/80' : 'bg-slate-600'}`} />
                  <span className="hidden sm:inline">’{String(y).slice(2)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
