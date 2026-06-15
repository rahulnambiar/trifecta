"""Unit tests for the UI-config → Meridian-spec translation layer.

Pure stdlib (``unittest``) so they run with zero extra dependencies and without
Meridian / TensorFlow installed:

    cd services/meridian-runner
    python3 -m unittest discover -s tests

This is one of the four high-stakes test areas in the Phase 1 brief (§9): a wrong
translation silently mis-specifies the model, so every mapping and guardrail is
pinned here.
"""
import math
import unittest

from meridian_runner import translation as T
from meridian_runner.translation import ConfigError


def base_config(**overrides):
    cfg = {
        "channels": [
            {"id": "meta", "name": "Meta", "roi_prior_mean": 1.4, "prior_strength": 0.7, "adstock_decay": 0.6},
            {"id": "yt", "name": "YouTube", "roi_prior_mean": 2.0, "prior_strength": 0.3, "adstock_decay": 0.4},
            {"id": "tv", "name": "TV", "include": False, "roi_prior_mean": 3.0, "prior_strength": 0.5, "adstock_decay": 0.8},
        ],
        "controls": [
            {"id": "sentiment", "include": True},
            {"id": "competitor", "include": False},
        ],
        "settings": {"holdout_weeks": 8, "max_lag": 8, "kpi_type": "non_revenue", "confidence_level": 0.9},
    }
    cfg.update(overrides)
    return cfg


class TestHelpers(unittest.TestCase):
    def test_strength_to_sigma_endpoints(self):
        self.assertAlmostEqual(T.strength_to_sigma(1.0), T.SIGMA_MIN)
        self.assertAlmostEqual(T.strength_to_sigma(0.0), T.SIGMA_MAX)

    def test_strength_to_sigma_monotonic_decreasing(self):
        vals = [T.strength_to_sigma(s / 10) for s in range(11)]
        self.assertEqual(vals, sorted(vals, reverse=True))

    def test_strength_to_sigma_rejects_out_of_range(self):
        for bad in (-0.1, 1.1, "x", None, True):
            with self.assertRaises(ConfigError):
                T.strength_to_sigma(bad)

    def test_roi_lognormal_median_equals_mean(self):
        mu, sigma = T.roi_lognormal_from_prior(1.4, 0.7)
        self.assertAlmostEqual(math.exp(mu), 1.4)          # median of LogNormal is exp(mu)
        self.assertAlmostEqual(sigma, T.strength_to_sigma(0.7))

    def test_roi_lognormal_rejects_nonpositive_mean(self):
        for bad in (0, -1, "1.4", float("nan")):
            with self.assertRaises(ConfigError):
                T.roi_lognormal_from_prior(bad, 0.5)

    def test_lognormal_from_mean_sd_moments(self):
        # Method-of-moments round-trip: implied mean of LogNormal == input mean.
        mean, sd = 1.1, 0.25
        mu, sigma = T.lognormal_from_mean_sd(mean, sd)
        implied_mean = math.exp(mu + 0.5 * sigma ** 2)
        implied_var = (math.exp(sigma ** 2) - 1) * math.exp(2 * mu + sigma ** 2)
        self.assertAlmostEqual(implied_mean, mean, places=6)
        self.assertAlmostEqual(math.sqrt(implied_var), sd, places=6)

    def test_lognormal_from_mean_sd_zero_sd_is_tight(self):
        mu, sigma = T.lognormal_from_mean_sd(1.1, 0.0)
        self.assertAlmostEqual(math.exp(mu), 1.1)
        self.assertLess(sigma, 1e-2)

    def test_lognormal_from_mean_sd_rejects_bad(self):
        with self.assertRaises(ConfigError):
            T.lognormal_from_mean_sd(0, 0.2)
        with self.assertRaises(ConfigError):
            T.lognormal_from_mean_sd(1.1, -0.1)


class TestTranslateHappyPath(unittest.TestCase):
    def setUp(self):
        self.p = T.translate(base_config())

    def test_excluded_channel_dropped(self):
        self.assertEqual(self.p.media_channels, ["Meta", "YouTube"])  # TV excluded

    def test_roi_priors_mapped(self):
        meta = self.p.channels[0]
        self.assertAlmostEqual(math.exp(meta.roi_mu), 1.4)
        self.assertAlmostEqual(meta.roi_sigma, T.strength_to_sigma(0.7))
        self.assertFalse(meta.calibrated)

    def test_adstock_and_hill_defaults(self):
        meta, yt = self.p.channels
        self.assertAlmostEqual(meta.adstock_retention_mean, 0.6)
        self.assertAlmostEqual(yt.adstock_retention_mean, 0.4)
        # saturation_hill omitted → default slope
        self.assertEqual(meta.hill_slope_mean, T.DEFAULT_HILL_SLOPE)

    def test_controls_filtered_to_included(self):
        self.assertEqual(self.p.control_cols, ["sentiment"])

    def test_settings_carried(self):
        self.assertEqual(self.p.holdout_weeks, 8)
        self.assertEqual(self.p.max_lag, 8)
        self.assertEqual(self.p.kpi_type, "non_revenue")
        self.assertAlmostEqual(self.p.confidence_level, 0.9)

    def test_sampler_defaults_filled(self):
        self.assertEqual(self.p.sampler, T.DEFAULT_SAMPLER)

    def test_convenience_views_aligned(self):
        self.assertEqual(len(self.p.roi_m_mu), 2)
        self.assertEqual(len(self.p.roi_m_sigma), 2)
        self.assertEqual(self.p.roi_m_mu[0], self.p.channels[0].roi_mu)


