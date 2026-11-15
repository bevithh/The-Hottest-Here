import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Factory,
  Flame,
  FlaskConical,
  Home,
  Leaf,
  Play,
  Snowflake,
  Thermometer,
  Users,
  Wind,
} from 'lucide-react';
import SidePanel, { IllustrativeTag } from './SidePanel.jsx';
import MonthlyBalanceChart from './charts/MonthlyBalanceChart.jsx';
import { HOME_TYPES, homeBill } from '../lib/household.js';
import { CITIES, CITY_ORDER } from '../data/cities.js';
import { fmtInt, fmtP, money, MONTH_NAMES, signed } from '../lib/format.js';

function Metric({ Icon, label, value, sub, accent = 'text-white' }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2.5 text-sm text-slate-400">
        <Icon className="h-4 w-4 shrink-0 text-slate-500" />
        <span>
          {label}
          {sub && <span className="block text-[10px] text-slate-500">{sub}</span>}
        </span>
      </div>
      <div className={`text-sm font-semibold tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, display, hint }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold tabular-nums text-teal-300">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="timeline-range mt-1 h-5 w-full cursor-pointer"
      />
      {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
    </label>
  );
}

const demandLevel = (hdd) =>
  hdd >= 2500
    ? ['Critical', 'text-orange-400 bg-orange-500/15 border-orange-400/30 shadow-[0_0_12px_rgba(251,146,60,0.35)]']
    : hdd >= 1500
      ? ['Elevated', 'text-amber-300 bg-amber-500/10 border-amber-300/30']
      : ['Moderate', 'text-slate-300 bg-slate-500/10 border-slate-400/30'];

function WinterTab({ city, climate, onOpenTrend }) {
  if (!climate) return <p className="text-sm text-slate-400">Loading MERRA-2 climate data…</p>;
  const [level, levelCls] = demandLevel(climate.heatingDegreeDays);
  const ht = climate.hddTrend;
  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Data Center Output</h3>
          {city.output.illustrative && <IllustrativeTag />}
        </div>
        <div className="rounded-xl border border-teal-400/20 bg-teal-500/10 p-4 shadow-[inset_0_0_20px_rgba(45,212,191,0.08)]">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Flame className="h-3.5 w-3.5 text-teal-400" /> Current waste heat
          </div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-teal-300 [text-shadow:0_0_18px_rgba(45,212,191,0.55)]">
            {fmtInt(city.output.wasteHeatMW)}
            <span className="ml-1 text-base font-medium text-teal-400/80">MW</span>
          </div>
        </div>
        <Metric Icon={Factory} label="Facilities in cluster" value={fmtInt(city.output.facilities)} />
        <p className="mt-2 rounded-lg bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
          Worldwide, data centres used <span className="text-white">415 TWh</span> of electricity in 2024 (1.5% of the total). The
          IEA expects about <span className="text-orange-300">945 TWh by 2030</span>. Nearly all of it ends up as heat.
        </p>
        {city.realWorld && (
          <p className="mt-2 rounded-lg border border-teal-400/20 bg-teal-500/10 px-3 py-2 text-[11px] leading-relaxed text-teal-100">
            {city.realWorld}
          </p>
        )}
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <section>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Winter Extremes</h3>
          <span className="rounded-full border border-teal-400/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-300">
            MERRA-2
          </span>
        </div>
        <div className="divide-y divide-white/5">
          <Metric
            Icon={Thermometer}
            label="Lowest temp"
            sub={`${MONTH_NAMES[Number(climate.lowestTempWhen.slice(5)) - 1]} ${climate.lowestTempWhen.slice(0, 4)}`}
            value={`${climate.lowestTempC.toFixed(1)}°C`}
            accent="text-sky-300"
          />
          <Metric Icon={Snowflake} label="Avg winter temp" sub={`${climate.recentPeriod.join('–')}`} value={`${climate.avgWinterTempC.toFixed(1)}°C`} />
          <Metric
            Icon={Wind}
            label="Winter-night wind chill"
            sub={`${MONTH_NAMES[climate.coldestMonth - 1]} lows, ${climate.winterWindMs.toFixed(1)} m/s wind`}
            value={`${climate.windChillC.toFixed(1)}°C`}
            accent="text-sky-300"
          />
          <Metric Icon={Flame} label="Heating degree-days" sub="per year, base 18 °C" value={fmtInt(climate.heatingDegreeDays)} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-slate-400">Heating demand</span>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${levelCls}`}>{level}</span>
        </div>
        {ht && (
          <button
            type="button"
            onClick={() => onOpenTrend('hdd')}
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-slate-300 transition hover:bg-white/10"
          >
            <span className="flex items-center gap-2">
              <FlaskConical className="h-3.5 w-3.5 text-teal-400" />
              Heating need trend since {climate.period[0]}
            </span>
            <span className="tabular-nums text-slate-400">
              {signed(ht.senSlopePerYear * 10, 0)}/dec · {fmtP(ht.mkP)}
            </span>
          </button>
        )}
        <p className="mt-3 text-[11px] text-slate-500">Source: {climate.source}</p>
      </section>
    </div>
  );
}

