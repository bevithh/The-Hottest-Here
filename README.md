# The Thermal Divide

NASA Space Apps 2026 · challenge: **Be an Earth System Trend Detective**

**Live app:** https://bevithh.github.io/The-Hottest-Here/ (opens in your browser, nothing to install)

Do data-centre clusters make their neighbourhood hotter? Is that changing over time, and is the change statistically
significant? And could the waste heat warm nearby homes instead?

We use 10 years of NASA MODIS land-surface temperature (December 2015 – November 2026) over three data-centre clusters:

- Melbourne (NEXTDC M3, West Footscray)
- Ashburn (Data Center Alley, Virginia)
- Dublin (Grange Castle)

For each, we compare the land surface around the data centre with the land surface around it.

## Key results

**Gap** = land-surface temperature within 2.5 km of the data centre minus a ring 5–10 km away, in °C.
Each cell shows the mean gap with its 95 % confidence interval (CI). n = number of seasons or years averaged.
All values are significant at p < 0.05 unless marked *n.s.* (not significant).

| | Melbourne | Ashburn | Dublin |
|---|---|---|---|
| **Day, summer** | **+0.95** (+0.75 to +1.15), n=11 | **+2.22** (+1.95 to +2.48), n=11 | **+1.34** (+0.91 to +1.78), n=11 |
| Day, winter | +0.33 (+0.01 to +0.65), n=10 | +0.69 (+0.49 to +0.88), n=11 | +0.37 (+0.23 to +0.52), n=11 |
| **Day, all year** | **+0.72** (+0.55 to +0.89), n=10 | **+1.49** (+1.30 to +1.68), n=10 | **+0.82** (+0.70 to +0.94), n=10 |
| Night, summer | +0.04 (−0.11 to +0.18) *n.s.* | +1.08 (+0.95 to +1.21) | +0.48 (+0.07 to +0.89) |
| Night, winter | −0.14 (−0.23 to −0.05), site cooler | +0.25 (+0.04 to +0.46) | +0.17 (+0.06 to +0.28) |
| Night, all year | −0.03 (−0.10 to +0.04) *n.s.* | +0.51 (+0.43 to +0.60) | +0.31 (+0.23 to +0.39) |
| Day trend, °C per decade | −0.10 (−0.48 to +0.28) *n.s.* | −0.76 (−0.99 to −0.50), shrinking | +0.14 (−0.20 to +0.45) *n.s.* |
| Night trend, °C per decade | +0.03 (−0.19 to +0.27) *n.s.* | +0.24 (+0.01 to +0.46), p = 0.039 | +0.25 (+0.02 to +0.48), p = 0.031 |

Seasons are local. In Melbourne, summer is Dec–Feb and winter is Jun–Aug. In Ashburn and Dublin it is the other way round.

**What this shows:**

- **The surface is warmer in all three clusters.** By day in summer, the land around each data-centre cluster is about
  1–2 °C warmer than its surroundings. Ashburn's Data Center Alley has the largest gap, at +2.2 °C.
- **At night it varies.** The warmth persists at night in Ashburn and Dublin, but not in Melbourne.
- **The gap is not clearly growing.** Only the night-time gaps in Ashburn and Dublin are rising, and both are only
  just significant. Ashburn's daytime gap is shrinking, most likely because its surroundings are being built up.
- **Melbourne before/after:** M3 opened on 20 Oct 2022. Comparing the gap before and after, using a Welch t-test, shows
  no significant increase. Only the winter daytime gap changed significantly, and it fell, by −0.78 °C (p = 0.004).
  With just 3 full years since opening, the test has little power.

**What it does not show:**

- **It is not proof that the data centres caused the warmth.** Roofs, car parks, roads and other industry heat surfaces
  too, so the gap shows an association, not a cause.
- **It is not air temperature.** Land-surface temperature measures how hot the ground and roofs are, not the air
  people feel.

The household simulator uses that waste heat for a second question: could routing it into district heating cut gas bills
and carbon emissions in winter?

## Data

| Source | Use |
|---|---|
| **MODIS/Terra MOD11A2 v061** land-surface temperature, 8-day, 1 km, Day + Night + quality flags (NASA LP DAAC, via AppEEARS) | Heat maps, target vs. baseline, seasonal gaps, trends |
| **MERRA-2** monthly 2 m air temperature, min/max and wind (via the NASA POWER API) | Winter extremes, heating degree-days and their trends |
| Energy prices: AGL / Victorian Default Offer (Melbourne), US EIA (Ashburn), SEAI (Dublin) | Household bill comparison |
| IEA *Energy and AI* (2025) | Global data-centre electricity: 415 TWh (2024) → ~945 TWh (2030) |

Each city has one AppEEARS area extract, about 22–23 km across and centred on the data-centre site. That keeps the whole
5–10 km baseline ring inside the extract:

