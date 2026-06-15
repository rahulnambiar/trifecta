# Sample ingestion files (Phase 1 · M3 testing)

Synthetic, deterministic CSVs for exercising the **Data Pipeline** upload + column-mapping flow.
Upload either in the app (Data Pipeline → Upload CSV), then map columns and save.

## `aeon_marketing_weekly.csv` (520 rows — the clean one)
Long format, one row per (week × region × channel).

| canonical field | column |
|---|---|
| Week / date | `week_start` |
| Geography | `region` |
| Outcome (KPI) | `conversions` |
| Population | `population` |
| Channel column | `channel` |
| Spend | `spend_sgd` |
| Impressions | `impressions` |
| Controls | `sentiment_index`, `competitor_spend_sgd` |

Channels to include: Meta, YouTube, TV, Paid Search, TikTok.

## `aeon_marketing_daily.csv` (1800 rows — agency-style, different headers)
Daily, different column names — to test daily→weekly bucketing and mapping arbitrary headers:
`Date → date`, `DMA → geo`, `Orders → KPI`, `Medium → channel column`, `Cost → spend`, etc.

> Numbers are fictional (seeded RNG). KPI/population/controls repeat across a week's channel rows;
> the harmonisation step aggregates per (geo, week).
