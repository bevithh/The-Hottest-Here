"""
Build map-ready thermal overlays + trend statistics for the web app.

Input : nasa_raw_tiffs/<city>/MOD11A2.061_{LST_Day_1km,LST_Night_1km,QC_Day,QC_Night}_doyYYYYDDD*.tif
        (MODIS/Terra LST 8-day composites from AppEEARS)
Output: public/presentation_pngs/<city>/<year>.png          annual mean, daytime LST
        public/presentation_pngs/<city>/night/<year>.png    annual mean, night-time LST
        public/presentation_pngs/<city>/trend_<layer>.png   per-pixel Sen slope (°C/decade)
        src/data/manifest.json                              bounds, stats, monthly series, trends

Method
  1. Quality control: keep a pixel when MODLAND QA = 00 (good), or = 01 (other)
     with LST error <= 2 K. Missing QC file -> nodata mask only.
  2. Target Zone = pixels within TARGET_RADIUS_KM of the data-centre point;
     Baseline = a ring BASELINE_INNER_KM..BASELINE_OUTER_KM from the same point
     (the gap between the two keeps heat spilling off the site out of the
     baseline). Pixels that are nodata or fail QC are excluded per composite.
     The target circle must lie fully inside the tile, or the script stops.
  3. Per year: annual mean image, Target/Baseline means, and a paired t-test of
     (Target - Baseline) across that year's composites.
  4. Monthly series (mean of composites starting in each month) -> deseasonalized
     anomalies (subtract each calendar month's mean) -> Mann-Kendall test (with
     autocorrelation correction), Sen's slope + 95% CI, OLS t-test.
     Done for Target, Baseline and the Gap (Target - Baseline).
  4b. Seasonal gap summary ("gapSummary"): mean Target - Baseline gap for local
     summer / winter (and full years), day and night. Each season-year is one
     unit (8-day composites are autocorrelated), 95% Student-t CI, t-test vs 0.
  5. The same trend test per pixel -> "where is it changing" map.

Run:  ./venv/bin/python build_overlays.py      (or: npm run overlays)
"""
import datetime as dt
import glob
import json
import math
import os
import re
import warnings
from collections import defaultdict

import numpy as np
import rasterio
from matplotlib import colormaps
from PIL import Image

from trendstats import deseasonalize, mean_ci, paired_t, pixel_trend, r, trend, welch_t

warnings.filterwarnings("ignore", category=RuntimeWarning)

RAW_ROOT = "nasa_raw_tiffs"
OUT_ROOT = os.path.join("public", "presentation_pngs")
# Bundled into the app (not fetched) so the offline build works from file://
MANIFEST = os.path.join("src", "data", "manifest.json")
TARGET_RADIUS_KM = 2.5
BASELINE_INNER_KM = 5.0    # buffer: heat spilling off the site stays out of the baseline
BASELINE_OUTER_KM = 10.0
MIN_ZONE_PIXELS = 5        # warn when a zone has fewer usable pixels than this
MIN_SEASON_COMPOSITES = 5  # a season-year needs >= 5 of its ~11 composites to count
MIN_VALID_FRACTION = 0.3   # skip composites that are mostly cloud / failed QC
MIN_ZONE_FRACTION = 0.5    # monthly zone mean needs half its pixels valid
UPSCALE = 16

LAYERS = {
    "day": {"lst": "LST_Day_1km", "qc": "QC_Day", "label": "Daytime LST (~10:30 local)"},
    "night": {"lst": "LST_Night_1km", "qc": "QC_Night", "label": "Night-time LST (~22:30 local)"},
}

# Data-centre cluster coordinates (lat, lon). None -> city is skipped (never the tile centre).
# Keep in sync with CITIES in fetch_climate.py.
TARGETS = {
    "melbourne": (-37.8048, 144.8656),  # NEXTDC M3, 25 Indwe St, West Footscray (OpenStreetMap building)
    "ashburn": (39.0438, -77.4874),
    "dublin": (53.3197, -6.4247),
}

# Data-centre opening dates for the before/after comparison (only where known)
OPENING_DATES = {
    "melbourne": dt.date(2022, 10, 20),  # NEXTDC M3 official opening
}

