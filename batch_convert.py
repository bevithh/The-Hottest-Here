"""
Make presentation PNGs (with title, date and colour bar) from the AppEEARS GeoTIFFs.
These are for sharing/slides. The web app uses build_overlays.py instead.

  python3 batch_convert.py                 # every city that has data
  python3 batch_convert.py melbourne       # just one city

Output: presentation_pngs/<city>/<day|night>/<YYYY-MM-DD>.png
  * only LST files are converted (QC files are quality flags, not temperatures)
  * QC filtering applied when the matching QC file exists (cloudy / poor pixels hidden)
  * colour scale stretched per image (2nd–98th percentile) so local hot spots stand out;
    read actual values off the colour bar when comparing images
"""
import datetime as dt
import glob
import os
import re
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import rasterio

LAYERS = {"day": ("LST_Day_1km", "QC_Day", "Daytime"), "night": ("LST_Night_1km", "QC_Night", "Night-time")}
TITLES = {"melbourne": "Melbourne western suburbs", "dublin": "Dublin, Ireland", "ashburn": "Ashburn, Virginia"}
DOY = re.compile(r"doy(\d{4})(\d{3})")


def read(lst_path, qc_path):
    with rasterio.open(lst_path) as s:
        raw = s.read(1).astype(float)
        nodata = s.nodata if s.nodata is not None else 0
    valid = raw != nodata
    if qc_path and os.path.exists(qc_path):
        with rasterio.open(qc_path) as q:
            qc = q.read(1).astype(np.uint8)
        valid &= ((qc & 3) == 0) | (((qc & 3) == 1) & (((qc >> 6) & 3) <= 1))
    return np.ma.masked_array(raw * 0.02 - 273.15, mask=~valid)


def convert_city(city):
    raw_folder = os.path.join("nasa_raw_tiffs", city)
    for layer, (lst_kind, qc_kind, label) in LAYERS.items():
        files = sorted(glob.glob(os.path.join(raw_folder, f"*_{lst_kind}_*.tif")))
        if not files:
            continue
        out_dir = os.path.join("presentation_pngs", city, layer)
        os.makedirs(out_dir, exist_ok=True)

        images = []
        for f in files:
            m = DOY.search(f)
            date = dt.date(int(m.group(1)), 1, 1) + dt.timedelta(days=int(m.group(2)) - 1)
            data = read(f, f.replace(lst_kind, qc_kind))
            images.append((date, data))

        print(f"=== {city} {layer}: {len(files)} images")

        made = 0
        for date, data in images:
            out = os.path.join(out_dir, f"{date.isoformat()}.png")
            if os.path.exists(out):
                continue
            if data.count() < 0.3 * data.size:  # mostly cloud: nothing useful to show
                continue
            vmin, vmax = np.percentile(data.compressed(), [2, 98])
            if vmax - vmin < 1:
                vmin, vmax = vmin - 0.5, vmax + 0.5
            cmap = plt.get_cmap("inferno").copy()
            cmap.set_bad("#2b2b2b")
            fig, ax = plt.subplots(figsize=(7, 6))
            im = ax.imshow(data, cmap=cmap, vmin=vmin, vmax=vmax)
            cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
            cbar.set_label("Land Surface Temperature (°C)", rotation=270, labelpad=15)
            ax.axis("off")
            end = date + dt.timedelta(days=7)
            ax.set_title(
                f"{TITLES.get(city, city.title())} · {label} surface temperature\n"
                f"{date:%d %b %Y} – {end:%d %b %Y}  (NASA MODIS MOD11A2, 1 km)",
                fontsize=11,
            )
            fig.text(0.5, 0.02, "Grey = cloud / low-quality pixel · colour scale fitted to this image", ha="center", fontsize=8, color="#666")
            fig.savefig(out, dpi=150, bbox_inches="tight")
            plt.close(fig)
            made += 1
        print(f"    wrote {made} new PNGs to {out_dir}/")


if __name__ == "__main__":
    cities = sys.argv[1:] or [os.path.basename(p) for p in sorted(glob.glob("nasa_raw_tiffs/*"))]
    for c in cities:
        convert_city(c)
    print("Done.")