class TestCalibration(unittest.TestCase):
    def test_calibration_overrides_roi_prior(self):
        cfg = base_config(calibrations=[{"channel_id": "meta", "roi_mean": 1.1, "roi_sd": 0.2}])
        p = T.translate(cfg)
        meta = next(c for c in p.channels if c.id == "meta")
        self.assertTrue(meta.calibrated)
        exp_mu, exp_sigma = T.lognormal_from_mean_sd(1.1, 0.2)
        self.assertAlmostEqual(meta.roi_mu, exp_mu)
        self.assertAlmostEqual(meta.roi_sigma, exp_sigma)
        # the un-calibrated channel keeps its benchmark prior
        yt = next(c for c in p.channels if c.id == "yt")
        self.assertFalse(yt.calibrated)

    def test_calibration_for_unknown_channel_raises(self):
        cfg = base_config(calibrations=[{"channel_id": "ghost", "roi_mean": 1.0}])
        with self.assertRaises(ConfigError):
            T.translate(cfg)

    def test_calibration_for_excluded_channel_raises(self):
        cfg = base_config(calibrations=[{"channel_id": "tv", "roi_mean": 1.0}])  # tv is include=False
        with self.assertRaises(ConfigError):
            T.translate(cfg)

    def test_calibration_missing_roi_mean_raises(self):
        cfg = base_config(calibrations=[{"channel_id": "meta"}])
        with self.assertRaises(ConfigError):
            T.translate(cfg)


class TestValidation(unittest.TestCase):
    def test_non_dict_config(self):
        for bad in (None, [], "x", 3):
            with self.assertRaises(ConfigError):
                T.translate(bad)

    def test_empty_channels(self):
        with self.assertRaises(ConfigError):
            T.translate({"channels": []})

    def test_all_channels_excluded(self):
        cfg = {"channels": [{"id": "a", "include": False}, {"id": "b", "include": False}]}
        with self.assertRaises(ConfigError):
            T.translate(cfg)

    def test_duplicate_channel_id(self):
        cfg = {"channels": [{"id": "a", "roi_prior_mean": 1}, {"id": "a", "roi_prior_mean": 1}]}
        with self.assertRaises(ConfigError):
            T.translate(cfg)

    def test_missing_channel_id(self):
        with self.assertRaises(ConfigError):
            T.translate({"channels": [{"roi_prior_mean": 1.0}]})

    def test_adstock_out_of_range(self):
        cfg = base_config()
        cfg["channels"][0]["adstock_decay"] = 1.5
        with self.assertRaises(ConfigError):
            T.translate(cfg)

    def test_adstock_clamped_off_boundaries(self):
        cfg = base_config()
        cfg["channels"][0]["adstock_decay"] = 1.0   # valid input, but Beta mean can't be exactly 1
        cfg["channels"][1]["adstock_decay"] = 0.0
        p = T.translate(cfg)
        self.assertLess(p.channels[0].adstock_retention_mean, 1.0)
        self.assertGreater(p.channels[1].adstock_retention_mean, 0.0)

    def test_saturation_hill_must_be_positive(self):
        cfg = base_config()
        cfg["channels"][0]["saturation_hill"] = 0
        with self.assertRaises(ConfigError):
            T.translate(cfg)

    def test_bad_kpi_type(self):
        cfg = base_config()
        cfg["settings"]["kpi_type"] = "profit"
        with self.assertRaises(ConfigError):
            T.translate(cfg)

    def test_negative_holdout_and_maxlag(self):
        for key in ("holdout_weeks", "max_lag"):
            cfg = base_config()
            cfg["settings"][key] = -1
            with self.assertRaises(ConfigError):
                T.translate(cfg)

    def test_confidence_level_open_interval(self):
        for bad in (0, 1, 1.2, -0.1):
            cfg = base_config()
            cfg["settings"]["confidence_level"] = bad
            with self.assertRaises(ConfigError):
                T.translate(cfg)

    def test_sampler_unknown_key(self):
        cfg = base_config()
        cfg["settings"]["sampler"] = {"n_chains": 4, "bogus": 1}
        with self.assertRaises(ConfigError):
            T.translate(cfg)

    def test_sampler_negative_value(self):
        cfg = base_config()
        cfg["settings"]["sampler"] = {"n_adapt": -5}
        with self.assertRaises(ConfigError):
            T.translate(cfg)

    def test_sampler_chains_must_be_at_least_one(self):
        cfg = base_config()
        cfg["settings"]["sampler"] = {"n_chains": 0}
        with self.assertRaises(ConfigError):
            T.translate(cfg)

    def test_sampler_override_merges(self):
        cfg = base_config()
        cfg["settings"]["sampler"] = {"n_chains": 4, "seed": 42}
        p = T.translate(cfg)
        self.assertEqual(p.sampler["n_chains"], 4)
        self.assertEqual(p.sampler["seed"], 42)
        self.assertEqual(p.sampler["n_keep"], T.DEFAULT_SAMPLER["n_keep"])  # untouched default


if __name__ == "__main__":
    unittest.main()