function CityCompare({ climateAll, params, activeId }) {
  const rows = CITY_ORDER.map((id) => {
    const c = CITIES[id];
    const clim = climateAll?.[id];
    if (!clim) return null;
    return {
      id,
      label: c.label,
      currency: c.energy.currency,
      ...homeBill({ ua: HOME_TYPES[params.homeType].ua, climate: clim, energy: c.energy, cop: params.cop, networkCharge: params.networkCharge }),
    };
  }).filter(Boolean);
  if (!rows.length) return null;
  const maxPct = Math.max(...rows.map((r) => Math.abs(r.savingPct)), 0.01);
  return (
    <section>
      <h3 className="mb-1 text-sm font-medium text-white">Yearly heating bill, three cities</h3>
      <p className="mb-2 text-[11px] text-slate-500">
        {HOME_TYPES[params.homeType].label}, COP {params.cop.toFixed(1)}, local currency, real gas and electricity prices.
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
            <th className="pb-1 font-medium">City</th>
            <th className="pb-1 text-right font-medium">Gas today</th>
            <th className="pb-1 text-right font-medium">Waste heat</th>
            <th className="pb-1 text-right font-medium">Saving</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={`border-t border-white/5 ${r.id === activeId ? 'text-white' : 'text-slate-300'}`}>
              <td className="py-1.5 font-medium">{r.label}</td>
              <td className="py-1.5 text-right tabular-nums">{money(r.before, r.currency)}</td>
              <td className="py-1.5 text-right tabular-nums">{money(r.after, r.currency)}</td>
              <td className="py-1.5 text-right">
                <div className={`tabular-nums font-semibold ${r.saving >= 0 ? 'text-teal-300' : 'text-orange-300'}`}>
                  {r.saving >= 0 ? '' : '−'}
                  {money(Math.abs(r.saving), r.currency)}
                </div>
                <div className="ml-auto mt-0.5 h-1 w-16 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${r.saving >= 0 ? 'bg-teal-400' : 'bg-orange-400'}`}
                    style={{ width: `${(Math.abs(r.savingPct) / maxPct) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] tabular-nums text-slate-500">{Math.round(r.savingPct * 100)}%</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function HouseholdsTab({ city, climate, climateAll, sim, params, setters, isSimulating, onToggleSimulate, selectedZone, onSelectZone }) {
  if (!sim || !climate) return <p className="text-sm text-slate-400">Loading…</p>;
  const { energy } = city;
  const bill = homeBill({ ua: HOME_TYPES[params.homeType].ua, climate, energy, cop: params.cop, networkCharge: params.networkCharge });
  const homeCo2 = (bill.demand * sim.kgPerKWh) / 1000;
  const co2Good = sim.co2Tonnes >= 0;

  return (
    <div className="space-y-5">
      {!isSimulating && (
        <button
          type="button"
          onClick={onToggleSimulate}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal-400/50 bg-teal-500/20 px-4 py-2.5 text-sm font-semibold text-teal-300 shadow-[0_0_15px_rgba(45,212,191,0.5)] hover:bg-teal-500/30"
        >
          <Play className="h-4 w-4" /> Route heat to these neighbourhoods
        </button>
      )}

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-teal-400/20 bg-teal-500/10 p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Home className="h-3 w-3 text-teal-400" /> Homes heated
          </div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums text-teal-300">{fmtInt(sim.connected)}</div>
          <div className="text-[10px] text-slate-500">of {fmtInt(sim.totalHouseholds)} nearby</div>
        </div>
        <div className={`rounded-xl border p-3 ${co2Good ? 'border-emerald-400/20 bg-emerald-500/10' : 'border-orange-400/30 bg-orange-500/10'}`}>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Leaf className={`h-3 w-3 ${co2Good ? 'text-emerald-400' : 'text-orange-400'}`} /> CO₂ avoided
          </div>
          <div className={`mt-0.5 text-xl font-semibold tabular-nums ${co2Good ? 'text-emerald-300' : 'text-orange-300'}`}>
            {signed(sim.co2Tonnes / 1000, 1)}k t
          </div>
          <div className="text-[10px] text-slate-500">per year vs. gas boilers</div>
        </div>
      </div>
      {!co2Good && (
        <p className="-mt-3 rounded-lg bg-orange-500/10 px-3 py-2 text-[11px] leading-relaxed text-orange-200">
          On the {energy.gridLabel} the heat pump’s electricity emits more CO₂ than the gas it replaces. Routing becomes a
          carbon win at COP ≥ {sim.breakEvenCop.toFixed(1)}, or as the grid gets cleaner. Try the sliders.
        </p>
      )}

      {/* Controls */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Routing scenario</h3>
          <IllustrativeTag />
        </div>
        <Slider
          label="Waste heat captured"
          value={params.capture}
          min={0.1}
          max={0.9}
          step={0.05}
          onChange={setters.setCapture}
          display={`${Math.round(params.capture * 100)}% · ${fmtInt(sim.capturedMW)} MW`}
        />
        <Slider
          label="Heat-pump efficiency (COP)"
          value={params.cop}
          min={2}
          max={6}
          step={0.1}
          onChange={setters.setCop}
          display={params.cop.toFixed(1)}
          hint={`Lifts ~35 °C server heat to district-heating temperature → ${fmtInt(sim.deliveredMW)} MW delivered`}
        />
        <Slider
          label="Grid carbon intensity"
          value={params.gridKg}
          min={0}
          max={1}
          step={0.01}
          onChange={setters.setGridKg}
          display={`${params.gridKg.toFixed(2)} kg/kWh`}
          hint={`${energy.gridLabel} today ≈ ${energy.gridKgCO2PerKWh} kg/kWh (illustrative)`}
        />
        <Slider
          label="Heat-network charge"
          value={params.networkCharge}
          min={0}
          max={0.08}
          step={0.005}
          onChange={setters.setNetworkCharge}
          display={`${params.networkCharge.toFixed(3)} per kWh`}
          hint="Pipes, maintenance and margin on top of heat-pump electricity (illustrative)"
        />
      </section>

      {/* Monthly balance */}
      <section>
        <h3 className="mb-2 text-sm font-medium text-white">Heat through the year</h3>
        <MonthlyBalanceChart monthly={sim.monthly} />
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          Demand from MERRA-2 heating degree-days. {Math.round(sim.utilisation * 100)}% of routable heat is used; the summer
          surplus could supply hot water or {sim.spareHomes > 0 ? `${fmtInt(sim.spareHomes)} more homes` : 'storage'}.
        </p>
      </section>

      {/* Zones */}
      <section>
        <h3 className="mb-2 text-sm font-medium text-white">Neighbourhoods (nearest first)</h3>
        <ul className="space-y-1.5">
          {sim.zones.map((z) => (
            <li key={z.name}>
              <button
                type="button"
                onClick={() => onSelectZone(z.name === selectedZone ? null : z.name)}
                aria-pressed={selectedZone === z.name}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  selectedZone === z.name ? 'border-teal-400/50 bg-teal-500/10' : 'border-white/5 bg-black/20 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-white">{z.name}</span>
                  <span className="tabular-nums text-slate-400">
                    {z.km.toFixed(1)} km · {fmtInt(z.households)} homes
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-teal-400" style={{ width: `${z.coverage * 100}%` }} />
                </div>
                <div className="mt-1 text-[10px] tabular-nums text-slate-500">{Math.round(z.coverage * 100)}% heated by waste heat</div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* My home */}
      <section className="rounded-xl border border-white/10 bg-black/20 p-3.5">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
          <Users className="h-4 w-4 text-teal-400" /> What it means for one home
        </div>
        <div className="mb-3 flex gap-1 rounded-lg bg-black/20 p-1">
          {Object.entries(HOME_TYPES).map(([k, h]) => (
            <button
              key={k}
              type="button"
              onClick={() => setters.setHomeType(k)}
              aria-pressed={params.homeType === k}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                params.homeType === k ? 'bg-teal-500/20 text-teal-200' : 'text-slate-400 hover:text-white'
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-slate-500">Heating need</div>
            <div className="font-semibold tabular-nums text-white">{fmtInt(bill.demand)} kWh/yr</div>
          </div>
          <div>
            <div className="text-slate-500">CO₂ change</div>
            <div className={`font-semibold tabular-nums ${homeCo2 >= 0 ? 'text-emerald-300' : 'text-orange-300'}`}>
              {homeCo2 >= 0 ? '−' : '+'}
              {Math.abs(homeCo2).toFixed(2)} t/yr
            </div>
          </div>
          <div>
            <div className="text-slate-500">Gas bill today</div>
            <div className="font-semibold tabular-nums text-white">{money(bill.before, energy.currency)}</div>
          </div>
          <div>
            <div className="text-slate-500">With heat network</div>
            <div className="font-semibold tabular-nums text-teal-300">{money(bill.after, energy.currency)}</div>
          </div>
        </div>
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-center text-sm font-semibold ${
            bill.saving >= 0 ? 'bg-teal-500/10 text-teal-200' : 'bg-orange-500/10 text-orange-200'
          }`}
        >
          {bill.saving >= 0
            ? `Saves ${money(bill.saving, energy.currency)} a year (${Math.round(bill.savingPct * 100)}%)`
            : `Costs ${money(-bill.saving, energy.currency)} more a year`}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
          Gas: {energy.gasSource}. Heat-pump electricity: {energy.elecSource}. Usage charges only; dropping gas also saves the
          gas supply charge.
        </p>
      </section>

      <CityCompare climateAll={climateAll} params={params} activeId={city.id} />

      <p className="text-[10px] leading-relaxed text-slate-500">
        Model: degree-day method (UA × 24 h × HDD), peak sized at the coldest month’s mean low ({sim.designTempC.toFixed(1)}°C),
        10% network loss, 90% gas boiler, gas 0.184 kg CO₂/kWh. Gas and electricity prices are real (sources above); grid
        intensity, network charge, waste-heat output and household counts are illustrative.
      </p>
    </div>
  );
}

export default function ImpactWidget(props) {
  const { city, tab, onTab, mobileOpen } = props;
  return (
    <SidePanel side="left" title="Impact Scorecard" Icon={Activity} mobileOpen={mobileOpen}>
      <div className="mb-4 flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1" role="tablist">
        {[
          ['winter', 'Winter need'],
          ['households', 'Households'],
        ].map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => onTab(k)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === k ? 'bg-teal-500/20 text-teal-200 shadow-[0_0_12px_rgba(45,212,191,0.3)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${city.id}-${tab}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'winter' ? <WinterTab {...props} /> : <HouseholdsTab {...props} />}
        </motion.div>
      </AnimatePresence>
    </SidePanel>
  );
}
