// Household heat-routing model.
//
// Physical chain: data-centre waste heat (~30–40 °C) -> captured fraction ->
// heat pump lifts it to district-heating temperature (adds electricity) ->
// pipe network losses -> homes.
//
// Home heat demand uses the degree-day method:
//   annual space-heating demand (kWh) = UA (kW/K) × 24 h × HDD
// where HDD (base 18 °C) comes from MERRA-2 via NASA POWER (climate.json).
// Peak load per home = UA × (18 °C − coldest-month mean minimum).

export const NETWORK_LOSS = 0.1;
export const BOILER_EFF = 0.9;
export const GAS_KG_CO2_PER_KWH = 0.184; // natural gas combustion, per kWh of fuel
export const INDOOR_C = 18;
const HOURS = [744, 678, 744, 720, 744, 720, 744, 744, 720, 744, 720, 744];

export const HOME_TYPES = {
  apartment: { label: 'Apartment', ua: 0.15 },
  house: { label: 'House', ua: 0.25 },
  large: { label: 'Large house', ua: 0.35 },
};
const AVG_UA = 0.25;

const toRad = (d) => (d * Math.PI) / 180;
function distanceKm([lat1, lon1], [lat2, lon2]) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Per-kWh-of-delivered-heat carbon balance (positive = saving). */
export function carbonPerKWh(cop, gridKg) {
  const gasAvoided = GAS_KG_CO2_PER_KWH / BOILER_EFF;
  const elecUsed = (1 / (1 - NETWORK_LOSS) / cop) * gridKg;
  return gasAvoided - elecUsed;
}

/** COP above which routing saves CO2 on this grid. */
export function breakEvenCop(gridKg) {
  return (gridKg * BOILER_EFF) / ((1 - NETWORK_LOSS) * GAS_KG_CO2_PER_KWH);
}

export function simulate({ city, climate, capture, cop, gridKg }) {
  if (!climate) return null;
  const waste = city.output.wasteHeatMW;
  const capturedMW = waste * capture;
  const deliveredMW = capturedMW * (cop / (cop - 1)) * (1 - NETWORK_LOSS);
  const hpElecMW = capturedMW / (cop - 1);

  const designTempC = climate.coldestMonthMeanMinC;
  const peakKWPerHome = AVG_UA * (INDOOR_C - designTempC);
  const homesAtPeak = Math.floor((deliveredMW * 1000) / peakKWPerHome);
  const demandKWhPerHome = AVG_UA * 24 * climate.heatingDegreeDays;

  // Connect zones nearest-first (shorter pipes are cheaper)
  let remaining = homesAtPeak;
  const zones = city.residential
    .map((z) => ({ ...z, km: distanceKm(city.dataCenter.coords, z.coords) }))
    .sort((a, b) => a.km - b.km)
    .map((z) => {
      const served = Math.max(0, Math.min(z.households, remaining));
      remaining -= served;
      return { ...z, served, coverage: served / z.households };
    });
  const totalHouseholds = zones.reduce((s, z) => s + z.households, 0);
  const connected = zones.reduce((s, z) => s + z.served, 0);

  // Monthly balance for the connected homes (GWh)
  const monthly = climate.monthlyHDD.map((hdd, i) => {
    const demand = (connected * AVG_UA * 24 * hdd) / 1e6;
    const supply = (deliveredMW * HOURS[i]) / 1000;
    return { month: i, demand, supply, used: Math.min(demand, supply) };
  });
  const annualDemandGWh = monthly.reduce((s, m) => s + m.demand, 0);
  const annualUsedGWh = monthly.reduce((s, m) => s + m.used, 0);
  const annualSupplyGWh = monthly.reduce((s, m) => s + m.supply, 0);

  const kgPerKWh = carbonPerKWh(cop, gridKg);
  const co2Tonnes = (annualUsedGWh * 1e6 * kgPerKWh) / 1000;

  return {
    capturedMW,
    deliveredMW,
    hpElecMW,
    designTempC,
    peakKWPerHome,
    homesAtPeak,
    demandKWhPerHome,
    zones,
    totalHouseholds,
    connected,
    spareHomes: Math.max(0, homesAtPeak - connected),
    monthly,
    annualDemandGWh,
    annualUsedGWh,
    annualSupplyGWh,
    utilisation: annualSupplyGWh > 0 ? annualUsedGWh / annualSupplyGWh : 0,
    kgPerKWh,
    co2Tonnes,
    breakEvenCop: breakEvenCop(gridKg),
  };
}

/**
 * Annual space-heating bill for one home: gas boiler today vs. heat from the
 * data-centre network. Heat price = electricity for the heat pump (price / COP)
 * + a network charge. Usage charges only: standing/supply charges are left out
 * (dropping gas would also save the gas supply charge, so this is conservative).
 */
export function homeBill({ ua, climate, energy, cop, networkCharge }) {
  const demand = ua * 24 * climate.heatingDegreeDays;
  const before = (demand / BOILER_EFF) * energy.gasPricePerKWh;
  const heatPrice = energy.elecPricePerKWh / cop + networkCharge;
  const after = demand * heatPrice;
  return { demand, before, after, heatPrice, saving: before - after, savingPct: (before - after) / before };
}
