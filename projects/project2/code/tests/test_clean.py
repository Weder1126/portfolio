import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import clean as c  # noqa: E402


def _raw():
    """Wide World Bank layout: one row per country x indicator, one column per year."""
    rows = [("Aland", "AAA", c.LIFE_CODE, 60.0, 62.0),
            ("Aland", "AAA", c.SPEND_CODE, 100.0, 200.0),
            ("Borduria", "BBB", c.LIFE_CODE, 80.0, 81.0),
            ("Borduria", "BBB", c.SPEND_CODE, 4000.0, None),
            ("World", "WLD", c.LIFE_CODE, 70.0, 71.0),
            ("World", "WLD", c.SPEND_CODE, 900.0, 1000.0),
            ("Aland", "AAA", "SP.POP.TOTL", 1e6, 1e6)]
    return pd.DataFrame(rows, columns=["Country Name", "Country Code",
                                       "Indicator Code", "2017", "2018"])


def _countries():
    return pd.DataFrame({"Country Code": ["AAA", "BBB", "WLD"],
                         "Region": ["North", "South", None],
                         "IncomeGroup": ["Low income", "High income", None]})


def _snapshot(spend, life):
    return pd.DataFrame({"country": [f"c{i}" for i in range(len(spend))],
                         "code": [f"C{i:02d}" for i in range(len(spend))],
                         "year": 2018, "spend": spend, "life": life})


class TidyTests(unittest.TestCase):
    def test_one_row_per_country_year_with_both_measures(self):
        out = c.tidy(_raw(), _countries())
        self.assertListEqual(sorted(out.columns),
                             ["code", "country", "income", "life", "region", "spend", "year"])
        row = out[(out["code"] == "AAA") & (out["year"] == 2018)].iloc[0]
        self.assertEqual((row["life"], row["spend"]), (62.0, 200.0))

    def test_drops_aggregates_and_incomplete_rows(self):
        out = c.tidy(_raw(), _countries())
        self.assertNotIn("WLD", out["code"].tolist())      # region aggregate, not a country
        self.assertEqual(len(out[out["code"] == "BBB"]), 1)  # 2018 spending is missing

    def test_does_not_mutate_input(self):
        raw, before = _raw(), _raw()
        c.tidy(raw, _countries())
        pd.testing.assert_frame_equal(raw, before)

    def test_missing_indicator_fails_fast(self):
        raw = _raw()
        with self.assertRaises(ValueError):
            c.tidy(raw[raw["Indicator Code"] != c.LIFE_CODE], _countries())

    def test_snapshot_filters_year_and_rejects_empty(self):
        tidy = c.tidy(_raw(), _countries())
        self.assertListEqual(c.snapshot(tidy, 2018)["code"].tolist(), ["AAA"])
        with self.assertRaises(ValueError):
            c.snapshot(tidy, 1999)


class TransformTests(unittest.TestCase):
    def test_quintiles_are_equal_count_and_ordered(self):
        snap = _snapshot(spend=[10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],
                         life=np.arange(60, 70))
        out = c.add_spend_quintile(snap)
        self.assertListEqual(out["quintile"].tolist(), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        self.assertNotIn("quintile", snap.columns)

    def test_quintile_summary_reports_median_and_range(self):
        snap = _snapshot(spend=[10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],
                         life=np.arange(60, 70))
        summary = c.summarize_quintiles(c.add_spend_quintile(snap))
        top = summary[summary["quintile"] == 5].iloc[0]
        self.assertEqual((top["median_life"], top["n"]), (68.5, 2))
        self.assertEqual((top["spend_min"], top["spend_max"]), (2560, 5120))

    def test_top_spenders_sorted_high_to_low(self):
        snap = _snapshot(spend=[5, 50, 500, 5000], life=[60, 70, 80, 79])
        out = c.top_spenders(snap, 2)
        self.assertListEqual(out["spend"].tolist(), [5000, 500])

    def test_log_fit_recovers_years_per_doubling(self):
        spend = np.array([50, 100, 200, 400, 800])
        snap = _snapshot(spend=spend, life=50 + 3 * np.log2(spend))
        fit = c.fit_per_doubling(snap)
        self.assertAlmostEqual(fit["years_per_doubling"], 3.0)
        self.assertAlmostEqual(fit["r"], 1.0)
        self.assertAlmostEqual(c.predict_life(fit, 1600), 50 + 3 * np.log2(1600))

    def test_segment_slopes_split_at_breakpoint(self):
        spend = np.array([100, 500, 1000, 3000, 6000, 9000])
        life = np.array([60, 64, 69, 82, 82, 82])
        low, high = c.segment_fits(_snapshot(spend, life), breakpoint=2000)
        self.assertEqual((low["n"], high["n"]), (3, 3))
        self.assertAlmostEqual(low["years_per_1000"], 10.0, places=0)
        self.assertAlmostEqual(high["years_per_1000"], 0.0)

    def test_segment_fit_needs_points_on_both_sides(self):
        with self.assertRaises(ValueError):
            c.segment_fits(_snapshot([10, 20, 30], [60, 61, 62]), breakpoint=2000)

    def test_breakpoint_profile_describes_countries_above_the_cut(self):
        snap = _snapshot(spend=[500, 1500, 2500, 4000, 9000], life=[70, 79, 81, 79.5, 82])
        snap = snap.assign(income=["Low income", "High income", "High income",
                                   "High income", "Upper middle income"])
        out = c.breakpoint_profile(snap, breakpoint=2000, life_floor=80)
        self.assertEqual(out, {"above": 3, "high_income": 2, "past_floor": 2, "below": 2})

    def test_longer_lived_for_less_counts_cheaper_and_healthier(self):
        snap = _snapshot(spend=[900, 4000, 6000, 10000], life=[80, 82, 77, 78])
        out = c.outlived_by(snap, "C03", max_spend_share=0.5)
        self.assertEqual(out, {"longer_lived": 2, "at_under_share": 2})


if __name__ == "__main__":
    unittest.main()
