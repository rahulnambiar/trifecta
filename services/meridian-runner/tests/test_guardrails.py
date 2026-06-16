"""Tests for the pre-training data guardrails (brief §9).

The gate logic (check_manifest / enforce_manifest) is pure Python, so it runs with
zero deps. build_manifest + enforce touch pandas, so those tests are skipped where
pandas isn't installed (they run in the training image / CI).

    cd services/meridian-runner
    python3 -m unittest discover -s tests
"""
import unittest

from meridian_runner import guardrails as G
from meridian_runner.guardrails import GuardrailError


def manifest(channels, *, geos=50, weeks=156):
    return {
        "rows": geos * weeks, "geos": geos, "weeks": weeks,
        "channels_in_config": len(channels),
        "channels_modelled": sum(1 for c in channels if c.get("spend_total", 0) > 0),
        "channels": channels,
    }


def ch(name, spend_total=1000.0, nonzero_weeks=100, in_data=True):
    return {"channel": name, "id": name, "in_data": in_data,
            "spend_total": spend_total, "nonzero_weeks": nonzero_weeks}


class TestGates(unittest.TestCase):
    def test_clean_manifest_has_no_violations(self):
        self.assertEqual(G.check_manifest(manifest([ch("Meta"), ch("TV"), ch("TikTok")])), [])

    def test_all_zero_channel_is_a_hard_error(self):
        v = G.check_manifest(manifest([ch("Meta"), ch("TV", spend_total=0.0, nonzero_weeks=0)]))
        self.assertEqual({x["name"]: x["severity"] for x in v}.get("channel_all_zero:TV"), "error")

    def test_channel_absent_from_data_is_a_hard_error(self):
        v = G.check_manifest(manifest([ch("Meta"), ch("TikTok", in_data=False, spend_total=0.0)]))
        self.assertEqual({x["name"]: x["severity"] for x in v}.get("channel_missing:TikTok"), "error")

    def test_thin_channel_is_a_warning_not_a_stop(self):
        v = G.check_manifest(manifest([ch("Meta"), ch("TV", nonzero_weeks=2)]))
        self.assertEqual({x["name"]: x["severity"] for x in v}.get("channel_thin:TV"), "warn")

    def test_too_few_geos_is_error_too_few_weeks_is_warn(self):
        v = G.check_manifest(manifest([ch("Meta")], geos=0, weeks=10), {"min_geos": 1, "min_weeks": 52})
        names = {x["name"]: x["severity"] for x in v}
        self.assertEqual(names.get("too_few_geos"), "error")
        self.assertEqual(names.get("too_few_weeks"), "warn")

    def test_enforce_manifest_raises_on_hard_violation(self):
        with self.assertRaises(GuardrailError):
            G.enforce_manifest(manifest([ch("Meta"), ch("TV", spend_total=0.0, nonzero_weeks=0)]))

    def test_enforce_manifest_passes_clean(self):
        res = G.enforce_manifest(manifest([ch("Meta"), ch("TV")]),
                                 thresholds={"min_weeks": 1, "min_nonzero_weeks_per_channel": 1})
        self.assertTrue(res["passed"])
        self.assertEqual(res["manifest"]["channels_modelled"], 2)


try:
    import pandas  # noqa: F401
    _HAS_PANDAS = True
except Exception:  # pragma: no cover
    _HAS_PANDAS = False


@unittest.skipUnless(_HAS_PANDAS, "pandas not installed")
class TestBuildManifestPandas(unittest.TestCase):
    def _df(self):
        import pandas as pd
        return pd.DataFrame({
            "geo": ["n", "n", "s", "s"],
            "time": ["2026-01-05", "2026-01-12", "2026-01-05", "2026-01-12"],
            "Meta_spend": [100, 200, 0, 0],
            "TV_spend": [0, 0, 0, 0],          # dead channel — must be caught
        })

    def test_manifest_counts_and_catches_dead_channel(self):
        m = G.build_manifest(self._df(), ["Meta", "TV"], display=lambda c: c)
        self.assertEqual((m["geos"], m["weeks"], m["channels_modelled"]), (2, 2, 1))
        names = {x["name"] for x in G.check_manifest(m, {"min_weeks": 1, "min_nonzero_weeks_per_channel": 1})}
        self.assertIn("channel_all_zero:TV", names)

    def test_enforce_aborts_on_dead_channel(self):
        with self.assertRaises(GuardrailError):
            G.enforce(self._df(), ["Meta", "TV"], display=lambda c: c,
                      thresholds={"min_weeks": 1, "min_nonzero_weeks_per_channel": 1})


if __name__ == "__main__":
    unittest.main()
