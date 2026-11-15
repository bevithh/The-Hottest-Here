"""
Trend statistics shared by build_overlays.py and fetch_climate.py.

Implements, without scipy:
  * Mann-Kendall trend test, with the Hamed & Rao (1998) / Yue & Wang (2004)
    lag-1 autocorrelation variance correction (monthly anomalies are serially
    correlated, which otherwise overstates significance);
  * Sen's slope with a 95% confidence interval (Gilbert 1987);
  * OLS linear regression slope with a two-sided Student t-test;
  * mean with a Student-t 95% confidence interval (mean_ci).

All slopes are returned per year of the time axis supplied (t in fractional years).
"""
import math

import numpy as np

Z95 = 1.959963984540054


def norm_sf(z):
    return 0.5 * math.erfc(z / math.sqrt(2))


def t_two_sided_p(t, df):
    """Two-sided p-value for Student's t via the regularized incomplete beta."""
    if df <= 0 or not math.isfinite(t):
        return None
    return _betainc(df / 2.0, 0.5, df / (df + t * t))


def _betainc(a, b, x):
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    lbeta = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
    front = math.exp(lbeta + a * math.log(x) + b * math.log(1 - x))
    if x < (a + 1) / (a + b + 2):
        return front * _betacf(a, b, x) / a
    return 1.0 - front * _betacf(b, a, 1 - x) / b


def _betacf(a, b, x, iters=300, eps=3e-14):
    qab, qap, qam = a + b, a + 1, a - 1
    c, d = 1.0, 1 - qab * x / qap
    d = 1 / (d if abs(d) > 1e-300 else 1e-300)
    h = d
    for m in range(1, iters + 1):
        m2 = 2 * m
        for aa in (m * (b - m) * x / ((qam + m2) * (a + m2)),
                   -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))):
            d = 1 + aa * d
            d = 1 / (d if abs(d) > 1e-300 else 1e-300)
            c = 1 + aa / c
            c = c if abs(c) > 1e-300 else 1e-300
            h *= d * c
        if abs(d * c - 1) < eps:
            break
    return h


def paired_t(diffs):
    d = np.asarray([x for x in diffs if np.isfinite(x)])
    n = len(d)
    if n < 3 or d.std(ddof=1) == 0:
        return None
    t = d.mean() / (d.std(ddof=1) / math.sqrt(n))
    return t_two_sided_p(float(t), n - 1)


def t_critical(df, alpha=0.05):
    """Two-sided Student t critical value (e.g. 95% -> alpha 0.05), by bisection on t_two_sided_p."""
    lo, hi = 0.0, 1000.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if t_two_sided_p(mid, df) > alpha:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def mean_ci(values, alpha=0.05):
    """Mean with a two-sided (1-alpha) Student-t confidence interval and a one-sample
    t-test against 0. Treat each value as an independent unit (e.g. one season)."""
    v = np.asarray([x for x in values if x is not None and np.isfinite(x)], float)
    n = len(v)
    if n == 0:
        return None
    mean = float(v.mean())
    if n < 3 or v.std(ddof=1) == 0:
        return {"meanC": mean, "ci95": None, "n": n, "sd": None, "pValue": None, "significant": None}
    sd = float(v.std(ddof=1))
    se = sd / math.sqrt(n)
    half = t_critical(n - 1, alpha) * se
    p = t_two_sided_p(mean / se, n - 1)
    return {"meanC": mean, "ci95": [mean - half, mean + half], "n": n, "sd": sd,
            "pValue": p, "significant": bool(p < alpha)}


def welch_t(a, b, alpha=0.05):
    """Difference of means (b - a) with Welch's unequal-variance t-test and (1-alpha) CI.
    Welch-Satterthwaite degrees of freedom (non-integer)."""
    a = np.asarray([x for x in a if x is not None and np.isfinite(x)], float)
    b = np.asarray([x for x in b if x is not None and np.isfinite(x)], float)
    na, nb = len(a), len(b)
    if na < 2 or nb < 2:
        return None
    va, vb = a.var(ddof=1) / na, b.var(ddof=1) / nb
    se = math.sqrt(va + vb)
    diff = float(b.mean() - a.mean())
    if se == 0:
        return None
    df = (va + vb) ** 2 / (va ** 2 / (na - 1) + vb ** 2 / (nb - 1))
    p = t_two_sided_p(diff / se, df)
    half = t_critical(df, alpha) * se
    return {"beforeC": float(a.mean()), "afterC": float(b.mean()), "nBefore": na, "nAfter": nb,
            "diffC": diff, "ci95": [diff - half, diff + half], "df": float(df),
            "pValue": p, "significant": bool(p < alpha)}