| City | Target (lat, lon) | Extract | Ring inside the extract |
|---|---|---|---|
| Melbourne | −37.8048, 144.8656 (NEXTDC M3, from OpenStreetMap) | 23 × 23 km | 98 % (342 px) |
| Ashburn | 39.0438, −77.4874 | 22 × 23 km | 100 % (358 px) |
| Dublin | 53.3197, −6.4247 (Grange Castle) | 22 × 23 km | 99 % (456 px) |

## Method

1. **Quality control.** A pixel is kept when its MODIS quality flag says "good", or "other quality" with an LST error of
   2 K or less.
2. **Target and baseline.** The target is the pixels within 2.5 km of the site. The baseline is a ring 5–10 km away.
   The 2.5–5 km buffer keeps heat spilling off the site out of the baseline. If the target circle does not fit inside
   the extract, the build stops with an error.
3. **Seasonal gap.** For each local summer, winter and full year, we take the mean of target minus baseline. Each
   season-year counts as one sample, because consecutive 8-day images are not independent. We report a Student-t 95 %
   CI and a t-test against zero.
4. **Trend.** Monthly means are deseasonalized by subtracting each calendar month's average. We then run a Mann-Kendall
   test with a lag-1 autocorrelation correction, estimate the rate with Sen's slope (95 % CI), and run an ordinary
   least-squares t-test for comparison. The same test on every pixel gives the "where is it changing" map.
5. **Before/after.** Where an opening date is known, we compare seasons and years entirely before it with those
   entirely after it, using a Welch t-test. Seasons that span the opening date are left out.

All statistics are implemented in `trendstats.py` with numpy only (no scipy).

**Limitations:**

- **Terra's orbit drift.** Terra's overpass time has drifted earlier since 2020. This biases absolute daytime LST
  colder and night LST warmer. The target-minus-baseline gap largely cancels this, so the gap is the headline metric.
- **Pixel size.** One MODIS pixel is about 1 km across, far coarser than a single building.
- **Mixed baseline.** The ring mixes farmland, suburbs and industry, so it represents "the surrounding area", not a
  pristine reference.
- **Dublin opening dates.** Dublin's openings (Microsoft 2009, a second facility in June 2016) predate the record,
  which starts in December 2015. A before/after test there would need an extract starting in 2000 or 2010.
- **Household simulator inputs.** Waste-heat output, household counts, grid carbon intensity and the heat-network
  charge are illustrative. The gas and electricity prices are real.

## Run it

```bash
npm install
npm run dev               # the app, at http://localhost:5173

# Rebuild the data (Python venv with numpy, rasterio, matplotlib, pillow, requests)
python bulk_download.py [city ...]   # AppEEARS GeoTIFFs -> nasa_raw_tiffs/<city>/ (credentials in .env)
npm run overlays          # -> public/presentation_pngs/ + src/data/manifest.json
npm run climate           # -> src/data/climate.json
```

| Setting | Where |
|---|---|
| Target coordinates per city | `TARGETS` in `build_overlays.py` and `CITIES` in `fetch_climate.py` |
| Ring radii | `BASELINE_INNER_KM`, `BASELINE_OUTER_KM` |
| Opening dates for the before/after test | `OPENING_DATES` |
| Map labels | `TARGET_NAMES` |

Superseded extracts are kept in `nasa_raw_archive/`, which the build ignores.

### Sharing without hosting

```bash
npm run build:offline     # -> offline/ThermalDivide.zip
```

The zip contains one self-contained `index.html` (about 10 MB). The JS, CSS, data and all 77 heat-map overlays are
embedded in it, the overlays as data URIs via the `virtual:overlays` plugin in `vite.config.js`. Double-click it: no
install or server is needed, it still works if moved on its own, and only the background map needs internet.

## Project layout

| Path | What |
|---|---|
| `src/` | React + Vite + Tailwind app (Leaflet map, timeline, Trend Lab, heat-island gap panel, household simulator) |
| `src/data/manifest.json`, `src/data/climate.json` | Generated data, bundled into the app |
| `build_overlays.py` | MODIS processing, zones, seasonal gaps, before/after, trends, overlay PNGs |
| `trendstats.py` | Shared statistics |
| `fetch_climate.py` | MERRA-2 / NASA POWER winter climate |
| `bulk_download.py` | Resumable AppEEARS downloader |
| `batch_convert.py` | Titled PNGs of individual 8-day images for presentations |

## Use of Super Intelligence (SI)

Parts of this codebase were written with the help of Claude (Anthropic, via Claude Code), from the team's
specifications. That covers the React app in `src/` and the Python scripts `build_overlays.py`, `trendstats.py`,
`fetch_climate.py`, `batch_convert.py` and `bulk_download.py`.

The team chose the problem, cities, datasets and research question. The team also downloaded the data and reviewed and
tested all results. No SI-generated images, logos or audio are used; all maps and charts are drawn from NASA data.

*This is an independent hackathon project. It is not affiliated with or endorsed by NASA.*