# Shown on the map instead of the generic label in src/data/cities.js
TARGET_NAMES = {
    "melbourne": "NEXTDC M3, West Footscray",
}

DOY_RE = re.compile(r"doy(\d{4})(\d{3})")


def date_of(path):
    m = DOY_RE.search(os.path.basename(path))
    if not m:
        return None
    return dt.date(int(m.group(1)), 1, 1) + dt.timedelta(days=int(m.group(2)) - 1)


def frac_year(d):
    start = dt.date(d.year, 1, 1)
    days = (dt.date(d.year + 1, 1, 1) - start).days
    return d.year + ((d - start).days + 4) / days  # +4: middle of 8-day composite


def qc_ok(qc):
    mandatory = qc & 0b11
    lst_err = (qc >> 6) & 0b11
    return (mandatory == 0) | ((mandatory == 1) & (lst_err <= 1))


def read_layer(lst_path, qc_path):
    with rasterio.open(lst_path) as src:
        raw = src.read(1).astype(float)
        nodata = src.nodata if src.nodata is not None else 0
        b = src.bounds
        bounds = [[b.bottom, b.left], [b.top, b.right]]
    valid = raw != nodata
    used_qc = False
    if qc_path and os.path.exists(qc_path):
        with rasterio.open(qc_path) as q:
            valid &= qc_ok(q.read(1).astype(np.uint8))
        used_qc = True
    return np.where(valid, raw * 0.02 - 273.15, np.nan), bounds, used_qc


class ZoneError(RuntimeError):
    pass


