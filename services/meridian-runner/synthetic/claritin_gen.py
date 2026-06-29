#!/usr/bin/env python3
"""Synthetic data generator for the Bayer / Claritin retail-media MMM demo.

Pure standard library (no numpy/pandas) so it runs anywhere. Emits a geo x week
panel in Meridian's geo_all_channels schema that the meridian-runner consumes
unchanged (columns: geo, time, {channel}_impression, {channel}_spend, controls,
KPI, revenue_per_kpi, population).

The point is REALISM, not invention: the skeleton is calibrated to public US
signals so a Bayer measurement person finds it believable.
  - Seasonality: spring tree/grass peak + fall ragweed bump + winter trough
    (US allergy category signature).
  - Geography: real DMAs, Census-scale populations, AAFA regional severity
    (South/Central/SE index high; Wichita / New Orleans / OKC / Tulsa / Memphis).
  - Channels: Walmart Connect, Amazon Ads, Linear TV, CTV, Meta, TikTok, Google
    Search, with believable spend levels, CPMs, adstock and saturation.
  - The hero story: Walmart Connect spend is concentrated in high-demand markets
    and weeks, so its NAIVE ROAS looks high while its TRUE incremental ROI
    (what Meridian recovers, controlling for pollen/baseline) is modest.

All figures are representative, calibrated to public benchmarks. NOT Bayer data.

Usage:  python3 services/meridian-runner/synthetic/claritin_gen.py
Output: data/clients/claritin/geo_all_channels.csv
"""
from __future__ import annotations
import csv, math, os, random
from datetime import date, timedelta

SEED = 20260629
rng = random.Random(SEED)

# ---- time: 156 weeks (3 years), weekly ---------------------------------------
START = date(2023, 4, 30)         # Sunday; 156 weeks ends ~2026-04-19, so the
N_WEEKS = 156                     # holdout (last 8 wks) lands on the spring ramp,
                                  # not the flat winter trough (avoids a degenerate
                                  # low-variance national holdout R²).
WEEKS = [START + timedelta(days=7 * i) for i in range(N_WEEKS)]

PRICE = 21.50                     # avg $ / unit (Claritin-ish OTC loratadine)

# ---- geography: real DMAs (name, population, allergy severity, walmart, amazon)
# population in people; severity ~ AAFA regional burden; walmart/amazon = channel
# strength index by market (Walmart skews South/rural, Amazon urban/affluent).
DMAS = [
    ("New York",          20_100_000, 0.85, 0.55, 1.40),
    ("Los Angeles",       13_200_000, 0.95, 0.65, 1.30),
    ("Chicago",            9_400_000, 0.95, 0.85, 1.10),
    ("Dallas-Ft. Worth",   7_700_000, 1.25, 1.30, 1.00),
    ("Houston",            7_100_000, 1.20, 1.30, 1.00),
    ("Washington DC",      6_300_000, 1.10, 0.80, 1.25),
    ("Philadelphia",       6_200_000, 1.05, 0.85, 1.15),
    ("Atlanta",            6_100_000, 1.35, 1.25, 1.05),
    ("Phoenix",            5_000_000, 0.80, 1.10, 1.05),
    ("Miami",              4_500_000, 1.10, 1.00, 1.05),
    ("Detroit",            4_300_000, 1.00, 0.90, 1.05),
    ("Seattle",            4_000_000, 0.70, 0.80, 1.40),
    ("Minneapolis",        3_700_000, 0.95, 1.00, 1.05),
    ("Tampa",              3_200_000, 1.20, 1.20, 1.00),
    ("Denver",             3_000_000, 0.85, 1.00, 1.10),
    ("Charlotte",          2_900_000, 1.25, 1.25, 0.95),
    ("St. Louis",          2_600_000, 1.20, 1.20, 0.95),
    ("San Antonio",        2_600_000, 1.30, 1.35, 0.90),
    ("Nashville",          2_300_000, 1.30, 1.30, 0.95),
    ("Kansas City",        2_200_000, 1.30, 1.30, 0.90),
    ("Oklahoma City",      1_500_000, 1.50, 1.40, 0.80),
    ("Memphis",            1_400_000, 1.50, 1.40, 0.85),
    ("New Orleans",        1_400_000, 1.55, 1.30, 0.85),
    ("Richmond",           1_300_000, 1.35, 1.20, 0.95),
    ("Tulsa",              1_000_000, 1.50, 1.40, 0.80),
    ("Wichita",              700_000, 1.60, 1.45, 0.75),
]

