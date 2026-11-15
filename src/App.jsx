import { useCallback, useEffect, useMemo, useState } from 'react';
import HeatMap from './components/HeatMap.jsx';
import TopNav from './components/TopNav.jsx';
import ImpactWidget from './components/ImpactWidget.jsx';
import AnalyticsWidget from './components/AnalyticsWidget.jsx';
import TimelineSlider from './components/TimelineSlider.jsx';
import TrendLab from './components/TrendLab.jsx';
import AboutModal from './components/AboutModal.jsx';
import CaseFileTour, { runTourStep } from './components/CaseFileTour.jsx';
import { CITIES, PLAYBACK_MS, YEAR_MAX, YEAR_MIN, overlayUrl } from './data/cities.js';
import { simulate } from './lib/household.js';
import manifestData from './data/manifest.json';
import climateData from './data/climate.json';

export default function App() {
  // ---- core state
  const [activeCity, setActiveCity] = useState('melbourne');
  const [currentYear, setCurrentYear] = useState(YEAR_MIN);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // ---- analysis / view state
  const [layer, setLayer] = useState('day'); // 'day' | 'night' (MODIS overpass)
  const [mapMode, setMapMode] = useState('annual'); // 'annual' | 'trend'
  const [trendLabOpen, setTrendLabOpen] = useState(false);
  const [trendSeries, setTrendSeries] = useState('gap'); // gap | target | baseline | air | hdd
  const [leftTab, setLeftTab] = useState('winter'); // winter | households
  const [mobilePanel, setMobilePanel] = useState(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [tourStep, setTourStep] = useState(null);

  // ---- household simulator
  const [capture, setCapture] = useState(0.5);
  const [cop, setCop] = useState(3.5);
  const [gridKg, setGridKg] = useState(CITIES.melbourne.energy.gridKgCO2PerKWh);
  const [homeType, setHomeType] = useState('house');
  const [networkCharge, setNetworkCharge] = useState(0.02);
  const [selectedZone, setSelectedZone] = useState(null);

  // ---- data
  // Data is bundled at build time (not fetched) so the app also runs offline from file://
  const manifest = manifestData;
  const climateAll = climateData;

  const cityData = manifest[activeCity];
  const layerData = cityData?.layers?.[layer] ?? null;
  const climate = climateAll[activeCity] ?? null;

  const city = useMemo(() => {
    const base = CITIES[activeCity];
    if (!cityData) return base;
    return { ...base, center: cityData.target, bounds: cityData.bounds, dataCenter: { ...base.dataCenter, name: cityData.targetName ?? base.dataCenter.name, coords: cityData.target } };
  }, [activeCity, cityData]);

  const availableYears = useMemo(
    () =>
      Object.keys(layerData?.years ?? {})
        .map(Number)
        .filter((y) => y >= YEAR_MIN && y <= YEAR_MAX),
    [layerData],
  );
  const yearStats = layerData?.years?.[currentYear] ?? null;

  const sim = useMemo(
    () => simulate({ city, climate, capture, cop, gridKg }),
    [city, climate, capture, cop, gridKg],
  );

  // Preload overlays for flicker-free playback
  useEffect(() => {
    availableYears.forEach((y) => {
      const img = new Image();
      img.src = overlayUrl(activeCity, y, layer);
    });
  }, [activeCity, availableYears, layer]);

  // Timeline playback
  useEffect(() => {
    if (!isPlaying) return undefined;
    const id = setInterval(() => setCurrentYear((y) => (y >= YEAR_MAX ? YEAR_MIN : y + 1)), PLAYBACK_MS);
    return () => clearInterval(id);
  }, [isPlaying]);

  const stepYear = useCallback((dir) => {
    setIsPlaying(false);
    setCurrentYear((y) => Math.min(YEAR_MAX, Math.max(YEAR_MIN, y + dir)));
  }, []);

  const selectCity = useCallback((id) => {
    setActiveCity(id);
    setIsSimulating(false);
    setSelectedZone(null);
    setGridKg(CITIES[id].energy.gridKgCO2PerKWh);
  }, []);

  const toggleSimulate = useCallback(() => {
    setIsSimulating((s) => {
      if (!s) setLeftTab('households');
      return !s;
    });
  }, []);

  const setMode = useCallback((m) => {
    setMapMode(m);
    if (m === 'trend') setIsPlaying(false);
  }, []);

  // Actions the guided tour can trigger
  const tourActions = {
    setCity: selectCity,
    setLayer,
    setMapMode: setMode,
    setYear: setCurrentYear,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    openTrendLab: (series) => {
      if (series) setTrendSeries(series);
      setTrendLabOpen(true);
    },
    closeTrendLab: () => setTrendLabOpen(false),
    simulate: (on) => {
      setIsSimulating(on);
      if (on) setLeftTab('households');
    },
    setLeftTab,
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950 text-white">
      <HeatMap
        city={city}
        currentYear={currentYear}
        layer={layer}
        mapMode={mapMode}
        hasOverlay={Boolean(yearStats)}
        hasTrendMap={Boolean(layerData?.trendMap?.pixels)}
        isSimulating={isSimulating}
        sim={sim}
        selectedZone={selectedZone}
        onSelectZone={(name) => {
          setSelectedZone(name);
          setLeftTab('households');
        }}
        targetRadiusKm={cityData?.targetRadiusKm}
      />

      <TopNav
        activeCity={activeCity}
        onSelectCity={selectCity}
        mobilePanel={mobilePanel}
        onToggleMobilePanel={(p) => setMobilePanel((cur) => (cur === p ? null : p))}
        onOpenAbout={() => setAboutOpen(true)}
        onStartTour={() => {
          runTourStep(0, tourActions);
          setTourStep(0);
        }}
      />

      <ImpactWidget
        city={city}
        climate={climate}
        tab={leftTab}
        onTab={setLeftTab}
        sim={sim}
        climateAll={climateAll}
        params={{ capture, cop, gridKg, homeType, networkCharge }}
        setters={{ setCapture, setCop, setGridKg, setHomeType, setNetworkCharge }}
        isSimulating={isSimulating}
        onToggleSimulate={toggleSimulate}
        selectedZone={selectedZone}
        onSelectZone={setSelectedZone}
        onOpenTrend={(s) => {
          setTrendSeries(s);
          setTrendLabOpen(true);
        }}
        mobileOpen={mobilePanel === 'impact'}
      />

      <AnalyticsWidget
        city={city}
        cityData={cityData}
        layer={layer}
        layerData={layerData}
        currentYear={currentYear}
        yearStats={yearStats}
        isSimulating={isSimulating}
        onToggleSimulate={toggleSimulate}
        onOpenTrendLab={() => {
          setTrendSeries('gap');
          setTrendLabOpen(true);
        }}
        mobileOpen={mobilePanel === 'analytics'}
      />

      <TrendLab
        open={trendLabOpen}
        onClose={() => setTrendLabOpen(false)}
        series={trendSeries}
        onSeries={setTrendSeries}
        layer={layer}
        onLayer={setLayer}
        layerData={layerData}
        climate={climate}
        city={city}
      />

      <TimelineSlider
        currentYear={currentYear}
        onYearChange={(y) => {
          setIsPlaying(false);
          setCurrentYear(y);
        }}
        isPlaying={isPlaying}
        onTogglePlay={() => {
          if (mapMode === 'trend') setMapMode('annual');
          setIsPlaying((p) => !p);
        }}
        onStep={stepYear}
        availableYears={availableYears}
        layer={layer}
        onLayer={setLayer}
        mapMode={mapMode}
        onMapMode={setMode}
        layerData={layerData}
      />

      <CaseFileTour step={tourStep} onStep={setTourStep} actions={tourActions} layerData={cityData?.layers} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
