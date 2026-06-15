# `packages/harmonisation` — raw → canonical weekly (Phase 1 · M3)

The transform that turns a client's ingested raw tables into the single **canonical
weekly table** Meridian trains on. The column-mapping step (M3 Path A / Path C) records
which raw column is which canonical field and persists that *mapping spec* in Supabase;
this package renders the SQL that applies it.

It is one of the four high-stakes test areas in the brief (§9), so the transform is a
**pure, dialect-aware renderer** plus a test that actually *runs* the SQL on fixtures
(via stdlib `sqlite3`) — not just eyeballs it.

## Canonical weekly schema (matches `services/meridian-runner/data.py`)

```
geo                text     region / DMA
time               date     week-start (Monday)
kpi                numeric  outcome (conversions or revenue)
revenue_per_kpi    numeric  optional
population         numeric  per-geo scale
<control>          numeric  one per configured control
<channel>_spend    numeric  one per channel, zero-filled
<channel>_impression numeric optional, one per channel
```

## Use

```python
from harmonise import render_harmonisation_sql, render_validation_checks

sql = render_harmonisation_sql(mapping, dialect="bigquery",
                               create_table="`client_ds.canonical_weekly`")
# run sql in the client's BigQuery dataset, then gate training on the checks:
for chk in render_validation_checks(mapping, "bigquery"):
    assert run(chk["sql"]) == 0, chk["name"]   # each must return zero violating rows
```

`dialect` is `bigquery` (production) or `sqlite` (the test harness). Only the
week-bucket expression and the identifier quote differ between them; the CTE structure,
the conditional-aggregation channel pivot, the KPI-spine joins and the zero-fill are
identical. The mapping spec shape is documented at the top of `harmonise.py`.

## Test

```bash
cd packages/harmonisation
python3 -m unittest discover -s tests      # 13 tests, zero deps; runs the SQL on sqlite
```

The execution test builds raw `raw_spend` / `raw_sales` / `raw_ctrl` fixtures spanning
two ISO weeks and asserts the canonical output: weekly buckets (Monday), per-channel
spend pivot, zero-fill for channels with no spend, summed KPI, carried population,
averaged controls — then runs the validation checks on clean and deliberately-broken data.