def zone_masks(city, shape, bounds, target):
    """Target disc + baseline ring around the data-centre point.
    Stops if the target circle is not fully inside the tile."""
    if target is None:
        raise ZoneError(f"{city}: no target coordinates in TARGETS - refusing to fall back to the tile centre")
    (south, west), (north, east) = bounds
    rows, cols = shape
    lat0, lon0 = target
    km_lat, km_lon = 110.57, 111.32 * math.cos(math.radians(lat0))
    margins = {
        "north": (north - lat0) * km_lat, "south": (lat0 - south) * km_lat,
        "west": (lon0 - west) * km_lon, "east": (east - lon0) * km_lon,
    }
    short = {k: v for k, v in margins.items() if v < TARGET_RADIUS_KM}
    if short:
        raise ZoneError(
            f"{city}: the {TARGET_RADIUS_KM} km target circle around {lat0}, {lon0} is not fully inside the tile "
            f"(bounds S{south:.4f} W{west:.4f} N{north:.4f} E{east:.4f}); distance to edge: "
            + ", ".join(f"{k} {v:.2f} km" for k, v in short.items())
            + ". Request a larger AppEEARS area or fix the coordinates.")
    lats = north - (np.arange(rows) + 0.5) * (north - south) / rows
    lons = west + (np.arange(cols) + 0.5) * (east - west) / cols
    lon_g, lat_g = np.meshgrid(lons, lats)
    dist = np.hypot((lat_g - lat0) * km_lat, (lon_g - lon0) * km_lon)
    tgt = dist <= TARGET_RADIUS_KM
    ring = (dist >= BASELINE_INNER_KM) & (dist <= BASELINE_OUTER_KM)
    px_km2 = ((north - south) * km_lat / rows) * ((east - west) * km_lon / cols)
    ring_area = math.pi * (BASELINE_OUTER_KM ** 2 - BASELINE_INNER_KM ** 2)
    # Which compass sectors the (possibly truncated) ring covers, e.g. {"E": 16, "SE": 30, ...}
    bearing = np.degrees(np.arctan2((lon_g - lon0) * km_lon, (lat_g - lat0) * km_lat)) % 360
    sectors = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    counts = np.bincount(((bearing[ring] + 22.5) // 45).astype(int) % 8, minlength=8)
    info = {
        "ringSectors": {k: int(c) for k, c in zip(sectors, counts) if c},
        "targetPixels": int(tgt.sum()),
        "baselinePixels": int(ring.sum()),
        "pixelAreaKm2": px_km2,
        # share of the ideal ring that the tile actually contains
        "ringCoveragePct": 100 * min(1.0, ring.sum() * px_km2 / ring_area),
        "edgeMarginKm": margins,
    }
    return tgt, ring, [lat0, lon0], info


def season_of(d, south):
    """(season, season-year) for a composite date, or None outside Dec-Feb / Jun-Aug.
    Southern hemisphere: summer = Dec-Feb, winter = Jun-Aug; northern: the reverse.
    December counts with the following January/February (season-year = year + 1)."""
    djf, jja = d.month in (12, 1, 2), d.month in (6, 7, 8)
    if not (djf or jja):
        return None
    name = ("summer" if djf else "winter") if south else ("winter" if djf else "summer")
    return name, d.year + 1 if d.month == 12 else d.year


def before_after(units, opening):
    """Welch t-test of unit means (season-years or years) entirely before vs entirely after
    the opening date. Units that straddle the opening are left out."""
    before = [v for (start, end, v) in units if end <= opening]
    after = [v for (start, end, v) in units if start >= opening]
    res = welch_t(before, after)
    if res:
        res["excluded"] = sum(1 for (start, end, v) in units if start < opening < end)
    return res


def gap_summary(comp_gaps, south, total_by_year, opening=None):
    """Seasonal + annual mean gap. One unit = one season-year (or one full year),
    so autocorrelated 8-day composites are not counted as independent samples.
    With an opening date, also compares units before vs after it (Welch t-test)."""
    span = lambda ds: (min(ds), max(ds) + dt.timedelta(days=8))  # composite covers 8 days
    groups = {"summer": defaultdict(list), "winter": defaultdict(list)}
    dates = {"summer": defaultdict(list), "winter": defaultdict(list), "annual": defaultdict(list)}
    annual = defaultdict(list)
    for d, g in comp_gaps:
        annual[d.year].append(g)
        dates["annual"][d.year].append(d)
        s = season_of(d, south)
        if s:
            groups[s[0]][s[1]].append(g)
            dates[s[0]][s[1]].append(d)
    out, ba = {}, {}
    for name, by_sy in groups.items():
        kept = {y: v for y, v in by_sy.items() if len(v) >= MIN_SEASON_COMPOSITES}
        if opening:
            ba[name] = before_after([(*span(dates[name][y]), float(np.mean(v))) for y, v in kept.items()], opening)
        res = mean_ci([float(np.mean(v)) for v in kept.values()])
        if res:
            res.update({
                "unit": "season", "years": sorted(kept), "nComposites": sum(len(v) for v in kept.values()),
                "months": [12, 1, 2] if (name == "summer") == south else [6, 7, 8],
                "dropped": sorted(y for y in by_sy if y not in kept),
            })
        out[name] = res
    full = {y: v for y, v in annual.items() if total_by_year[y] >= 40 and len(v) >= 10}
    res = mean_ci([float(np.mean(v)) for v in full.values()])
    if res:
        res.update({"unit": "year", "years": sorted(full), "nComposites": sum(len(v) for v in full.values())})
    out["annual"] = res
    if opening:
        ba["annual"] = before_after(
            [(dt.date(y, 1, 1), dt.date(y + 1, 1, 1), float(np.mean(v))) for y, v in full.items()], opening)
        out["beforeAfter"] = {"opening": opening.isoformat(), "method": "Welch two-sample t-test on season/year means; units spanning the opening are excluded", **ba}
    return out


def render(arr, vmin, vmax, cmap, alpha):
    """Bilinear-resample the value field (not colours); alpha array per source pixel."""
    rows, cols = arr.shape
    size = (cols * UPSCALE, rows * UPSCALE)
    valid = np.isfinite(arr)
    filled = np.where(valid, arr, np.nanmean(arr) if valid.any() else 0).astype(np.float32)
    smooth = np.asarray(Image.fromarray(filled, "F").resize(size, Image.BILINEAR))
    a = np.where(valid, alpha, 0).astype(np.uint8)
    a_big = np.asarray(Image.fromarray(a).resize(size, Image.NEAREST))
    norm = np.clip((smooth - vmin) / (vmax - vmin), 0, 1)
    rgba = (colormaps[cmap](norm) * 255).astype(np.uint8)
    rgba[..., 3] = a_big
    return Image.fromarray(rgba, "RGBA")


def zone_mean(img, mask):
    vals = img[mask]
    if np.isfinite(vals).mean() < MIN_ZONE_FRACTION:
        return np.nan
    return float(np.nanmean(vals))


def process_layer(city, layer, files_by_kind, out_dir):
    spec = LAYERS[layer]
    lst_files = sorted(files_by_kind.get(spec["lst"], []), key=date_of)
    if not lst_files:
        return None, None
    qc_lookup = {date_of(p): p for p in files_by_kind.get(spec["qc"], [])}

    bounds = mask = base_mask = target_pt = zinfo = None
    composites = []  # (date, image)
    comp_gaps = []   # (date, target - baseline) per usable composite
    valid_counts = []  # usable pixels per composite: (target, baseline)
    qc_used = 0
    by_year_diffs = defaultdict(list)
    by_year_total = defaultdict(int)
    for p in lst_files:
        d = date_of(p)
        img, b, used = read_layer(p, qc_lookup.get(d))
        qc_used += used
        if bounds is None:
            bounds = b
            mask, base_mask, target_pt, zinfo = zone_masks(city, img.shape, bounds, TARGETS.get(city))
        by_year_total[d.year] += 1
        if np.isfinite(img).mean() < MIN_VALID_FRACTION:
            continue
        composites.append((d, img))
        fin = np.isfinite(img)
        valid_counts.append((int((fin & mask).sum()), int((fin & base_mask).sum())))
        t_m, b_m = zone_mean(img, mask), zone_mean(img, base_mask)
        if np.isfinite(t_m) and np.isfinite(b_m):
            by_year_diffs[d.year].append(t_m - b_m)
            comp_gaps.append((d, t_m - b_m))

    # ---- annual means + per-year paired t-test
    by_year = defaultdict(list)
    for d, img in composites:
        by_year[d.year].append(img)
    annual = {y: np.nanmean(np.stack(imgs), axis=0) for y, imgs in by_year.items()}
    full_years = [y for y in annual if by_year_total[y] >= 40]
    scale_src = [annual[y] for y in (full_years or annual)]
    vals = np.concatenate([a[np.isfinite(a)] for a in scale_src])
    vmin, vmax = (float(v) for v in np.percentile(vals, [2, 98]))

    layer_dir = out_dir if layer == "day" else os.path.join(out_dir, layer)
    os.makedirs(layer_dir, exist_ok=True)
    years = {}
    for y, img in sorted(annual.items()):
        render(img, vmin, vmax, "inferno", 215).save(os.path.join(layer_dir, f"{y}.png"))
        diffs = by_year_diffs.get(y, [])
        years[str(y)] = {
            "composites": len(by_year[y]),
            "targetC": zone_mean(img, mask),
            "baselineC": zone_mean(img, base_mask),
            "deltaC": float(np.mean(diffs)) if diffs else None,
            "pValue": paired_t(diffs),
            "partial": by_year_total[y] < 40,
        }

    # ---- monthly series
    by_month = defaultdict(list)
    for d, img in composites:
        by_month[(d.year, d.month)].append(img)
    keys = sorted(by_month)
    stack = np.stack([np.nanmean(np.stack(by_month[k]), axis=0) for k in keys])
    months = np.array([k[1] for k in keys])
    t = np.array([k[0] + (k[1] - 0.5) / 12 for k in keys])
    tgt = np.array([zone_mean(im, mask) for im in stack])
    base = np.array([zone_mean(im, base_mask) for im in stack])
    gap = tgt - base
    series = {
        "t": [f"{k[0]}-{k[1]:02d}" for k in keys],
        "target": tgt.tolist(),
        "baseline": base.tolist(),
        "gap": gap.tolist(),
        "targetAnom": deseasonalize(months, tgt).tolist(),
        "baselineAnom": deseasonalize(months, base).tolist(),
        "gapAnom": deseasonalize(months, gap).tolist(),
    }
    trends = {
        "target": trend(t, series["targetAnom"]),
        "baseline": trend(t, series["baselineAnom"]),
        "gap": trend(t, series["gapAnom"]),
    }

    # ---- per-pixel trend map (°C / decade)
    anom = deseasonalize(months, stack)
    rows, cols = stack.shape[1:]
    slope = np.full((rows, cols), np.nan)
    pval = np.full((rows, cols), np.nan)
    for i in range(rows):
        for j in range(cols):
            slope[i, j], pval[i, j] = pixel_trend(t, anom[:, i, j])
    slope_dec = slope * 10
    finite = np.isfinite(slope_dec)
    lim = max(0.5, float(np.percentile(np.abs(slope_dec[finite]), 98))) if finite.any() else 1.0
    lim = math.ceil(lim * 2) / 2
    sig = finite & (pval < 0.05)
    alpha = np.where(sig, 225, 80)
    render(slope_dec, -lim, lim, "RdBu_r", alpha).save(os.path.join(out_dir, f"trend_{layer}.png"))
    n_valid = int(finite.sum())
    trend_map = {
        "scalePerDecade": [-lim, lim],
        "pixels": n_valid,
        "sigWarmingPct": 100 * float((sig & (slope_dec > 0)).sum()) / max(n_valid, 1),
        "sigCoolingPct": 100 * float((sig & (slope_dec < 0)).sum()) / max(n_valid, 1),
        "meanSlopePerDecade": float(np.nanmean(slope_dec)) if n_valid else None,
        "targetMeanSlopePerDecade": float(np.nanmean(slope_dec[mask])) if n_valid else None,
    }

    for name, tr in trends.items():
        s = tr and tr["senSlopePerYear"] * 10
        print(f"  {layer:5s} {name:8s}: "
              + (f"{s:+.2f} °C/decade, MK p={tr['mkP']:.3f}, n={tr['n']}" if tr else "insufficient data"))
    print(f"  {layer:5s} pixels: {trend_map['sigWarmingPct']:.0f}% sig. warming, "
          f"{trend_map['sigCoolingPct']:.0f}% sig. cooling")

    # ---- pixel counts + seasonal gap summary
    vc = np.array(valid_counts) if valid_counts else np.zeros((1, 2))
    med_t, med_b = (float(x) for x in np.median(vc, axis=0))
    print(f"  {layer:5s} zones : target {zinfo['targetPixels']} px, baseline ring "
          f"{BASELINE_INNER_KM:g}-{BASELINE_OUTER_KM:g} km {zinfo['baselinePixels']} px "
          f"({zinfo['ringCoveragePct']:.0f}% of the ring is inside the tile, sectors {zinfo['ringSectors']}); "
          f"median usable per composite after QC: target {med_t:.0f}, baseline {med_b:.0f}")
    for zone, geo_n, med in (("target", zinfo["targetPixels"], med_t), ("baseline", zinfo["baselinePixels"], med_b)):
        if geo_n < MIN_ZONE_PIXELS or med < MIN_ZONE_PIXELS:
            print(f"  WARNING {city}/{layer}: {zone} has fewer than {MIN_ZONE_PIXELS} usable pixels "
                  f"({geo_n} in zone, median {med:.0f} after QC)")
    south = target_pt[0] < 0
    summary = gap_summary(comp_gaps, south, by_year_total, OPENING_DATES.get(city))
    for name in ("summer", "winter", "annual"):
        g = summary[name]
        if g and g["ci95"]:
            print(f"  {layer:5s} gap {name:6s}: {g['meanC']:+.2f} °C  95% CI [{g['ci95'][0]:+.2f}, {g['ci95'][1]:+.2f}]  "
                  f"n={g['n']} p={g['pValue']:.3g}{'' if g['significant'] else '  (not significant)'}")
        else:
            print(f"  {layer:5s} gap {name:6s}: insufficient data")
    for name, b in (summary.get("beforeAfter") or {}).items():
        if isinstance(b, dict) and "diffC" in b:
            print(f"  {layer:5s} before/after {name:6s}: {b['beforeC']:+.2f} (n={b['nBefore']}) -> {b['afterC']:+.2f} "
                  f"(n={b['nAfter']}), change {b['diffC']:+.2f} °C  95% CI [{b['ci95'][0]:+.2f}, {b['ci95'][1]:+.2f}] "
                  f"p={b['pValue']:.3g}{'' if b['significant'] else '  (not significant)'}")
    gap_block = {**summary, "pixels": {"targetMedianUsable": med_t, "baselineMedianUsable": med_b}}

    result = {
        "label": spec["label"],
        "colorScaleC": [round(vmin, 1), round(vmax, 1)],
        "qcAppliedPct": 100 * qc_used / len(lst_files),
        "years": years,
        "monthly": series,
        "trends": trends,
        "trendMap": trend_map,
    }
    return result, (bounds, target_pt, zinfo, gap_block)


def process_city(city):
    files_by_kind = defaultdict(list)
    for f in glob.glob(os.path.join(RAW_ROOT, city, "*.tif")):
        for kind in ("LST_Day_1km", "LST_Night_1km", "QC_Day", "QC_Night"):
            if f"_{kind}_" in os.path.basename(f):
                files_by_kind[kind].append(f)
    out_dir = os.path.join(OUT_ROOT, city)
    os.makedirs(out_dir, exist_ok=True)

    layers, geo, gaps = {}, None, {}
    for layer in LAYERS:
        res, g = process_layer(city, layer, files_by_kind, out_dir)
        if res:
            layers[layer] = res
            gaps[layer] = g[3]
            geo = geo or g
    if not layers:
        return None
    if geo[2]["ringCoveragePct"] < 50:
        print(f"  NOTE {city}: only {geo[2]['ringCoveragePct']:.0f}% of the {BASELINE_INNER_KM:g}-{BASELINE_OUTER_KM:g} km "
              f"ring lies inside the tile, so the baseline is one-sided. A larger AppEEARS area would fix this.")
    all_t = [x for L in layers.values() for x in L["monthly"]["t"]]
    zinfo = geo[2]
    return {
        "bounds": geo[0],
        "target": geo[1],
        "targetRadiusKm": TARGET_RADIUS_KM,
        **({"targetName": TARGET_NAMES[city]} if city in TARGET_NAMES else {}),
        "baseline": {
            "innerKm": BASELINE_INNER_KM,
            "outerKm": BASELINE_OUTER_KM,
            "targetPixels": zinfo["targetPixels"],
            "baselinePixels": zinfo["baselinePixels"],
            "ringCoveragePct": zinfo["ringCoveragePct"],
            "ringSectors": zinfo["ringSectors"],
        },
        "gapSummary": {
            "method": "Mean of (target - baseline) per season-year (or full year); 95% Student-t CI; "
                      "two-sided one-sample t-test vs 0. Seasons: local summer / winter (DJF or JJA).",
            "hemisphere": "south" if geo[1][0] < 0 else "north",
            "layers": gaps,
        },
        "product": "MODIS/Terra MOD11A2 v061 LST 8-day 1 km (via AppEEARS)",
        "period": [min(all_t), max(all_t)],
        "layers": layers,
    }


def main():
    """Usage: build_overlays.py [city ...]  (default: every folder in nasa_raw_tiffs).
    Cities not processed (not named, or no TARGETS entry) keep their existing entry in manifest.json."""
    import sys

    only = set(sys.argv[1:])
    manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    for city_dir in sorted(glob.glob(os.path.join(RAW_ROOT, "*"))):
        city = os.path.basename(city_dir)
        if only and city not in only:
            continue
        print(f"=== {city} ===")
        if TARGETS.get(city) is None:
            kept = "keeping its previous manifest entry" if city in manifest else "no manifest entry"
            print(f"  SKIPPED: no target coordinates set in TARGETS ({kept}). "
                  f"Set TARGETS['{city}'] to the data-centre lat/lon to include it.")
            continue
        try:
            res = process_city(city)
        except ZoneError as e:
            sys.exit(f"ERROR: {e}")
        if res:
            manifest[city] = res
    os.makedirs(OUT_ROOT, exist_ok=True)
    with open(MANIFEST, "w") as f:
        json.dump(r(manifest), f, separators=(",", ":"))
    print(f"Wrote {MANIFEST}")


if __name__ == "__main__":
    main()
