"""Load and transform the World Bank health indicators for the Project 2 figures."""
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_PATH = DATA_DIR / "health-raw-2021.csv"
COUNTRY_PATH = DATA_DIR / "country_metadata.csv"
RAW_HEADER_ROWS = 4            # World Bank exports start with a 4-line preamble
LIFE_CODE = "SP.DYN.LE00.IN"   # life expectancy at birth, total (years)
SPEND_CODE = "SH.XPD.CHEX.PC.CD"  # current health expenditure per capita (current US$)
MEASURES = {LIFE_CODE: "life", SPEND_CODE: "spend"}
ID_COLUMNS = ["Country Name", "Country Code", "Indicator Code"]
YEAR = 2018                    # latest year with health-expenditure data
N_QUINTILES = 5
TOP_N = 15
PLATEAU_USD = 2000             # where the "against" chart splits its two trend lines
LONG_LIFE = 80                 # life expectancy the chart calls "already long"
HIGH_INCOME = "High income"    # World Bank income-group label


def load_raw(path=RAW_PATH):
    """Read the wide World Bank CSV and fail fast if its layout changed."""
    df = pd.read_csv(path, skiprows=RAW_HEADER_ROWS)
    missing = [col for col in ID_COLUMNS if col not in df.columns]
    if missing:
        raise ValueError(f"{Path(path).name} is missing columns: {missing}")
    return df


def load_countries(path=COUNTRY_PATH):
    """Read the country metadata (aggregates such as 'World' have no Region)."""
    df = pd.read_csv(path)
    missing = [col for col in ("Country Code", "Region", "IncomeGroup") if col not in df.columns]
    if missing:
        raise ValueError(f"{Path(path).name} is missing columns: {missing}")
    return df


def tidy(raw, countries):
    """Return one row per country and year with life expectancy and health spending.

    Pivots the year columns to long form, keeps the two indicators we plot, and
    drops (1) regional/income aggregates and (2) country-years missing either value.
    """
    absent = [code for code in MEASURES if code not in set(raw["Indicator Code"])]
    if absent:
        raise ValueError(f"indicators not found in raw data: {absent}")
    year_columns = [col for col in raw.columns if col.isdigit()]
    real = countries.loc[countries["Region"].notna(), ["Country Code", "Region", "IncomeGroup"]]
    return (raw.loc[raw["Indicator Code"].isin(MEASURES)]
               .melt(id_vars=ID_COLUMNS, value_vars=year_columns, var_name="year")
               .assign(measure=lambda d: d["Indicator Code"].map(MEASURES),
                       year=lambda d: d["year"].astype(int))
               .pivot(index=["Country Name", "Country Code", "year"],
                      columns="measure", values="value")
               .dropna(subset=list(MEASURES.values()))
               .reset_index()
               .merge(real, on="Country Code", how="inner")
               .rename(columns={"Country Name": "country", "Country Code": "code",
                                "Region": "region", "IncomeGroup": "income"})
               .rename_axis(columns=None))


def snapshot(tidy_df, year=YEAR):
    """Countries with both measures in `year`, sorted by spending."""
    out = tidy_df.loc[tidy_df["year"] == year].sort_values("spend").reset_index(drop=True)
    if out.empty:
        raise ValueError(f"no countries have both measures in {year}")
    return out


def add_spend_quintile(snap, n=N_QUINTILES):
    """Return a copy with an equal-count spending group (1 = lowest spenders)."""
    return snap.assign(quintile=pd.qcut(snap["spend"], n, labels=False) + 1)


def summarize_quintiles(binned):
    """Median life expectancy, size and dollar range of every spending group."""
    return (binned.groupby("quintile")
                  .agg(median_life=("life", "median"), n=("life", "size"),
                       spend_min=("spend", "min"), spend_max=("spend", "max"))
                  .reset_index())


def top_spenders(snap, n=TOP_N):
    """The `n` countries with the highest spending per person, highest first."""
    return snap.nlargest(n, "spend").reset_index(drop=True)


def fit_per_doubling(snap):
    """Least-squares fit of life expectancy on log2(spending)."""
    log_spend = np.log2(snap["spend"])
    slope, intercept = np.polyfit(log_spend, snap["life"], 1)
    return {"years_per_doubling": float(slope), "intercept": float(intercept),
            "r": float(np.corrcoef(log_spend, snap["life"])[0, 1]), "n": len(snap)}


def predict_life(fit, spend):
    """Life expectancy the log fit expects at a spending level (scalar or array)."""
    return fit["intercept"] + fit["years_per_doubling"] * np.log2(spend)


def _linear_fit(part):
    slope, intercept = np.polyfit(part["spend"], part["life"], 1)
    return {"years_per_1000": float(slope) * 1000, "intercept": float(intercept),
            "n": len(part), "spend_min": float(part["spend"].min()),
            "spend_max": float(part["spend"].max())}


def segment_fits(snap, breakpoint=PLATEAU_USD):
    """Separate straight-line fits below and above a spending breakpoint."""
    low = snap.loc[snap["spend"] < breakpoint]
    high = snap.loc[snap["spend"] >= breakpoint]
    if len(low) < 2 or len(high) < 2:
        raise ValueError(f"need at least 2 countries on each side of ${breakpoint:,}")
    return _linear_fit(low), _linear_fit(high)


def breakpoint_profile(snap, breakpoint=PLATEAU_USD, life_floor=LONG_LIFE):
    """Who sits above the breakpoint: how many, how many are high-income, how many live past the floor."""
    above = snap.loc[snap["spend"] >= breakpoint]
    return {"above": len(above),
            "high_income": int((above["income"] == HIGH_INCOME).sum()),
            "past_floor": int((above["life"] >= life_floor).sum()),
            "below": int((snap["spend"] < breakpoint).sum())}


def outlived_by(snap, code, max_spend_share=0.5):
    """Count countries that outlive `code`, and how many do so on a fraction of its budget."""
    matches = snap.loc[snap["code"] == code]
    if matches.empty:
        raise ValueError(f"country code {code!r} not in snapshot")
    target = matches.iloc[0]
    longer = snap.loc[snap["life"] > target["life"]]
    cheaper = longer.loc[longer["spend"] < target["spend"] * max_spend_share]
    return {"longer_lived": len(longer), "at_under_share": len(cheaper)}
