"""Harmonisation — raw ingested tables → canonical weekly model table (Phase 1 · M3).

This is the SQL that turns whatever shape a client's data arrives in (after the
column-mapping step records which raw column is which canonical field) into the single
**canonical weekly table** Meridian trains on. It is one of the four high-stakes test
areas in the brief (§9), so the transform is a *pure renderer* + a SQLite-executable
test: we actually run the harmonisation on fixtures, not just eyeball the SQL.

The renderer is **dialect-aware**: it emits BigQuery SQL for production (writing to the
client's BQ dataset) and SQLite for the test harness. Only two things differ between
dialects — the week-bucket expression and the identifier quote — everything else
(CTEs, conditional-aggregation channel pivot, joins, COALESCE) is portable.

Canonical weekly schema (matches services/meridian-runner/data.py ingestion):
    geo              text     — region / DMA
    time             date     — week-start (Monday)
    kpi              numeric  — the outcome (conversions or revenue)
    revenue_per_kpi  numeric  — optional
    population       numeric  — per-geo scale
    <control_cols>   numeric  — one per configured control
    <channel>_spend  numeric  — one per configured media channel (zero-filled)
    <channel>_impression numeric — optional, one per channel

Mapping spec (what the M3 column-mapping UI persists in Supabase, passed in here):
    {
      "media": {                         # required — the spend source
        "table": "raw_spend",
        "date": "day", "geo": "region",
        "channel": "channel_name",       # the column holding the channel label
        "spend": "cost",
        "impressions": "impr"            # optional
      },
      "kpi": {                           # required — the outcome source
        "table": "raw_sales",
        "date": "day", "geo": "region",
        "kpi": "orders",
        "revenue_per_kpi": null,         # optional column
        "population": "pop"              # optional column
      },
      "controls": {                      # optional
        "table": "raw_ctrl", "date": "day", "geo": "region",
        "columns": {"sentiment": "sent_idx", "competitor": "comp_sales"}
      },
      "channels": ["Meta", "YouTube", "TV", "Paid Search", "TikTok"],
      "week_start": "monday"             # informational; Monday is the only supported start
    }
"""
from __future__ import annotations

import re
from typing import Any

SUPPORTED_DIALECTS = ("bigquery", "sqlite")


class MappingError(ValueError):
    """Raised when a mapping spec can't be rendered into harmonisation SQL."""


def slug(name: str) -> str:
    """Channel/control label → a column-safe snake_case identifier ('Paid Search'→'paid_search')."""
    s = re.sub(r"[^0-9a-zA-Z]+", "_", str(name).strip().lower()).strip("_")
    if not s:
        raise MappingError(f"cannot derive a column name from {name!r}")
    if s[0].isdigit():
        s = "c_" + s
    return s


def _qident(name: str, dialect: str) -> str:
    if dialect == "bigquery":
        return "`" + name.replace("`", "") + "`"
    return '"' + name.replace('"', '""') + '"'   # sqlite / standard


def _week_expr(col: str, dialect: str) -> str:
    """Bucket a date column to the Monday-of-week, per dialect."""
    if dialect == "bigquery":
        return f"DATE_TRUNC(CAST({col} AS DATE), WEEK(MONDAY))"
    # sqlite: subtract (weekday-as-monday-0) days. strftime %w: 0=Sun..6=Sat.
    return f"date({col}, '-' || ((CAST(strftime('%w', {col}) AS INTEGER) + 6) % 7) || ' days')"


def _require(d: dict, key: str, where: str) -> Any:
    if not isinstance(d, dict) or key not in d or d[key] in (None, ""):
        raise MappingError(f"{where}.{key} is required")
    return d[key]


def channel_columns(mapping: dict) -> list[str]:
    """The per-channel canonical column names this mapping will produce."""
    chans = mapping.get("channels") or []
    if not isinstance(chans, list) or not chans:
        raise MappingError("mapping.channels must be a non-empty list")
    cols = []
    for ch in chans:
        cols.append(f"{slug(ch)}_spend")
        if (mapping.get("media") or {}).get("impressions"):
            cols.append(f"{slug(ch)}_impression")
    return cols


def control_columns(mapping: dict) -> list[str]:
    cols = ((mapping.get("controls") or {}).get("columns")) or {}
    return [slug(k) for k in cols.keys()]


def canonical_columns(mapping: dict) -> list[str]:
    """Full ordered column list of the canonical weekly table for this mapping."""
    cols = ["geo", "time", "kpi"]
    if (mapping.get("kpi") or {}).get("revenue_per_kpi"):
        cols.append("revenue_per_kpi")
    if (mapping.get("kpi") or {}).get("population"):
        cols.append("population")
    cols += control_columns(mapping)
    cols += channel_columns(mapping)
    return cols