# ---- allergy seasonality: spring peak + fall ragweed bump, winter trough ------
def seasonal_index(d: date, severity: float) -> float:
    doy = d.timetuple().tm_yday
    spring = math.exp(-((doy - 105) ** 2) / (2 * 32 ** 2))   # ~mid-April
    fall   = math.exp(-((doy - 258) ** 2) / (2 * 28 ** 2))   # ~mid-September (ragweed)
    base = 0.30
    amp = 0.70 * spring + 0.42 * fall
    return base + amp * (0.6 + 0.4 * severity)               # severe markets swing more

# national seasonal pulse (severity=1.0) for media heavy-up
NAT_PULSE = [seasonal_index(d, 1.0) for d in WEEKS]

# ---- media channels ----------------------------------------------------------
# annual_spend (USD), cpm, adstock retention, geo_basis, pulsed (heavy-up in season),
# roi (target incremental revenue per $ before saturation).
CHANNELS = {
    "linear_tv":       dict(annual=16_000_000, cpm=18.0, adstock=0.65, basis="pop",     pulsed=True,  roi=1.5),
    "ctv":             dict(annual= 7_000_000, cpm=34.0, adstock=0.45, basis="pop",     pulsed=True,  roi=1.9),
    "walmart_connect": dict(annual= 9_000_000, cpm=12.0, adstock=0.20, basis="walmart", pulsed=True,  roi=2.0),
    "amazon_ads":      dict(annual= 5_000_000, cpm=11.0, adstock=0.20, basis="amazon",  pulsed=True,  roi=2.4),
    "meta":            dict(annual= 6_000_000, cpm= 9.0, adstock=0.30, basis="pop",     pulsed=True,  roi=2.0),
    "tiktok":          dict(annual= 3_000_000, cpm= 7.0, adstock=0.25, basis="pop",     pulsed=False, roi=2.6),
    "google_search":   dict(annual= 6_000_000, cpm=80.0, adstock=0.10, basis="demand",  pulsed=True,  roi=3.0),
}
CHANNEL_ORDER = list(CHANNELS)

def geo_basis_weight(g, basis: str) -> float:
    name, pop, sev, wal, amz = g
    p = pop / 1_000_000
    if basis == "pop":     return p
    if basis == "walmart": return p * wal * (0.7 + 0.3 * sev)
    if basis == "amazon":  return p * amz
    if basis == "demand":  return p * (0.6 + 0.4 * sev)   # search tracks demand
    return p

# ---- build the panel ---------------------------------------------------------
# Per (geo, channel): weekly spend = total * geoW * weekW (+noise). Then adstock,
# saturation, and a revenue response. Baseline demand dominates (~78%).
BASE_PER_CAPITA_WK = 0.0018       # units/person/week (tuned to ~$350M/yr brand, ~78% baseline)

def adstock(series, r):
    out, carry = [], 0.0
    for x in series:
        carry = x + r * carry
        out.append((1 - r) * carry)   # scale-preserving
    return out

rows = []
# precompute channel geo weights and week weights
geo_w = {ch: [geo_basis_weight(g, p["basis"]) for g in DMAS] for ch, p in CHANNELS.items()}
for ch, p in CHANNELS.items():
    sw = sum(geo_w[ch]);  geo_w[ch] = [w / sw for w in geo_w[ch]]
week_w = {}
for ch, p in CHANNELS.items():
    base = [(0.45 + 0.55 * NAT_PULSE[i]) if p["pulsed"] else (0.85 + 0.15 * NAT_PULSE[i]) for i in range(N_WEEKS)]
    sw = sum(base); week_w[ch] = [w / sw for w in base]

# accumulators for the validation summary
spend_tot = {ch: 0.0 for ch in CHANNELS}
incr_rev_tot = {ch: 0.0 for ch in CHANNELS}
base_units_tot = 0.0
total_units_tot = 0.0

