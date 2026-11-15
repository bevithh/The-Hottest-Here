import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';

const SOURCES = [
  {
    name: 'MODIS/Terra Land Surface Temperature/Emissivity 8-Day L3 Global 1 km (MOD11A2 v061)',
    detail: 'Wan, Z., Hook, S., Hulley, G. (2021). NASA LP DAAC. doi:10.5067/MODIS/MOD11A2.061',
    via: 'Extracted with AppEEARS (NASA LP DAAC), area sample, GeoTIFF',
  },
  {
    name: 'MERRA-2 reanalysis: 2 m air temperature (mean / min), 2 m wind speed',
    detail: 'Gelaro, R. et al. (2017), J. Climate. GMAO, NASA GSFC.',
    via: 'Monthly point data via the NASA POWER API (power.larc.nasa.gov)',
  },
  {
    name: 'Energy prices (household bill comparison)',
    detail:
      'Melbourne: AGL Victorian gas standing offer (Jul 2025) and Victorian Default Offer small-business electricity. Ashburn: EIA Virginia residential gas 2025 ($16.79/Mcf) and average retail electricity (10.62 ¢/kWh). Dublin: SEAI Domestic Fuel Cost Comparison, H1 2026 (gas 11.83 c/kWh, electricity 29.33 c/kWh).',
    via: 'Not NASA data; used for the household simulator only',
  },
  {
    name: 'Global data-centre electricity',
    detail: 'IEA (2025), Energy and AI: 415 TWh in 2024 (1.5% of world electricity), ~945 TWh by 2030.',
    via: 'Context figure; Tallaght District Heating Scheme figures from Codema',
  },
  {
    name: 'Basemap',
    detail: 'Esri World Dark Gray Canvas. Esri, HERE, Garmin, © OpenStreetMap contributors.',
    via: 'Not NASA data; used for geographic context only',
  },
];

const METHOD = [
  ['Quality control', 'MODIS pixels kept only when the QA flag is “good quality”, or “other quality” with an LST error ≤ 2 K.'],
  ['Target vs. baseline', 'Target zone = 1 km pixels within 2.5 km of the data-centre point. Baseline = pixels 5–10 km from the same point; the 2.5–5 km buffer keeps heat spilling off the site out of the baseline. Pixels that are nodata or fail QC are left out of each composite.'],
  ['Seasonal heat island gap', 'Mean target − baseline gap for local summer and winter (Dec–Feb / Jun–Aug, by hemisphere) and full years. Each season-year counts once, because consecutive 8-day composites are not independent; 95 % Student-t confidence interval and a t-test against zero.'],
  ['Yearly significance', 'Paired t-test of (target − baseline) across the year’s 8-day composites.'],
  ['Trend', 'Monthly means → subtract each calendar month’s average (deseasonalize) → Mann-Kendall test with lag-1 autocorrelation variance correction; rate = Sen’s slope with 95 % CI; ordinary least squares t-test for comparison.'],
  ['Before / after opening', 'Melbourne only: seasonal and yearly gaps entirely before NEXTDC M3 opened (20 Oct 2022) vs entirely after, compared with a Welch two-sample t-test. Seasons or years that span the opening date are left out. Only three full years since opening, so the test has little power.'],
  ['Trend map', 'The same test on every 1 km pixel. Faded = p ≥ 0.05.'],
  ['Household model', 'Degree-day method (UA × 24 h × HDD) with MERRA-2 heating degree-days; heat pump COP, 10 % network loss, 90 % gas boiler, gas 0.184 kg CO₂/kWh.'],
];

const LIMITS = [
  'Terra’s overpass time has drifted earlier since 2020, which biases absolute daytime LST colder and night-time LST warmer. The target-minus-baseline gap is largely immune to this; absolute trends are not.',
  'Each city’s extract is ≈22–23 km across and centred on the data-centre site, so the full 5–10 km baseline ring (98–100 %) lies inside it. A ring still mixes land covers (farmland, suburbs, industry, water edges), so the baseline is “the surrounding area”, not a pristine reference.',
  'A gap shows association, not causation: roofs, car parks, roads and other industry heat surfaces too, and one 1 km pixel is far coarser than one building.',
  'LST measures the skin temperature of surfaces, not air temperature. Roofs and car parks heat up regardless of servers; land-cover change near the target can also contribute to the gap.',
  'Data-centre waste-heat output, household counts, grid carbon intensity and the heat-network charge are illustrative placeholders. Gas and electricity prices are real but use usage charges only.',
  'Projections (“if it continues”) carry today’s Sen’s slope forward in a straight line; they are what-ifs, not forecasts.',
];

export default function AboutModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[1500] grid place-items-center bg-slate-950/70 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.97, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Methods and data sources"
            className="max-h-full w-full max-w-[640px] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Methods & data sources</h2>
                <p className="text-xs text-slate-400">The Thermal Divide · NASA Space Apps 2026 · “Be an Earth System Trend Detective”</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-300">Data</h3>
            <ul className="mb-5 space-y-2.5">
              {SOURCES.map((s) => (
                <li key={s.name} className="text-sm">
                  <div className="font-medium text-white">{s.name}</div>
                  <div className="text-xs text-slate-400">{s.detail}</div>
                  <div className="text-xs text-slate-500">{s.via}</div>
                </li>
              ))}
            </ul>

            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-300">Method</h3>
            <dl className="mb-5 space-y-2 text-sm">
              {METHOD.map(([k, v]) => (
                <div key={k}>
                  <dt className="font-medium text-white">{k}</dt>
                  <dd className="text-xs leading-relaxed text-slate-400">{v}</dd>
                </div>
              ))}
            </dl>

            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Limitations</h3>
            <ul className="mb-5 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-slate-400">
              {LIMITS.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>

            <p className="border-t border-white/10 pt-4 text-[11px] leading-relaxed text-slate-500">
              This is an independent hackathon project. It is not affiliated with or endorsed by NASA. NASA does not endorse any
              non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