def _lag1(x):
    x = x - x.mean()
    den = (x * x).sum()
    return float((x[:-1] * x[1:]).sum() / den) if den > 0 else 0.0


def trend(t, y, min_n=24):
    """Full trend summary for series y at times t (fractional years). NaNs dropped."""
    t = np.asarray(t, float)
    y = np.asarray(y, float)
    ok = np.isfinite(t) & np.isfinite(y)
    t, y = t[ok], y[ok]
    n = len(y)
    if n < min_n:
        return None

    # Pairwise differences (i < j)
    i, j = np.triu_indices(n, k=1)
    dt = t[j] - t[i]
    dy = y[j] - y[i]
    s = int(np.sign(dy).sum())
    slopes = np.sort(dy[dt > 0] / dt[dt > 0])
    sen = float(np.median(slopes))
    intercept = float(np.median(y - sen * t))

    var_s = n * (n - 1) * (2 * n + 5) / 18.0
    # Autocorrelation correction on the detrended series (AR(1) form)
    r1 = _lag1(y - (sen * t + intercept))
    if abs(r1) > Z95 / math.sqrt(n):  # only when lag-1 autocorrelation is significant
        k = np.arange(1, n)
        ratio = 1 + 2 / n * float(((n - k) * r1 ** k).sum())
        var_s *= max(ratio, 1.0)
    else:
        ratio = 1.0

    z = 0.0 if s == 0 else (s - np.sign(s)) / math.sqrt(var_s)
    p_mk = 2 * norm_sf(abs(z))

    # Sen slope 95% CI (Gilbert 1987)
    nn = len(slopes)
    c = Z95 * math.sqrt(var_s)
    lo_i = int(max(0, math.floor((nn - c) / 2) - 1))
    hi_i = int(min(nn - 1, math.ceil((nn + c) / 2)))
    ci = [float(slopes[lo_i]), float(slopes[hi_i])]

    # OLS + t-test
    tm, ym = t.mean(), y.mean()
    sxx = ((t - tm) ** 2).sum()
    b = float(((t - tm) * (y - ym)).sum() / sxx)
    a = ym - b * tm
    resid = y - (a + b * t)
    se = math.sqrt((resid ** 2).sum() / (n - 2) / sxx)
    p_ols = t_two_sided_p(b / se, n - 2) if se > 0 else None

    return {
        "n": n,
        "start": float(t.min()),
        "end": float(t.max()),
        "senSlopePerYear": sen,
        "senCI95PerYear": ci,
        "intercept": intercept,
        "mkS": s,
        "mkZ": float(z),
        "mkP": float(p_mk),
        "lag1Autocorr": r1,
        "varianceInflation": ratio,
        "olsSlopePerYear": b,
        "olsP": p_ols,
        "significant": bool(p_mk < 0.05),
    }


def pixel_trend(t, y):
    """Lightweight per-pixel Sen slope + MK p (with the same correction)."""
    r = trend(t, y)
    if r is None:
        return np.nan, np.nan
    return r["senSlopePerYear"], r["mkP"]


def deseasonalize(months, values):
    """Subtract each calendar month's mean. months: 1..12 array. Returns anomalies."""
    months = np.asarray(months)
    values = np.asarray(values, float)
    out = np.full_like(values, np.nan)
    for m in range(1, 13):
        sel = months == m
        if sel.any():
            clim = np.nanmean(values[sel], axis=0) if np.isfinite(values[sel]).any() else np.nan
            out[sel] = values[sel] - clim
    return out


def r(x, nd=4):
    """Round floats recursively for compact JSON."""
    if isinstance(x, float):
        return round(x, nd) if math.isfinite(x) else None
    if isinstance(x, dict):
        return {k: r(v, nd) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [r(v, nd) for v in x]
    if isinstance(x, (np.floating,)):
        return r(float(x), nd)
    if isinstance(x, (np.integer,)):
        return int(x)
    return x