def render_harmonisation_sql(mapping: dict, dialect: str = "bigquery", *, create_table: str | None = None) -> str:
    """Render the raw→canonical-weekly SELECT (optionally wrapped in CREATE TABLE).

    The KPI source is the spine — it defines which (geo, week) rows are modelled.
    Channel spend is pivoted wide via conditional aggregation and zero-filled.
    """
    if dialect not in SUPPORTED_DIALECTS:
        raise MappingError(f"dialect must be one of {SUPPORTED_DIALECTS}, got {dialect!r}")

    media = mapping.get("media") or {}
    kpi = mapping.get("kpi") or {}
    m_tbl = _require(media, "table", "media"); m_date = _require(media, "date", "media")
    m_geo = _require(media, "geo", "media"); m_chan = _require(media, "channel", "media")
    m_spend = _require(media, "spend", "media"); m_impr = media.get("impressions")
    k_tbl = _require(kpi, "table", "kpi"); k_date = _require(kpi, "date", "kpi")
    k_geo = _require(kpi, "geo", "kpi"); k_kpi = _require(kpi, "kpi", "kpi")
    k_rev = kpi.get("revenue_per_kpi"); k_pop = kpi.get("population")
    chans = mapping.get("channels") or []
    if not chans:
        raise MappingError("mapping.channels must be a non-empty list")

    q = lambda n: _qident(n, dialect)
    mweek = _week_expr(m_date, dialect)
    kweek = _week_expr(k_date, dialect)

    # ── media_p: weekly per-channel spend (+ impressions), pivoted wide ──
    pivots = []
    for ch in chans:
        pivots.append(
            f"    SUM(CASE WHEN {m_chan} = '{ch}' THEN {m_spend} ELSE 0 END) AS {q(slug(ch)+'_spend')}"
        )
        if m_impr:
            pivots.append(
                f"    SUM(CASE WHEN {m_chan} = '{ch}' THEN {m_impr} ELSE 0 END) AS {q(slug(ch)+'_impression')}"
            )
    media_p = (
        "media_p AS (\n"
        f"  SELECT {m_geo} AS geo, {mweek} AS time,\n" + ",\n".join(pivots) + "\n"
        f"  FROM {m_tbl}\n"
        f"  GROUP BY geo, time\n"
        ")"
    )

    # ── kpi_w: the spine — weekly outcome (+ revenue_per_kpi, population) ──
    kpi_sel = [f"{k_geo} AS geo", f"{kweek} AS time", f"SUM({k_kpi}) AS kpi"]
    if k_rev:
        kpi_sel.append(f"AVG({k_rev}) AS revenue_per_kpi")
    if k_pop:
        kpi_sel.append(f"MAX({k_pop}) AS population")
    kpi_w = (
        "kpi_w AS (\n"
        f"  SELECT " + ", ".join(kpi_sel) + "\n"
        f"  FROM {k_tbl}\n"
        f"  GROUP BY geo, time\n"
        ")"
    )

    ctes = [media_p, kpi_w]

    # ── ctrl_w: optional weekly control levels ──
    ctrl = mapping.get("controls") or {}
    ctrl_cols = (ctrl.get("columns") or {})
    if ctrl_cols:
        c_tbl = _require(ctrl, "table", "controls"); c_date = _require(ctrl, "date", "controls")
        c_geo = _require(ctrl, "geo", "controls"); cweek = _week_expr(c_date, dialect)
        csel = [f"{c_geo} AS geo", f"{cweek} AS time"]
        for canon, raw in ctrl_cols.items():
            csel.append(f"AVG({raw}) AS {q(slug(canon))}")
        ctes.append(
            "ctrl_w AS (\n  SELECT " + ", ".join(csel) + f"\n  FROM {c_tbl}\n  GROUP BY geo, time\n)"
        )

    # ── final SELECT: KPI spine, left-join media + controls, zero-fill spend ──
    sel = ["k.geo AS geo", "k.time AS time", "k.kpi AS kpi"]
    if k_rev:
        sel.append("k.revenue_per_kpi AS revenue_per_kpi")
    if k_pop:
        sel.append("k.population AS population")
    for canon in ctrl_cols.keys():
        sel.append(f"c.{q(slug(canon))} AS {q(slug(canon))}")
    for ch in chans:
        sel.append(f"COALESCE(m.{q(slug(ch)+'_spend')}, 0) AS {q(slug(ch)+'_spend')}")
        if m_impr:
            sel.append(f"COALESCE(m.{q(slug(ch)+'_impression')}, 0) AS {q(slug(ch)+'_impression')}")

    joins = "  FROM kpi_w k\n  LEFT JOIN media_p m ON m.geo = k.geo AND m.time = k.time\n"
    if ctrl_cols:
        joins += "  LEFT JOIN ctrl_w c ON c.geo = k.geo AND c.time = k.time\n"

    body = "WITH " + ",\n".join(ctes) + "\nSELECT\n  " + ",\n  ".join(sel) + "\n" + joins + "  ORDER BY geo, time"
    if create_table:
        verb = "CREATE OR REPLACE TABLE" if dialect == "bigquery" else "CREATE TABLE"
        return f"{verb} {create_table} AS\n{body}"
    return body


