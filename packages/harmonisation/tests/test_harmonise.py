"""Tests for the raw→canonical-weekly harmonisation (Phase 1 · M3, brief §9 area #3).

Two layers, zero external deps:
  * pure render tests — the SQL is built correctly per dialect;
  * an execution test — we RUN the rendered SQLite transform on fixture raw tables and
    assert the canonical weekly output is correct (weekly buckets, channel pivot,
    zero-fill, kpi/population/controls), then run the validation checks.

    cd packages/harmonisation && python3 -m unittest discover -s tests
"""
import os
import sqlite3
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import harmonise as H
from harmonise import MappingError


def base_mapping(**ov):
    m = {
        "media": {"table": "raw_spend", "date": "day", "geo": "region",
                  "channel": "channel_name", "spend": "cost", "impressions": "impr"},
        "kpi": {"table": "raw_sales", "date": "day", "geo": "region",
                "kpi": "orders", "population": "pop"},
        "controls": {"table": "raw_ctrl", "date": "day", "geo": "region",
                     "columns": {"sentiment": "sent_idx", "competitor": "comp_sales"}},
        "channels": ["Meta", "Paid Search", "TV"],
        "week_start": "monday",
    }
    m.update(ov)
    return m


class TestPureRender(unittest.TestCase):
    def test_slug(self):
        self.assertEqual(H.slug("Paid Search"), "paid_search")
        self.assertEqual(H.slug("TikTok"), "tiktok")
        self.assertEqual(H.slug("  TV / OOH "), "tv_ooh")
        self.assertEqual(H.slug("3Q"), "c_3q")
        with self.assertRaises(MappingError):
            H.slug("***")

    def test_canonical_columns(self):
        cols = H.canonical_columns(base_mapping())
        self.assertEqual(cols[:4], ["geo", "time", "kpi", "population"])
        for c in ["sentiment", "competitor", "meta_spend", "meta_impression",
                  "paid_search_spend", "tv_spend"]:
            self.assertIn(c, cols)
        self.assertNotIn("revenue_per_kpi", cols)  # not mapped

    def test_bigquery_dialect_bits(self):
        sql = H.render_harmonisation_sql(base_mapping(), "bigquery")
        self.assertIn("DATE_TRUNC(CAST(day AS DATE), WEEK(MONDAY))", sql)
        self.assertIn("`meta_spend`", sql)           # backtick identifiers
        self.assertIn("CASE WHEN channel_name = 'Paid Search'", sql)

    def test_sqlite_dialect_bits(self):
        sql = H.render_harmonisation_sql(base_mapping(), "sqlite")
        self.assertIn("strftime('%w', day)", sql)
        self.assertIn('"meta_spend"', sql)            # double-quote identifiers

    def test_create_table_wrap(self):
        sql = H.render_harmonisation_sql(base_mapping(), "bigquery", create_table="ds.canon")
        self.assertTrue(sql.startswith("CREATE OR REPLACE TABLE ds.canon AS"))

    def test_validation_checks_cover_channels(self):
        checks = H.render_validation_checks(base_mapping(), "sqlite")
        names = {c["name"] for c in checks}
        self.assertIn("no_null_keys", names)
        self.assertIn("no_duplicate_geo_week", names)
        self.assertIn("population_positive", names)
        self.assertIn("no_negative_tv_spend", names)

    def test_render_rejects_bad_input(self):
        with self.assertRaises(MappingError):
            H.render_harmonisation_sql(base_mapping(), "oracle")
        with self.assertRaises(MappingError):
            H.render_harmonisation_sql({**base_mapping(), "channels": []}, "sqlite")
        with self.assertRaises(MappingError):
            H.render_harmonisation_sql({**base_mapping(), "kpi": {"table": "x"}}, "sqlite")


