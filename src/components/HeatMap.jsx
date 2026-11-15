import { Fragment, useEffect } from 'react';
import {
  Circle,
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { overlayUrl, trendMapUrl } from '../data/cities.js';

const TEAL = '#2dd4bf';
const ORANGE = '#fb923c';
const SLATE = '#64748b';

function FlyToCity({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.4 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom, map]);
  return null;
}

/**
 * Performance: backdrop-filter blur on the floating panels has to be
 * recomputed every frame while the map underneath moves. Flag the root while
 * the map is panning/zooming so CSS can swap blur for a solid tint.
 * Done with a class (not React state) so it costs no re-render.
 */
function MotionFlag() {
  const root = document.documentElement;
  useMapEvents({
    movestart: () => root.classList.add('map-moving'),
    zoomstart: () => root.classList.add('map-moving'),
    moveend: () => root.classList.remove('map-moving'),
    zoomend: () => root.classList.remove('map-moving'),
  });
  return null;
}

// Gentle arc between two points so routes read as flows, not straight wires
function arc([lat1, lng1], [lat2, lng2], bend = 0.18, steps = 24) {
  const cLat = (lat1 + lat2) / 2 - (lng2 - lng1) * bend;
  const cLng = (lng1 + lng2) / 2 + (lat2 - lat1) * bend;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return [u * u * lat1 + 2 * u * t * cLat + t * t * lat2, u * u * lng1 + 2 * u * t * cLng + t * t * lng2];
  });
}

export default function HeatMap({
  city,
  currentYear,
  layer,
  mapMode,
  hasOverlay,
  hasTrendMap,
  isSimulating,
  sim,
  selectedZone,
  onSelectZone,
  targetRadiusKm,
}) {
  const dc = city.dataCenter.coords;
  const zones = sim?.zones ?? city.residential.map((z) => ({ ...z, served: 0, coverage: 0 }));
  const maxHh = Math.max(...zones.map((z) => z.households));

  const overlay =
    mapMode === 'trend'
      ? hasTrendMap && trendMapUrl(city.id, layer)
      : hasOverlay && overlayUrl(city.id, currentYear, layer);

  return (
    <MapContainer
      center={city.center}
      zoom={city.zoom}
      zoomControl={false}
      className="absolute inset-0 z-0 h-full w-full"
      worldCopyJump
    >
      {/* Esri dark canvas: no API key needed */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors · LST: NASA MODIS MOD11A2 · Climate: NASA POWER / MERRA-2"
        maxZoom={16}
        updateWhenZooming={false}
        keepBuffer={4}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
        zIndex={650}
        opacity={0.8}
        updateWhenZooming={false}
        keepBuffer={4}
      />
      <FlyToCity center={city.center} zoom={city.zoom} />
      <MotionFlag />

      {overlay && (
        <ImageOverlay
          key={`${city.id}-${mapMode}`}
          url={overlay}
          bounds={city.bounds}
          opacity={mapMode === 'trend' ? 0.9 : 0.78}
          className="thermal-overlay"
        />
      )}

      {/* Target zone ring (baseline = 5–10 km ring, see build_overlays.py) */}
      <Circle
        center={dc}
        radius={(targetRadiusKm ?? 2.5) * 1000}
        pathOptions={{ color: ORANGE, weight: 1.5, dashArray: '4 6', fillOpacity: 0.04 }}
        interactive={false}
      />
      <CircleMarker
        center={dc}
        radius={7}
        pathOptions={{ color: ORANGE, fillColor: ORANGE, fillOpacity: 0.9, weight: 2 }}
      >
        <Tooltip direction="top">
          {city.dataCenter.name} · target zone {targetRadiusKm ?? 2.5} km
        </Tooltip>
      </CircleMarker>

      {/* Residential zones: size = households, fill = share heated by routed waste heat */}
      {zones.map((z, i) => {
        const active = isSimulating && z.served > 0;
        const selected = selectedZone === z.name;
        const r = 8 + 14 * Math.sqrt(z.households / maxHh);
        const path = arc(dc, z.coords, i % 2 ? -0.18 : 0.18);
        return (
          <Fragment key={`${city.id}-${z.name}`}>
            {active && (
              <>
                <Polyline
                  positions={path}
                  interactive={false}
                  pathOptions={{ color: TEAL, weight: 10, opacity: 0.12, lineCap: 'round' }}
                />
                <Polyline
                  positions={path}
                  interactive={false}
                  pathOptions={{ color: TEAL, weight: 3, opacity: 0.95, className: 'heat-route' }}
                />
              </>
            )}
            <CircleMarker
              key={isSimulating ? 'on' : 'off'} /* className/permanent are creation-time options */
              center={z.coords}
              radius={r}
              eventHandlers={{ click: () => onSelectZone(z.name) }}
              pathOptions={{
                color: selected ? '#fff' : isSimulating ? TEAL : SLATE,
                weight: selected ? 2.5 : 1.5,
                fillColor: isSimulating ? TEAL : SLATE,
                fillOpacity: isSimulating ? 0.12 + 0.5 * z.coverage : 0.15,
                className: active ? 'pulse-ring' : undefined,
              }}
            >
              <Tooltip direction="right" permanent={isSimulating} className="!text-xs">
                {z.name}
                {isSimulating && ` · ${Math.round(z.coverage * 100)}% heated`}
              </Tooltip>
            </CircleMarker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