def render_validation_checks(mapping: dict, dialect: str = "bigquery", canonical: str = "canonical_weekly") -> list[dict]:
    """SQL checks that must each return ZERO violating rows before training.

    'Validate shape before training' (brief §6). Returns [{name, sql, expect_zero}].
    """
    q = lambda n: _qident(n, dialect)
    chan_spend = [f"{slug(ch)}_spend" for ch in (mapping.get("channels") or [])]
    pop = (mapping.get("kpi") or {}).get("population")

    checks = [
        {"name": "no_null_keys",
         "sql": f"SELECT COUNT(*) FROM {canonical} WHERE geo IS NULL OR time IS NULL OR kpi IS NULL"},
        {"name": "no_negative_kpi",
         "sql": f"SELECT COUNT(*) FROM {canonical} WHERE kpi < 0"},
        {"name": "no_duplicate_geo_week",
         "sql": f"SELECT COUNT(*) FROM (SELECT geo, time FROM {canonical} GROUP BY geo, time HAVING COUNT(*) > 1) t"},
    ]
    if pop:
        checks.append({"name": "population_positive",
                       "sql": f"SELECT COUNT(*) FROM {canonical} WHERE population IS NULL OR population <= 0"})
    for col in chan_spend:
        checks.append({"name": f"no_negative_{col}",
                       "sql": f"SELECT COUNT(*) FROM {canonical} WHERE {q(col)} < 0"})
    for c in checks:
        c["expect_zero"] = True
    return checks


# ── Coverage / no-silent-drop guardrails ─────────────────────────────────────
# render_validation_checks above guards row *integrity*. These guard against the
# "stupid errors" a fit must never make on its own (brief §9): a channel modelled
# as all-zero (a mapping miss), a geo/week set too thin to identify the model, or
# raw spend that silently fell out of the model because a channel/campaign wasn't
# mapped. They run on the canonical table BEFORE training; any violation stops it.
DEFAULT_THRESHOLDS = {
    "min_geos": 1,                        # national (1 geo) is valid; 0 is not
    "min_weeks": 52,                      # at least a year of weekly data
    "min_nonzero_weeks_per_channel": 4,   # a channel needs signal to be identifiable
    "reconciliation_rel_tol": 0.005,      # ≤0.5% of raw spend may be unaccounted (float noise)
    "reconciliation_abs_tol": 1.0,
}


def _gate(name, sql, *, severity="error", detail=""):
    return {"name": name, "sql": sql, "expect_zero": True, "severity": severity, "detail": detail}


def _mapped_total_sql(mapping: dict, canonical: str, q) -> str:
    chans = mapping.get("channels") or []
    terms = " + ".join(f"COALESCE(SUM({q(slug(ch) + '_spend')}),0)" for ch in chans)
    return f"SELECT {terms} FROM {canonical}"


