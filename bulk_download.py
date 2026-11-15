"""
Resumable bulk downloader for AppEEARS GeoTIFFs.

Fixes over the first version:
  * credentials come from .env (APPEEARS_USERNAME / APPEEARS_PASSWORD), not the code
  * every request has a timeout and is retried with backoff on network errors / 5xx
  * expired token (401/403) -> log in again and retry
  * HTTP errors are never saved as .tif (old version wrote the error body to disk)
  * downloads go to <file>.part and are renamed only when complete, so an
    interrupted run never leaves a truncated file that later gets skipped
  * existing files that are not valid TIFFs are re-downloaded
  * one failing file doesn't stop the run; failures are listed at the end

Run:  python3 bulk_download.py [city ...]   (progress also goes to download.log)
"""
import os
import sys
import time

import requests

DOWNLOAD_LISTS = {
    "melbourne": "data/download_lists/NEXTDC-M3-data-centre-Footscray-download-list.txt",  # extract centred on NEXTDC M3
    # old tile-centre extract (Melbournes-western-suburbs-download-list.txt) archived in nasa_raw_archive/
    "dublin": "data/download_lists/dublin22km-download-list.txt",  # ~22 km extract; old small tile archived in nasa_raw_archive/
    "ashburn": "data/download_lists/ashburn22km-download-list.txt",  # ~22 km extract; old small tile archived in nasa_raw_archive/
}
LOGIN_URL = "https://appeears.earthdatacloud.nasa.gov/api/login"
TIMEOUT = (15, 120)  # connect, read seconds
MAX_TRIES = 6
LOG = open("download.log", "a", buffering=1)


def log(msg):
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    LOG.write(line + "\n")


def load_env(path=".env"):
    if os.path.exists(path):
        for line in open(path):
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k, v)


def login():
    user, pw = os.environ.get("APPEEARS_USERNAME"), os.environ.get("APPEEARS_PASSWORD")
    if not user or not pw:
        sys.exit("Set APPEEARS_USERNAME and APPEEARS_PASSWORD in .env")
    for attempt in range(1, MAX_TRIES + 1):
        try:
            r = requests.post(LOGIN_URL, auth=(user, pw), timeout=TIMEOUT)
            if r.status_code == 200:
                return {"Authorization": f"Bearer {r.json()['token']}"}
            if r.status_code in (401, 403):
                sys.exit("Login failed: check the username/password in .env")
            log(f"  login HTTP {r.status_code}, retrying")
        except requests.RequestException as e:
            log(f"  login error ({e.__class__.__name__}), retrying")
        time.sleep(min(60, 2 ** attempt))
    sys.exit("Could not log in to AppEEARS (network down?)")


def is_valid_tif(path):
    try:
        with open(path, "rb") as f:
            return os.path.getsize(path) > 200 and f.read(2) in (b"II", b"MM")
    except OSError:
        return False


def download(url, dest, session):
    part = dest + ".part"
    for attempt in range(1, MAX_TRIES + 1):
        try:
            with session.get(url, stream=True, timeout=TIMEOUT) as r:
                if r.status_code in (401, 403):
                    log("  token expired, logging in again")
                    session.headers.update(login())
                    continue
                if r.status_code == 404:
                    log(f"  404 not found: {os.path.basename(dest)}")
                    return False
                r.raise_for_status()
                with open(part, "wb") as f:
                    for chunk in r.iter_content(chunk_size=65536):
                        f.write(chunk)
            if not is_valid_tif(part):
                raise ValueError("response is not a GeoTIFF")
            os.replace(part, dest)
            return True
        except (requests.RequestException, ValueError, OSError) as e:
            wait = min(120, 2 ** attempt)
            log(f"  attempt {attempt}/{MAX_TRIES} failed ({e.__class__.__name__}: {str(e)[:80]}), retry in {wait}s")
            time.sleep(wait)
    if os.path.exists(part):
        os.remove(part)
    return False


def main():
    load_env()
    log("Authenticating with NASA AppEEARS...")
    session = requests.Session()
    session.headers.update(login())
    log("Login successful")

    only = set(sys.argv[1:])  # optional: python bulk_download.py melbourne
    failed = []
    for city, list_file in DOWNLOAD_LISTS.items():
        if only and city not in only:
            continue
        folder = os.path.join("nasa_raw_tiffs", city)
        os.makedirs(folder, exist_ok=True)
        try:
            urls = [u.strip() for u in open(list_file) if u.strip().endswith(".tif")]
        except FileNotFoundError:
            log(f"=== {city}: {list_file} not found, skipping")
            continue

        todo = [u for u in urls if not is_valid_tif(os.path.join(folder, u.rsplit("/", 1)[-1]))]
        log(f"=== {city.upper()}: {len(urls)} files, {len(urls) - len(todo)} already done, {len(todo)} to download")
        for i, url in enumerate(todo, 1):
            name = url.rsplit("/", 1)[-1]
            ok = download(url, os.path.join(folder, name), session)
            if not ok:
                failed.append(name)
            if i % 25 == 0 or i == len(todo):
                log(f"  {city}: {i}/{len(todo)}")
        log(f"=== Finished {city.upper()}")

    if failed:
        log(f"Done with {len(failed)} failures (re-run to retry): {failed[:10]}{' ...' if len(failed) > 10 else ''}")
        sys.exit(1)
    log("All downloads for ALL cities completed successfully!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Interrupted. Re-run to resume; finished files are kept.")
