import EMBEDDED_OVERLAYS from 'virtual:overlays';
// City configuration.
//
// MEASURED data is bundled into the app:
//   src/data/manifest.json  <- build_overlays.py (MODIS LST via AppEEARS)
//   src/data/climate.json   <- fetch_climate.py  (MERRA-2 via NASA POWER)
//
// Everything below that is NOT measured is a placeholder: data-centre output,
// residential household counts, grid carbon intensity and the heat-network charge.
// Gas and electricity prices are sourced (see comments on each city).

export const YEAR_MIN = 2016;
export const YEAR_MAX = 2026;
export const PLAYBACK_MS = 800;

export const CITIES = {
  melbourne: {
    id: 'melbourne',
    label: 'Melbourne',
    region: 'AU',
    center: [-37.8, 144.76],
    zoom: 12,
    bounds: [
      [-37.8667, 144.675],
      [-37.7333, 144.825],
    ],
    dataCenter: { name: 'Western suburbs DC cluster', coords: [-37.8, 144.75] },
    // households: illustrative dwelling counts
    residential: [
      { name: 'Deer Park', coords: [-37.767, 144.772], households: 6200 },
      { name: 'Sunshine', coords: [-37.788, 144.832], households: 4300 },
      { name: 'St Albans', coords: [-37.745, 144.8], households: 13000 },
      { name: 'Altona North', coords: [-37.836, 144.847], households: 5000 },
    ],
    output: { illustrative: true, wasteHeatMW: 150, facilities: 12 },
    realWorld: null,
    energy: {
      currency: 'AUD',
      // AGL Victorian standing offer (Multinet, from 1 Jul 2025): ~$2,660/yr at 159 MJ/day incl. $1.04/day supply
      // -> ~3.9 c/MJ = $0.141/kWh effective usage rate, incl. GST
      gasPricePerKWh: 0.141,
      gasSource: 'AGL Victorian standing offer, Jul 2025 (≈3.9 c/MJ)',
      // Victorian Default Offer small-business flat rate, Powercor zone (western suburbs), incl. GST
      elecPricePerKWh: 0.293,
      elecSource: 'Victorian Default Offer, small business, Powercor',
      networkChargePerKWh: 0.02, // illustrative pipe-network + operating charge
      gridKgCO2PerKWh: 0.75, // illustrative: Victoria's brown-coal heavy grid
      gridLabel: 'Victoria grid',
    },
  },
  ashburn: {
    id: 'ashburn',
    label: 'Ashburn',
    region: 'VA',
    center: [39.03, -77.49],
    zoom: 12,
    bounds: [
      [38.98, -77.56],
      [39.1, -77.42],
    ],
    dataCenter: { name: 'Data Center Alley', coords: [39.0438, -77.4874] },
    residential: [
      { name: 'Ashburn Farm', coords: [39.031, -77.465], households: 9000 },
      { name: 'Broadlands', coords: [39.005, -77.513], households: 4500 },
      { name: 'Lansdowne', coords: [39.083, -77.483], households: 4000 },
      { name: 'Brambleton', coords: [38.983, -77.538], households: 7000 },
    ],
    output: { illustrative: true, wasteHeatMW: 2400, facilities: 140 },
    realWorld: null,
    energy: {
      currency: 'USD',
      // EIA: Virginia residential natural gas 2025 = $16.79 per Mcf; 1 Mcf ≈ 1.038 MMBtu ≈ 304 kWh
      gasPricePerKWh: 0.0552,
      gasSource: 'EIA, Virginia residential gas 2025 ($16.79/Mcf)',
      // EIA Virginia state profile: average retail electricity price 10.62 ¢/kWh
      elecPricePerKWh: 0.1062,
      elecSource: 'EIA, Virginia average retail electricity',
      networkChargePerKWh: 0.02,
      gridKgCO2PerKWh: 0.3,
      gridLabel: 'Virginia grid',
    },
  },
  dublin: {
    id: 'dublin',
    label: 'Dublin',
    region: 'IE',
    center: [53.33, -6.4],
    zoom: 12,
    bounds: [
      [53.27, -6.5],
      [53.4, -6.3],
    ],
    dataCenter: { name: 'Grange Castle / Clondalkin', coords: [53.3197, -6.4247] },
    residential: [
      { name: 'Clondalkin', coords: [53.32, -6.395], households: 17000 },
      { name: 'Lucan', coords: [53.357, -6.448], households: 17000 },
      { name: 'Ballyfermot', coords: [53.343, -6.356], households: 8000 },
      { name: 'Tallaght', coords: [53.287, -6.373], households: 28000 },
    ],
    output: { illustrative: true, wasteHeatMW: 900, facilities: 80 },
    realWorld:
      'Already happening: since 2023 the Tallaght District Heating Scheme has heated public buildings with waste heat from an Amazon data centre, saving over 1,400 t CO₂ in 2025 (Codema).',
    energy: {
      currency: 'EUR',
      // SEAI Domestic Fuel Cost Comparison (S1 2026, VAT incl.): gas Band D2 11.83 c/kWh
      gasPricePerKWh: 0.1183,
      gasSource: 'SEAI, household gas Band D2, H1 2026',
      // SEAI: electricity Band DE (≥15,000 kWh) 29.33 c/kWh; conservative (a large plant would pay less)
      elecPricePerKWh: 0.2933,
      elecSource: 'SEAI, electricity Band DE, H1 2026',
      networkChargePerKWh: 0.02,
      gridKgCO2PerKWh: 0.28,
      gridLabel: 'Irish grid',
    },
  },
};

export const CITY_ORDER = ['melbourne', 'ashburn', 'dublin'];

export const LAYER_LABELS = { day: 'Day', night: 'Night' };

// Relative paths (no leading slash) so they resolve both on the dev server and from file://
// Offline build embeds every overlay as a data URI (see vite.config.js); otherwise load from public/
const resolveOverlay = (rel) => EMBEDDED_OVERLAYS[rel] ?? rel;

export const overlayUrl = (cityId, year, layer = 'day') =>
  resolveOverlay(
    layer === 'day' ? `presentation_pngs/${cityId}/${year}.png` : `presentation_pngs/${cityId}/${layer}/${year}.png`,
  );

export const trendMapUrl = (cityId, layer = 'day') => resolveOverlay(`presentation_pngs/${cityId}/trend_${layer}.png`);
