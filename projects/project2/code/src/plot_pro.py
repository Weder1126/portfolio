"""Figures arguing FOR the proposition: more health spending, longer lives."""
import numpy as np
from matplotlib.ticker import FixedLocator, NullLocator

import clean as c
import style as s

SPEND_TICKS = [25, 100, 400, 1600, 6400]
SPEND_LIMITS = (15, 15000)
LABELLED = {            # code: (label, x offset, y offset, horizontal alignment) in points
    "COD": ("DR Congo", 8, -11, "left"),
    "IND": ("India", 8, -10, "left"),
    "BRA": ("Brazil", 8, -11, "left"),
    "JPN": ("Japan", -8, 6, "right"),
}
GROUP_NAMES = ["Lowest\nfifth", "2nd", "3rd", "4th", "Highest\nfifth"]
JITTER_WIDTH, JITTER_SEED = 0.2, 106


def _label_countries(ax, snap):
    for code, (name, dx, dy, ha) in LABELLED.items():
        row = snap.loc[snap["code"] == code].iloc[0]
        s.focus_dots(ax, row["spend"], row["life"], s.FOR_COLOR)
        ax.annotate(name, (row["spend"], row["life"]), xytext=(dx, dy),
                    textcoords="offset points", ha=ha, fontsize=s.SMALL_SIZE, color=s.INK,
                    path_effects=s.halo(), zorder=6)


def build_doubling(snap, fit):
    """Scatter on a log2 spending axis with the fitted trend line."""
    fig = s.new_figure("Every doubling of health spending adds nearly 3 years of life",
                       f"{fit['n']} countries, 2018")
    ax = fig.add_axes([s.LEFT, s.BOTTOM, s.RIGHT - s.LEFT, s.TOP - s.BOTTOM])
    s.life_axis(ax)
    ax.set_xscale("log", base=2)
    ax.set_xlim(*SPEND_LIMITS)
    ax.xaxis.set_major_locator(FixedLocator(SPEND_TICKS))
    ax.xaxis.set_minor_locator(NullLocator())
    ax.set_xticklabels([s.usd(t) for t in SPEND_TICKS])
    ax.set_xlabel("Health spending per person (log scale)")

    s.context_dots(ax, snap["spend"], snap["life"])
    ends = np.array([snap["spend"].min(), snap["spend"].max()])
    ax.plot(ends, c.predict_life(fit, ends), color=s.FOR_COLOR, lw=s.LINE_WIDTH, zorder=3,
            solid_capstyle="round")
    _label_countries(ax, snap)
    ax.text(0.985, 0.08, f"+{fit['years_per_doubling']:.1f} years per doubling",
            transform=ax.transAxes, ha="right", va="bottom", fontsize=s.TEXT_SIZE + 1,
            color=s.INK, fontweight="bold")
    return fig


def _draw_ladder(ax, binned, summary):
    rng = np.random.default_rng(JITTER_SEED)
    jitter = rng.uniform(-JITTER_WIDTH, JITTER_WIDTH, len(binned))
    s.context_dots(ax, binned["quintile"] + jitter, binned["life"])
    ax.plot(summary["quintile"], summary["median_life"], color=s.FOR_COLOR,
            lw=s.LINE_WIDTH, zorder=3)
    s.focus_dots(ax, summary["quintile"], summary["median_life"], s.FOR_COLOR)


def _label_ends(ax, summary):
    """Label only the lowest and highest group; the axis carries the rest."""
    low, high = summary.iloc[0], summary.iloc[-1]
    gain = high["median_life"] - low["median_life"]
    labels = [(low, f"{low['median_life']:.1f}"),
              (high, f"{high['median_life']:.1f}  (+{gain:.0f} years)")]
    for row, text in labels:
        ax.annotate(text, (row["quintile"], row["median_life"]), xytext=(-9, 9),
                    textcoords="offset points", ha="right", fontsize=s.TEXT_SIZE + 1,
                    fontweight="bold", color=s.INK, path_effects=s.halo(), zorder=6)


def build_ladder(binned, summary):
    """Median life expectancy for five equal-count spending groups."""
    fig = s.new_figure("At every step up in health spending, people live longer",
                       f"{len(binned)} countries in five equal groups, by health spending "
                       "per person, 2018")
    ax = fig.add_axes([s.LEFT, s.BOTTOM, s.RIGHT - s.LEFT, s.TOP - s.BOTTOM])
    s.life_axis(ax)
    _draw_ladder(ax, binned, summary)
    _label_ends(ax, summary)
    ax.set_xlim(summary["quintile"].min() - 0.55, summary["quintile"].max() + 0.55)
    ax.set_xticks(summary["quintile"])
    ax.set_xticklabels(GROUP_NAMES, color=s.SECONDARY, linespacing=1.25)
    return fig
