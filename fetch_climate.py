"""
Fetch MERRA-2-based monthly air temperature + wind from NASA POWER for each city
and compute the winter-extremes / heating-demand figures used in the app.

NASA POWER (https://power.larc.nasa.gov) serves MERRA-2 meteorology through a
public API - same reanalysis you would pull in Giovanni, no login required.

Output: src/data/climate.json (bundled into the app)

Run:  ./venv/bin/python fetch_climate.py      (or: npm run climate)
"""
import json
import os
import urllib.request

import numpy as np

from trendstats import r, trend

# Data-centre points (lat, lon) - keep in sync with build_overlays.py TARGETS
CITIES = {
    "melbourne": (-37.8048, 144.8656),  # NEXTDC M3 West Footscray
    "ashburn": (39.0438, -77.4874),
    "dublin": (53.3197, -6.4247),
}
START, END = 1991, 2025
RECENT = (2016, 2025)
BASE_C = 18.0  # heating degree-day base temperature
PARAMS = "T2M,T2M_MIN,T2M_MAX,WS2M"
DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def fetch(lat, lon):
    url = (
        "https://power.larc.nasa.gov/api/temporal/monthly/point"
        f"?parameters={PARAMS}&community=RE&latitude={lat}&longitude={lon}"
        f"&start={START}&end={END}&format=JSON"
    )
    with urllib.request.urlopen(url, timeout=120) as resp:
        return json.load(resp)["properties"]["parameter"]


def table(param):
    """{(year, month): value} skipping POWER's annual '13' entries and fill values."""
    out = {}
    for k, v in param.items():
        y, m = int(k[:4]), int(k[4:])
        if m <= 12 and v is not None and v > -900:
            out[(y, m)] = v
    return out


def wind_chill(t_c, v_ms):
    v = v_ms * 3.6
    if t_c > 10 or v < 4.8:
        return t_c
    return 13.12 + 0.6215 * t_c - 11.37 * v ** 0.16 + 0.3965 * t_c * v ** 0.16


def summarize(city, lat, lon):
    p = fetch(lat, lon)
    t2m, tmin, ws = table(p["T2M"]), table(p["T2M_MIN"]), table(p["WS2M"])
    south = lat < 0
    winter_months = (6, 7, 8) if south else (12, 1, 2)

    clim = [float(np.mean([t2m[(y, m)] for y in range(*RECENT) if (y, m) in t2m])) for m in range(1, 13)]
    clim_min = [float(np.mean([tmin[(y, m)] for y in range(*RECENT) if (y, m) in tmin])) for m in range(1, 13)]
    hdd_month = [DAYS[i] * max(0.0, BASE_C - clim[i]) for i in range(12)]

    # Winter mean per year (DJF assigned to the January year in the north)
    years, winter_mean, hdd_year = [], [], []
    for y in range(START + 1, END + 1):
        keys = [((y - 1) if (not south and m == 12) else y, m) for m in winter_months]
        if all(k in t2m for k in keys):
            years.append(y)
            winter_mean.append(float(np.mean([t2m[k] for k in keys])))
        months = [(y, m) for m in range(1, 13)]
        if all(k in t2m for k in months):
            hdd_year.append((y, sum(DAYS[m - 1] * max(0.0, BASE_C - t2m[(y, m)]) for _, m in months)))

    recent_min = min(((v, k) for k, v in tmin.items() if RECENT[0] <= k[0] <= RECENT[1]))
    record_min = min(((v, k) for k, v in tmin.items()))
    coldest = int(np.argmin(clim))
    winter_wind = float(np.mean([ws[(y, m)] for (y, m) in ws if m in winter_months and y >= RECENT[0]]))
    hdd_recent = float(np.mean([h for y, h in hdd_year if y >= RECENT[0]]))

    return {
        "coords": [lat, lon],
        "source": "NASA POWER (MERRA-2 reanalysis), monthly",
        "period": [START, END],
        "recentPeriod": list(RECENT),
        "hemisphere": "south" if south else "north",
        "winterMonths": list(winter_months),
        "lowestTempC": recent_min[0],
        "lowestTempWhen": f"{recent_min[1][0]}-{recent_min[1][1]:02d}",
        "recordLowC": record_min[0],
        "recordLowWhen": f"{record_min[1][0]}-{record_min[1][1]:02d}",
        "avgWinterTempC": float(np.mean([clim[m - 1] for m in winter_months])),
        "coldestMonth": coldest + 1,
        "coldestMonthMeanMinC": clim_min[coldest],
        "winterWindMs": winter_wind,
        "windChillC": wind_chill(clim_min[coldest], winter_wind),
        "heatingDegreeDays": hdd_recent,
        "monthlyMeanC": clim,
        "monthlyHDD": hdd_month,
        "winterSeries": {"years": years, "meanC": winter_mean},
        "winterTrend": trend(np.array(years, float), winter_mean, min_n=10),
        "hddSeries": {"years": [y for y, _ in hdd_year], "hdd": [h for _, h in hdd_year]},
        "hddTrend": trend(np.array([y for y, _ in hdd_year], float), [h for _, h in hdd_year], min_n=10),
    }


def main():
    out = {}
    for city, (lat, lon) in CITIES.items():
        print(f"Fetching {city} ...")
        s = summarize(city, lat, lon)
        wt, ht = s["winterTrend"], s["hddTrend"]
        print(f"  lowest {s['lowestTempC']:.1f}°C ({s['lowestTempWhen']}), winter avg {s['avgWinterTempC']:.1f}°C, "
              f"HDD {s['heatingDegreeDays']:.0f}, winter trend {wt['senSlopePerYear']*10:+.2f}°C/dec p={wt['mkP']:.3f}, "
              f"HDD trend {ht['senSlopePerYear']*10:+.0f}/dec p={ht['mkP']:.3f}")
        out[city] = s
    with open(os.path.join("src", "data", "climate.json"), "w") as f:
        json.dump(r(out, 3), f, separators=(",", ":"))
    print("Wrote src/data/climate.json")


if __name__ == "__main__":
    main()
