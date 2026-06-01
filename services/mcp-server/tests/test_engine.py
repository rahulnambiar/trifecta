"""Engine tests against the real posterior bundle (no Meridian needed).

Run: python -m pytest services/mcp-server/tests
(or: python services/mcp-server/tests/test_engine.py for a quick smoke print)
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from mcp_server.engine import MMMEngine  # noqa: E402

HERE = os.path.dirname(__file__)
# Prefer a real bundle if present (set RESULTS_JSON), else the checked-in fixture.
RESULTS = os.environ.get("RESULTS_JSON", os.path.join(HERE, "fixtures", "results.json"))


def _engine():
    with open(RESULTS) as f:
        return MMMEngine(json.load(f))


def test_channel_contribution_has_intervals():
    e = _engine()
    out = e.channel_contribution()
    assert out["channels"], "expected channels"
    for c in out["channels"]:
        assert "roi" in c and c["roi"]["ci_lo"] is not None and c["roi"]["ci_hi"] is not None
        assert c["roi"]["ci_lo"] <= c["roi"]["median"] <= c["roi"]["ci_hi"]


def test_marginal_roi_present():
    e = _engine()
    assert e.marginal_roi()["channels"]


def test_model_health_reports_rhat_and_mape():
    e = _engine()
    h = e.model_health()
    assert h["max_rhat"] is not None
    assert h["holdout_mape"] is not None
    assert isinstance(h["converged"], bool)


def test_response_curve_resolves_display_name():
    e = _engine()
    name = e.channels[0]
    out = e.response_curve(name)
    assert "error" not in out
    assert out["points"], "expected curve points"
    assert any(p.get("ci_lo") is not None for p in out["points"])


def test_response_curve_unknown_channel():
    assert "error" in _engine().response_curve("Nonexistent")


def test_optimize_budget_default():
    e = _engine()
    out = e.optimize_budget()
    assert out["mode"] == "meridian_optimal"
    assert out["allocation"] and out["expected_lift"]


def test_optimize_budget_custom_is_approx():
    e = _engine()
    cur = sum((r.get("current_spend") or 0) for r in e.optimize_budget()["allocation"])
    out = e.optimize_budget(total_budget=cur * 1.2)
    assert out["mode"] == "response_curve_approximation"
    assert out["allocation"]


def test_run_budget_scenario_projects_delta():
    e = _engine()
    name = e.channels[0]
    cur = e._current_spend(e._resolve(name))
    out = e.run_budget_scenario({name: cur * 1.5})
    assert out["scenario_incremental_outcome"]["median"] is not None
    assert "delta" in out


if __name__ == "__main__":
    e = _engine()
    print("channels:", e.channels)
    print("health:", json.dumps(e.model_health(), indent=2)[:400])
    print("\ncontribution[0]:", json.dumps(e.channel_contribution()["channels"][0], indent=2))
    name = e.channels[0]
    print(f"\nscenario (+50% {name}):", json.dumps(e.run_budget_scenario({name: e._current_spend(e._resolve(name)) * 1.5}), indent=2)[:600])
    print("\noptimize default lift:", e.optimize_budget()["expected_lift"])