class TestExecuteOnSqlite(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        c = self.db.cursor()
        c.executescript("""
          CREATE TABLE raw_spend(day TEXT, region TEXT, channel_name TEXT, cost REAL, impr REAL);
          CREATE TABLE raw_sales(day TEXT, region TEXT, orders REAL, pop REAL);
          CREATE TABLE raw_ctrl(day TEXT, region TEXT, sent_idx REAL, comp_sales REAL);
        """)
        # Week of Mon 2026-01-05 and Mon 2026-01-12.
        c.executemany("INSERT INTO raw_spend VALUES (?,?,?,?,?)", [
            ("2026-01-05", "north", "Meta", 100, 1000),
            ("2026-01-06", "north", "Meta", 50, 500),       # north/wk1 Meta = 150
            ("2026-01-07", "north", "Paid Search", 80, 0),  # north/wk1 paid_search = 80
            ("2026-01-12", "north", "Meta", 200, 100),      # north/wk2 Meta = 200
            ("2026-01-05", "south", "TV", 300, 0),          # south/wk1 TV = 300
        ])
        c.executemany("INSERT INTO raw_sales VALUES (?,?,?,?)", [
            ("2026-01-05", "north", 10, 1000),
            ("2026-01-06", "north", 12, 1000),              # north/wk1 kpi = 22
            ("2026-01-12", "north", 5, 1000),               # north/wk2 kpi = 5
            ("2026-01-05", "south", 7, 500),                # south/wk1 kpi = 7
        ])
        c.executemany("INSERT INTO raw_ctrl VALUES (?,?,?,?)", [
            ("2026-01-05", "north", 0.5, 100),
            ("2026-01-06", "north", 0.7, 100),              # north/wk1 sent avg = 0.6
            ("2026-01-05", "south", 0.4, 50),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _rows(self):
        sql = H.render_harmonisation_sql(base_mapping(), "sqlite")
        cur = self.db.execute(sql)
        cols = [d[0] for d in cur.description]
        return {(r[0], r[1]): dict(zip(cols, r)) for r in cur.fetchall()}

    def test_weekly_buckets_and_spine(self):
        rows = self._rows()
        self.assertEqual(set(rows), {("north", "2026-01-05"), ("north", "2026-01-12"), ("south", "2026-01-05")})

    def test_kpi_population_controls(self):
        r = self._rows()[("north", "2026-01-05")]
        self.assertEqual(r["kpi"], 22)
        self.assertEqual(r["population"], 1000)
        self.assertAlmostEqual(r["sentiment"], 0.6)
        self.assertEqual(r["competitor"], 100)

    def test_channel_pivot_and_zero_fill(self):
        r = self._rows()
        n1 = r[("north", "2026-01-05")]
        self.assertEqual(n1["meta_spend"], 150)
        self.assertEqual(n1["meta_impression"], 1500)
        self.assertEqual(n1["paid_search_spend"], 80)
        self.assertEqual(n1["tv_spend"], 0)            # north never spent on TV → zero-filled
        s1 = r[("south", "2026-01-05")]
        self.assertEqual(s1["tv_spend"], 300)
        self.assertEqual(s1["meta_spend"], 0)
        self.assertEqual(s1["paid_search_spend"], 0)

    def test_week2_isolated(self):
        n2 = self._rows()[("north", "2026-01-12")]
        self.assertEqual(n2["kpi"], 5)
        self.assertEqual(n2["meta_spend"], 200)
        self.assertEqual(n2["paid_search_spend"], 0)
        self.assertIsNone(n2["sentiment"])             # no control rows that week

    def test_validation_passes_on_clean_output(self):
        self.db.execute(H.render_harmonisation_sql(base_mapping(), "sqlite", create_table="canonical_weekly"))
        for chk in H.render_validation_checks(base_mapping(), "sqlite"):
            (n,) = self.db.execute(chk["sql"]).fetchone()
            self.assertEqual(n, 0, f"clean data should pass {chk['name']}, got {n} violation(s)")

    def test_validation_catches_violations(self):
        self.db.execute(H.render_harmonisation_sql(base_mapping(), "sqlite", create_table="canonical_weekly"))
        checks = {c["name"]: c["sql"] for c in H.render_validation_checks(base_mapping(), "sqlite")}
        # inject a bad row: negative TV spend + null kpi
        self.db.execute('INSERT INTO canonical_weekly (geo, time, kpi, "tv_spend") VALUES (?,?,?,?)',
                        ("north", "2026-01-19", None, -5))
        self.db.commit()
        self.assertGreater(self.db.execute(checks["no_negative_tv_spend"]).fetchone()[0], 0)
        self.assertGreater(self.db.execute(checks["no_null_keys"]).fetchone()[0], 0)


class TestGuardrailsAndManifest(unittest.TestCase):
    """The no-silent-drop guardrails (brief §9): a dropped channel, an unmapped
    campaign, or thin coverage must each make a check FAIL — executed on sqlite."""

    # generous thresholds so the tiny fixture itself isn't flagged; we override
    # per-test to assert the coverage gates fire.
    LOOSE = {"min_geos": 1, "min_weeks": 1, "min_nonzero_weeks_per_channel": 1}

    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        c = self.db.cursor()
        c.executescript("""
          CREATE TABLE raw_spend(day TEXT, region TEXT, channel_name TEXT, cost REAL);
          CREATE TABLE raw_sales(day TEXT, region TEXT, orders REAL, pop REAL);
        """)
        c.executemany("INSERT INTO raw_spend VALUES (?,?,?,?)", [
            ("2026-01-05", "north", "Meta", 100),
            ("2026-01-12", "north", "Meta", 200),          # Meta total = 300
            ("2026-01-05", "north", "Paid Search", 80),    # Paid Search total = 80
            ("2026-01-12", "south", "TV", 300),            # TV total = 300
            ("2026-01-05", "south", "Affiliates", 500),    # UNMAPPED — must be caught
        ])
        c.executemany("INSERT INTO raw_sales VALUES (?,?,?,?)", [
            ("2026-01-05", "north", 10, 1000), ("2026-01-12", "north", 5, 1000),
            ("2026-01-05", "south", 7, 500),   ("2026-01-12", "south", 3, 500),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _mapping(self, **ov):
        m = {
            "media": {"table": "raw_spend", "date": "day", "geo": "region",
                      "channel": "channel_name", "spend": "cost"},
            "kpi": {"table": "raw_sales", "date": "day", "geo": "region",
                    "kpi": "orders", "population": "pop"},
            "channels": ["Meta", "Paid Search", "TV"],
        }
        m.update(ov)
        return m

    def _build(self, mapping):
        self.db.execute(H.render_harmonisation_sql(mapping, "sqlite", create_table="canonical_weekly"))
        self.db.commit()

    def _violations(self, mapping, thresholds):
        return {c["name"]: (self.db.execute(c["sql"]).fetchone()[0], c["severity"])
                for c in H.render_guardrail_checks(mapping, "sqlite", thresholds=thresholds)}

    def test_unmapped_campaign_is_caught(self):
        # Affiliates spend ($500) is not mapped to any modelled channel → reconciliation fails.
        m = self._mapping()
        self._build(m)
        v = self._violations(m, self.LOOSE)
        self.assertGreater(v["spend_reconciled"][0], 0, "unmapped Affiliates spend must fail reconciliation")

    def test_acknowledged_unmapped_passes(self):
        # explicitly out-of-scope → reconciliation passes (deliberate, not silent).
        m = self._mapping(allow_unmapped_channels=["Affiliates"])
        self._build(m)
        v = self._violations(m, self.LOOSE)
        self.assertEqual(v["spend_reconciled"][0], 0, "acknowledged exclusion should reconcile")

    def test_all_zero_channel_is_caught(self):
        # a channel in the config with no spend anywhere (a mapping miss) → hard fail.
        m = self._mapping(channels=["Meta", "Paid Search", "TV", "TikTok"],
                          allow_unmapped_channels=["Affiliates"])
        self._build(m)
        v = self._violations(m, self.LOOSE)
        self.assertGreater(v["channel_not_all_zero_tiktok"][0], 0)
        self.assertEqual(v["channel_not_all_zero_tiktok"][1], "error")
        self.assertEqual(v["channel_not_all_zero_meta"][0], 0)        # real channel is fine

    def test_thin_coverage_is_caught(self):
        m = self._mapping(allow_unmapped_channels=["Affiliates"])
        self._build(m)
        v = self._violations(m, {"min_geos": 5, "min_weeks": 52, "min_nonzero_weeks_per_channel": 10})
        self.assertGreater(v["enough_geos"][0], 0)     # only 2 geos
        self.assertGreater(v["enough_weeks"][0], 0)    # only 2 weeks
        self.assertGreater(v["channel_enough_signal_tv"][0], 0)  # TV has 1 nonzero week

    def test_clean_mapping_passes_all_gates(self):
        m = self._mapping(allow_unmapped_channels=["Affiliates"])
        self._build(m)
        for name, (n, sev) in self._violations(m, self.LOOSE).items():
            self.assertEqual(n, 0, f"clean mapping should pass {name}, got {n}")

    def test_manifest_shows_in_vs_modelled(self):
        m = self._mapping(allow_unmapped_channels=["Affiliates"])
        self._build(m)
        mq = H.coverage_manifest_queries(m, "sqlite")
        scalar = lambda sql: self.db.execute(sql).fetchone()[0]
        self.assertEqual(scalar(mq["scalars"]["rows"]), 4)        # 2 geos x 2 weeks
        self.assertEqual(scalar(mq["scalars"]["geos"]), 2)
        self.assertEqual(scalar(mq["scalars"]["weeks"]), 2)
        self.assertEqual(scalar(mq["scalars"]["raw_spend_total"]), 1180)     # 680 mapped + 500 Affiliates
        self.assertEqual(scalar(mq["scalars"]["mapped_spend_total"]), 680)   # Meta 300 + PaidSearch 80 + TV 300
        self.assertEqual(scalar(mq["per_channel"]["Meta"]["spend_total"]), 300)
        self.assertEqual(scalar(mq["per_channel"]["TV"]["nonzero_weeks"]), 1)
        raw = dict(self.db.execute(mq["raw_per_channel_sql"]).fetchall())
        self.assertEqual(raw["Affiliates"], 500)   # the dropped spend is visible in the manifest


if __name__ == "__main__":
    unittest.main()