def render_guardrail_checks(mapping: dict, dialect: str = "bigquery",
                            canonical: str = "canonical_weekly", thresholds: dict | None = None) -> list[dict]:
    """Coverage + reconciliation gates — each returns >0 ⇒ STOP before training.

    Returns [{name, sql, expect_zero, severity, detail}]. ``severity`` is 'error'
    (a hard stop) or 'warn' (surface, let the operator decide). Never silently
    drops a channel/geo/campaign — it makes the loss *visible* and blocks the run.
    """
    if dialect not in SUPPORTED_DIALECTS:
        raise MappingError(f"dialect must be one of {SUPPORTED_DIALECTS}, got {dialect!r}")
    t = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    q = lambda n: _qident(n, dialect)
    chans = mapping.get("channels") or []
    if not chans:
        raise MappingError("mapping.channels must be a non-empty list")
    media = mapping.get("media") or {}
    m_tbl = _require(media, "table", "media")
    m_spend = _require(media, "spend", "media")
    m_chan = _require(media, "channel", "media")

    checks: list[dict] = []
    for ch in chans:
        col = slug(ch) + "_spend"
        # a modelled channel that is entirely zero is almost always a mapping miss
        checks.append(_gate(
            f"channel_not_all_zero_{slug(ch)}",
            f"SELECT CASE WHEN (SELECT COALESCE(SUM({q(col)}),0) FROM {canonical}) <= 0 THEN 1 ELSE 0 END",
            detail=f"channel '{ch}' has zero total spend — likely an unmapped or mislabelled source",
        ))
        # …and it needs enough weeks with spend to be identifiable
        checks.append(_gate(
            f"channel_enough_signal_{slug(ch)}",
            f"SELECT CASE WHEN (SELECT COUNT(DISTINCT time) FROM {canonical} WHERE {q(col)} > 0)"
            f" < {int(t['min_nonzero_weeks_per_channel'])} THEN 1 ELSE 0 END",
            severity="warn",
            detail=f"channel '{ch}' has fewer than {t['min_nonzero_weeks_per_channel']} weeks with spend",
        ))

    checks.append(_gate(
        "enough_geos",
        f"SELECT CASE WHEN (SELECT COUNT(DISTINCT geo) FROM {canonical}) < {int(t['min_geos'])} THEN 1 ELSE 0 END",
        detail=f"fewer than {t['min_geos']} geo(s) in the modelling table",
    ))
    checks.append(_gate(
        "enough_weeks",
        f"SELECT CASE WHEN (SELECT COUNT(DISTINCT time) FROM {canonical}) < {int(t['min_weeks'])} THEN 1 ELSE 0 END",
        severity="warn",
        detail=f"fewer than {t['min_weeks']} weeks of data",
    ))

    # Reconciliation — every raw dollar must reach a modelled channel, or be
    # explicitly acknowledged as out of scope (mapping.allow_unmapped_channels).
    # This is the gate that catches a campaign/channel silently dropped at mapping.
    ack = mapping.get("allow_unmapped_channels") or []
    where = ""
    if ack:
        lst = ", ".join("'" + str(a).replace("'", "''") + "'" for a in ack)
        where = f" WHERE {m_chan} NOT IN ({lst})"
    raw_total = f"(SELECT COALESCE(SUM({m_spend}),0) FROM {m_tbl}{where})"
    mapped_total = f"({_mapped_total_sql(mapping, canonical, q)})"
    rel = float(t["reconciliation_rel_tol"]); ab = float(t["reconciliation_abs_tol"])
    checks.append(_gate(
        "spend_reconciled",
        f"SELECT CASE WHEN ABS({raw_total} - {mapped_total}) > {rel} * {raw_total} + {ab} THEN 1 ELSE 0 END",
        detail="raw spend is not fully accounted for by the modelled channels "
               "(an unmapped channel/campaign?). Map it, or list it in allow_unmapped_channels.",
    ))
    return checks


def coverage_manifest_queries(mapping: dict, dialect: str = "bigquery",
                              canonical: str = "canonical_weekly") -> dict:
    """Scalar queries that build the run manifest the reviewer sees at sign-off:
    what went IN vs what got MODELLED, so a dropped channel/geo/campaign is visible.

    Returns {scalars:{name:sql}, per_channel:{channel:{spend_total,nonzero_weeks}},
             raw_per_channel_sql, channels}. The runner executes these and stores the
            resulting numbers alongside the posterior.
    """
    if dialect not in SUPPORTED_DIALECTS:
        raise MappingError(f"dialect must be one of {SUPPORTED_DIALECTS}, got {dialect!r}")
    q = lambda n: _qident(n, dialect)
    chans = mapping.get("channels") or []
    if not chans:
        raise MappingError("mapping.channels must be a non-empty list")
    media = mapping.get("media") or {}
    m_tbl = _require(media, "table", "media")
    m_spend = _require(media, "spend", "media")
    m_chan = _require(media, "channel", "media")

    scalars = {
        "rows": f"SELECT COUNT(*) FROM {canonical}",
        "geos": f"SELECT COUNT(DISTINCT geo) FROM {canonical}",
        "weeks": f"SELECT COUNT(DISTINCT time) FROM {canonical}",
        "raw_spend_total": f"SELECT COALESCE(SUM({m_spend}),0) FROM {m_tbl}",
        "mapped_spend_total": _mapped_total_sql(mapping, canonical, q),
    }
    per_channel = {}
    for ch in chans:
        col = slug(ch) + "_spend"
        per_channel[ch] = {
            "spend_total": f"SELECT COALESCE(SUM({q(col)}),0) FROM {canonical}",
            "nonzero_weeks": f"SELECT COUNT(DISTINCT time) FROM {canonical} WHERE {q(col)} > 0",
        }
    raw_per_channel_sql = (
        f"SELECT {m_chan} AS channel, COALESCE(SUM({m_spend}),0) AS spend "
        f"FROM {m_tbl} GROUP BY {m_chan}"
    )
    return {"scalars": scalars, "per_channel": per_channel,
            "raw_per_channel_sql": raw_per_channel_sql, "channels": list(chans)}
