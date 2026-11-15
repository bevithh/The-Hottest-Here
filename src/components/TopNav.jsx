import { motion } from 'framer-motion';
import { Activity, BarChart3, Info, Satellite, Search } from 'lucide-react';
import { CITIES, CITY_ORDER } from '../data/cities.js';

const chip =
  'pointer-events-auto glass flex items-center gap-1.5 rounded-xl border border-white/10 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60';

export default function TopNav({ activeCity, onSelectCity, mobilePanel, onToggleMobilePanel, onOpenAbout, onStartTour }) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex flex-wrap items-center justify-between gap-3 p-4 lg:p-5">
      <div className="flex min-w-0 items-center gap-2">
        <div className="glass pointer-events-auto flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.45)] sm:px-4 sm:py-2.5">
          <div className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl sm:grid bg-teal-500/20 text-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.45)]">
            <Satellite className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <h1 className="whitespace-nowrap text-[15px] font-semibold tracking-tight text-white">The Thermal Divide</h1>
            <p className="hidden text-[11px] text-slate-400 sm:block">Data Heat Island trend detective</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onStartTour}
          className={`${chip} hidden h-[52px] px-3.5 text-teal-300 hover:bg-teal-500/20 md:flex`}
        >
          <Search className="h-4 w-4" /> Case file
        </button>
        <button type="button" onClick={onOpenAbout} aria-label="Methods and data sources" className={`${chip} hidden h-[52px] w-[52px] justify-center text-slate-300 hover:text-white md:flex`}>
          <Info className="h-4 w-4" />
        </button>
      </div>

      <nav
        aria-label="Select city"
        className="glass pointer-events-auto order-3 flex w-full gap-1 rounded-full border border-white/10 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.45)] sm:order-none sm:w-auto"
      >
        {CITY_ORDER.map((id) => {
          const c = CITIES[id];
          const active = id === activeCity;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectCity(id)}
              aria-pressed={active}
              className={`relative flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 sm:flex-none sm:px-4 ${
                active ? 'text-teal-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="city-pill"
                  className="absolute inset-0 rounded-full border border-teal-400/40 bg-teal-500/20 shadow-[0_0_15px_rgba(45,212,191,0.5)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">
                {c.label} <span className="hidden text-[11px] opacity-60 sm:inline">({c.region})</span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* Small screens: panel toggles + tour + info */}
      <div className="pointer-events-auto flex gap-1.5 lg:hidden">
        {[
          { id: 'impact', Icon: Activity, label: 'Impact' },
          { id: 'analytics', Icon: BarChart3, label: 'Analysis' },
        ].map(({ id, Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onToggleMobilePanel(id)}
            aria-pressed={mobilePanel === id}
            aria-label={label}
            className={`grid h-9 w-9 place-items-center rounded-xl border border-white/10 transition ${
              mobilePanel === id ? 'bg-teal-500/20 text-teal-300 shadow-[0_0_15px_rgba(45,212,191,0.5)]' : 'glass text-slate-300'
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <button type="button" onClick={onStartTour} aria-label="Case file tour" className={`${chip} h-9 w-9 justify-center text-teal-300 md:hidden`}>
          <Search className="h-4 w-4" />
        </button>
        <button type="button" onClick={onOpenAbout} aria-label="Methods and data sources" className={`${chip} h-9 w-9 justify-center text-slate-300 md:hidden`}>
          <Info className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