for gi, g in enumerate(DMAS):
    name, pop, sev, wal, amz = g
    # weekly spend + adstock per channel for this geo
    spend = {}
    for ch, p in CHANNELS.items():
        total = p["annual"] * 3.0
        s = [max(0.0, total * geo_w[ch][gi] * week_w[ch][wk] * rng.uniform(0.88, 1.12)) for wk in range(N_WEEKS)]
        spend[ch] = s
    adst = {ch: adstock(spend[ch], CHANNELS[ch]["adstock"]) for ch in CHANNELS}
    # per-channel saturation half-point = 3x mean adstocked spend in this geo
    halfsat = {ch: 3.0 * (sum(adst[ch]) / N_WEEKS + 1e-6) for ch in CHANNELS}

    base_geo_wk = BASE_PER_CAPITA_WK * pop   # base units/week for this geo
    for wk, d in enumerate(WEEKS):
        si = seasonal_index(d, sev)
        baseline_units = base_geo_wk * (0.55 + si) * (1.0 + 0.03 * math.sin(wk / 9.0)) * rng.uniform(0.97, 1.03)
        # competitor pressure (Zyrtec/Allegra) - seasonal, mildly suppresses Claritin
        competitor = (0.5 + si) * rng.uniform(0.92, 1.08)
        # promo: occasional rollback weeks lift units
        promo = 1.0 if rng.random() < 0.16 else 0.0
        promo_units = baseline_units * 0.18 * promo
        # price index: promo weeks cheaper
        price_index = (0.95 if promo else 1.0) * rng.uniform(0.98, 1.02)

        incr_units = 0.0
        for ch, p in CHANNELS.items():
            a = adst[ch][wk]
            sat = halfsat[ch] / (halfsat[ch] + a)              # diminishing returns
            incr_rev = p["roi"] * a * sat
            iu = incr_rev / PRICE
            incr_units += iu
            spend_tot[ch] += spend[ch][wk]
            incr_rev_tot[ch] += incr_rev

        comp_drag = -baseline_units * 0.04 * (competitor - 1.0)
        units = max(0.0, baseline_units + incr_units + promo_units + comp_drag + rng.gauss(0, base_geo_wk * 0.03))
        rev_per_unit = PRICE * price_index

        base_units_tot += baseline_units
        total_units_tot += units

        row = {"geo": name, "time": d.isoformat(), "population": round(pop, 1)}
        for ch in CHANNEL_ORDER:
            row[f"{ch}_impression"] = round(spend[ch][wk] / CHANNELS[ch]["cpm"] * 1000.0, 1)
            row[f"{ch}_spend"] = round(spend[ch][wk], 2)
        # organic branded search: tracks the demand DRIVERS (not the realized noisy
        # target, which would leak), so it's a believable correlate, not a proxy.
        row["Organic_search_impression"] = round(base_geo_wk * (0.5 + si) * 35 * rng.uniform(0.85, 1.15), 1)
        row["pollen_index_control"] = round(si, 4)
        row["competitor_spend_control"] = round(competitor, 4)
        row["price_index_control"] = round(price_index, 4)
        row["Promo"] = round(promo, 1)
        row["units"] = round(units, 2)
        row["revenue_per_unit"] = round(rev_per_unit, 4)
        rows.append(row)

# ---- write CSV ---------------------------------------------------------------
cols = ["geo", "time"]
for ch in CHANNEL_ORDER:
    cols += [f"{ch}_impression", f"{ch}_spend"]
cols += ["Organic_search_impression", "pollen_index_control", "competitor_spend_control",
         "price_index_control", "Promo", "units", "revenue_per_unit", "population"]

out_dir = os.path.join("data", "clients", "claritin")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "geo_all_channels.csv")
with open(out_path, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)

# ---- validation summary ------------------------------------------------------
total_rev = total_units_tot * PRICE
incr_rev_all = sum(incr_rev_tot.values())
print(f"Wrote {len(rows):,} rows  ({len(DMAS)} DMAs x {N_WEEKS} weeks)  -> {out_path}")
print(f"Annual brand revenue ~ ${total_rev/3/1e6:,.0f}M   | baseline share ~ {base_units_tot/total_units_tot*100:,.0f}%   | media-driven ~ {incr_rev_all/total_rev*100:,.0f}%")
print(f"Total media spend ~ ${sum(spend_tot.values())/3/1e6:,.1f}M/yr")
print(f"{'channel':16} {'$spend/yr':>11} {'true incr ROI':>14}  (reported ROAS is a presentation-layer figure, set per channel)")
for ch in CHANNEL_ORDER:
    sp = spend_tot[ch]
    roi = incr_rev_tot[ch] / sp if sp else 0
    print(f"{ch:16} {sp/3/1e6:>10.1f}M {roi:>13.2f}x")
# seasonality peak check
peak_wk = max(range(N_WEEKS), key=lambda i: NAT_PULSE[i])
print(f"Seasonality peak week: {WEEKS[peak_wk].isoformat()} (index {NAT_PULSE[peak_wk]:.2f})  | trough index {min(NAT_PULSE):.2f}")
