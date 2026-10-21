"""Build the four Project 2 checkpoint figures (PDF + PNG) from the World Bank health data."""
from pathlib import Path

import clean as c
from plot_con import build_plateau, build_top_spenders
from plot_pro import build_doubling, build_ladder

OUT_DIR = Path(__file__).resolve().parent.parent / "output"
PNG_DPI = 220
EXPLORER_COLUMNS = ["country", "code", "region", "spend", "life"]   # data for the web explorer


def build_all():
    """Return {file stem: Figure} for every chart, printing the numbers behind them."""
    snap = c.snapshot(c.tidy(c.load_raw(), c.load_countries()))
    fit = c.fit_per_doubling(snap)
    binned = c.add_spend_quintile(snap)
    quintiles = c.summarize_quintiles(binned)
    top = c.top_spenders(snap)
    low, high = c.segment_fits(snap)
    profile = c.breakpoint_profile(snap)

    print(f"{len(snap)} countries in {c.YEAR}")
    print("log fit:", {k: round(v, 3) for k, v in fit.items()})
    print(quintiles.round(1).to_string(index=False))
    print(top[["country", "spend", "life"]].round(1).to_string(index=False))
    print("below/above breakpoint:", low, high, sep="\n")
    print("outlive the US:", c.outlived_by(snap, "USA"))
    print("above the breakpoint:", profile)

    return {"for_a_doubling": build_doubling(snap, fit),
            "for_b_ladder": build_ladder(binned, quintiles),
            "against_c_top_spenders": build_top_spenders(top),
            "against_d_plateau": build_plateau(snap, low, high, profile)}


def export_countries(path):
    """Write the 2018 snapshot the figures are drawn from, for the report's interactive chart."""
    snap = c.snapshot(c.tidy(c.load_raw(), c.load_countries()))
    snap[EXPLORER_COLUMNS].round({"spend": 2, "life": 2}).to_csv(path, index=False)


def main():
    OUT_DIR.mkdir(exist_ok=True)
    export_countries(OUT_DIR / f"countries_{c.YEAR}.csv")
    for stem, fig in build_all().items():
        fig.savefig(OUT_DIR / f"{stem}.pdf")
        fig.savefig(OUT_DIR / f"{stem}.png", dpi=PNG_DPI)
    print(f"Saved figures to {OUT_DIR}")


if __name__ == "__main__":
    main()
