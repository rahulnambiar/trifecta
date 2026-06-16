"""Pre-training data guardrails for the Meridian runner (brief §9).

The platform must never quietly drop a channel or geo to make a model fit.
Meridian doesn't — it samples the full spec it's given — but a data/mapping
mistake can still feed it a *dead* channel (all-zero spend) or coverage too thin
to identify the model. This module:

  * builds a **manifest** — what went IN vs what got MODELLED — embedded in
    results.json so the sign-off reviewer can SEE nothing was dropped; and
  * runs **hard gates** over the training data BEFORE sampling. A hard ('error')
    violation raises GuardrailError, which aborts the run (the version goes back
    to draft, never to in_review) rather than training a silently-degraded model.

The gate logic (`check_manifest`) is pure Python and stdlib-testable; only
`build_manifest` touches pandas.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)

DEFAULT_THRESHOLDS = {
    "min_geos": 1,                        # national (1 geo) is valid; 0 is not
    "min_weeks": 52,                      # at least a year of weekly data (warn)
    "min_nonzero_weeks_per_channel": 4,   # a channel needs signal to be identifiable (warn)
}


class GuardrailError(RuntimeError):
    """A hard data guardrail failed — training must not proceed."""


def build_manifest(df, channels, *, geo_col="geo", time_col="time",
                   display=None, spend_suffix="_spend") -> dict:
    """Extract the coverage manifest from the training DataFrame (pandas)."""
    display = display or (lambda c: c)
    if geo_col not in df.columns or time_col not in df.columns:
        raise GuardrailError(
            f"training data is missing '{geo_col}'/'{time_col}' column(s) — cannot verify coverage"
        )
    per_channel = []
    for c in channels:
        col = f"{c}{spend_suffix}"
        if col not in df.columns:
            # the configured channel isn't even present as a column — a hard miss
            per_channel.append({"channel": display(c), "id": c, "in_data": False,
                                "spend_total": 0.0, "nonzero_weeks": 0})
            continue
        spend = df[col].fillna(0)
        per_channel.append({
            "channel": display(c), "id": c, "in_data": True,
            "spend_total": float(spend.sum()),
            "nonzero_weeks": int(df.loc[spend > 0, time_col].nunique()),
        })
    return {
        "rows": int(len(df)),
        "geos": int(df[geo_col].nunique()),
        "weeks": int(df[time_col].nunique()),
        "channels_in_config": len(channels),
        "channels_modelled": sum(1 for c in per_channel if c["spend_total"] > 0),
        "channels": per_channel,
    }


def check_manifest(manifest: dict, thresholds: dict | None = None) -> list[dict]:
    """Run the gates over a built manifest. Returns [{name, severity, detail}].

    severity 'error' = hard stop (a channel/geo silently lost / unidentifiable);
    severity 'warn'  = surface it, let the operator decide. Pure — no pandas.
    """
    t = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    v: list[dict] = []
    for ch in manifest.get("channels", []):
        if not ch.get("in_data", True):
            v.append({"name": f"channel_missing:{ch['id']}", "severity": "error",
                      "detail": f"channel '{ch['channel']}' is configured but absent from the "
                                f"training data — it would be dropped from the model"})
        elif ch.get("spend_total", 0) <= 0:
            v.append({"name": f"channel_all_zero:{ch['id']}", "severity": "error",
                      "detail": f"channel '{ch['channel']}' has zero total spend — unmapped or "
                                f"mislabelled; it would be modelled as contributing nothing"})
        elif ch.get("nonzero_weeks", 0) < t["min_nonzero_weeks_per_channel"]:
            v.append({"name": f"channel_thin:{ch['id']}", "severity": "warn",
                      "detail": f"channel '{ch['channel']}' has spend in only "
                                f"{ch['nonzero_weeks']} week(s)"})
    if manifest.get("geos", 0) < t["min_geos"]:
        v.append({"name": "too_few_geos", "severity": "error",
                  "detail": f"{manifest.get('geos', 0)} geo(s) < required {t['min_geos']}"})
    if manifest.get("weeks", 0) < t["min_weeks"]:
        v.append({"name": "too_few_weeks", "severity": "warn",
                  "detail": f"{manifest.get('weeks', 0)} weeks < recommended {t['min_weeks']}"})
    return v


def enforce_manifest(manifest: dict, thresholds=None, abort_on_error=True) -> dict:
    """Run the gates over a built manifest, log them, abort on any hard violation.

    Returns {manifest, violations, passed, thresholds}. Raises GuardrailError when
    there is an 'error' violation and abort_on_error is set (the default). Pure —
    no pandas — so it's stdlib-testable.
    """
    violations = check_manifest(manifest, thresholds)
    errors = [x for x in violations if x["severity"] == "error"]
    for w in (x for x in violations if x["severity"] == "warn"):
        log.warning("guardrail WARN — %s: %s", w["name"], w["detail"])
    for e in errors:
        log.error("guardrail FAILED — %s: %s", e["name"], e["detail"])
    log.info("data manifest: %d rows · %d geos · %d weeks · %d/%d channels with spend",
             manifest["rows"], manifest["geos"], manifest["weeks"],
             manifest["channels_modelled"], manifest["channels_in_config"])
    result = {"manifest": manifest, "violations": violations, "passed": not errors,
              "thresholds": {**DEFAULT_THRESHOLDS, **(thresholds or {})}}
    if errors and abort_on_error:
        raise GuardrailError(
            f"{len(errors)} data guardrail(s) failed; training aborted — "
            + "; ".join(e["detail"] for e in errors)
        )
    return result


def enforce(df, channels, *, geo_col="geo", time_col="time", display=None,
            thresholds=None, abort_on_error=True) -> dict:
    """Build the manifest from the training DataFrame, then enforce the gates."""
    manifest = build_manifest(df, channels, geo_col=geo_col, time_col=time_col, display=display)
    return enforce_manifest(manifest, thresholds=thresholds, abort_on_error=abort_on_error)
