"""Figures arguing AGAINST the proposition: more health spending, no longer lives."""
import numpy as np

import clean as c
import style as s

FOCUS_CODE = "USA"
RANK_LIFE_LIMITS = (78, 85)     # life-expectancy window of the ranking chart
RANK_LIFE_TICKS = [78, 80, 82, 84]
RANK_SPEND_TICKS = [0, 5000, 10000]
PANEL_BOTTOM, PANEL_TOP = 0.15, 0.74
BARS_BOX = [0.175, PANEL_BOTTOM, 0.36, PANEL_TOP - PANEL_BOTTOM]
DOTS_BOX = [0.62, PANEL_BOTTOM, 0.33, PANEL_TOP - PANEL_BOTTOM]
BAR_THICKNESS = 0.5
SPEND_AXIS_MAX = 11200
CONTRAST = {            # code: (x offset, y offset, horizontal alignment) in points
    "USA": (-8, -14, "right"),
    "CRI": (60, -10, "left"),
}
DAYS_PER_YEAR = 365.25
KEY_X, KEY_LINE, KEY_ROWS_Y = 0.30, 0.04, (0.27, 0.15)   # trend-line key, axes coords
KEY_NOTE_Y = 0.36                                         # "why this breakpoint" note above the key


def _colors(codes):
    return [s.AGAINST_COLOR if code == FOCUS_CODE else s.CONTEXT for code in codes]


def _rank_axis(ax, n, header, ticks, tick_labels):
    ax.set_ylim(n - 0.4, -0.6)                       # biggest spender on top
    ax.set_title(header, loc="left", fontsize=s.TEXT_SIZE, color=s.SECONDARY, pad=8)
    ax.set_xticks(ticks)
    ax.set_xticklabels(tick_labels)
    s.strip_spines(ax, keep=())


def _draw_spend_bars(ax, top):
    rows = np.arange(len(top))
    focus_row = top["code"].tolist().index(FOCUS_CODE)
    ax.barh(rows, top["spend"], height=BAR_THICKNESS, color=_colors(top["code"]), zorder=2)
    ax.set_xlim(0, SPEND_AXIS_MAX * 1.12)
    ax.grid(axis="x", color=s.GRID, lw=s.HAIRLINE, zorder=0)
    ax.set_yticks(rows)
    ax.set_yticklabels(top["country"], color=s.SECONDARY, fontsize=s.SMALL_SIZE)
    focus_label = ax.get_yticklabels()[focus_row]
    focus_label.set_fontweight("bold")
    focus_label.set_color(s.INK)
    ax.text(top["spend"].iloc[focus_row] + 220, focus_row, s.usd(top["spend"].iloc[focus_row]),
            va="center", fontsize=s.SMALL_SIZE, color=s.INK, fontweight="bold")


def _draw_life_dots(ax, top):
    rows = np.arange(len(top))
    focus_row = top["code"].tolist().index(FOCUS_CODE)
    others = top.loc[top["code"] != FOCUS_CODE, "life"]
    gap = round(others.median(), 1) - round(top["life"].iloc[focus_row], 1)
    ax.hlines(rows, *RANK_LIFE_LIMITS, color=s.GRID, lw=s.HAIRLINE, zorder=1)
    ax.vlines(others.median(), 0.5, len(top) - 0.4, color=s.MUTED, lw=s.HAIRLINE + 0.3,
              zorder=1)                      # starts below the focus row's label
    ax.scatter(top["life"], rows, s=s.FOCUS_SIZE, color=_colors(top["code"]), zorder=3,
               edgecolor="white", lw=s.FOCUS_RING)
    ax.set_xlim(*RANK_LIFE_LIMITS)
    ax.set_yticks([])
    ax.annotate(f"{top['life'].iloc[focus_row]:.1f}", (top["life"].iloc[focus_row], focus_row),
                xytext=(9, 0), textcoords="offset points", va="center",
                fontsize=s.SMALL_SIZE, color=s.INK, fontweight="bold",
                bbox={"facecolor": "white", "edgecolor": "none", "pad": 1.5})
    ax.annotate(f"{gap:.1f} below median", (top["life"].iloc[focus_row], focus_row),
                xytext=(33, 0), textcoords="offset points", va="center",
                fontsize=s.SMALL_SIZE - 1, color=s.SECONDARY,
                bbox={"facecolor": "white", "edgecolor": "none", "pad": 1.5})


def build_top_spenders(top):
    """Spending bars beside life-expectancy dots for the highest-spending countries."""
    fig = s.new_figure("The biggest health budget buys the shortest lives",
                       f"The {len(top)} countries that spend the most on health per person, 2018")
    bars = fig.add_axes(BARS_BOX)
    dots = fig.add_axes(DOTS_BOX)
    _rank_axis(bars, len(top), "Spending per person", RANK_SPEND_TICKS,
               [s.usd(t) for t in RANK_SPEND_TICKS])
    _rank_axis(dots, len(top), s.LIFE_LABEL, RANK_LIFE_TICKS, RANK_LIFE_TICKS)
    _draw_spend_bars(bars, top)
    _draw_life_dots(dots, top)
    return fig


def _hockey_stick(low, high):
    """End points of the two fitted lines, joined where they cross."""
    slope_low, slope_high = low["years_per_1000"] / 1000, high["years_per_1000"] / 1000
    knee = (high["intercept"] - low["intercept"]) / (slope_low - slope_high)
    rise = ([0, knee], [low["intercept"], low["intercept"] + slope_low * knee])
    flat = ([knee, high["spend_max"]],
            [high["intercept"] + slope_high * knee,
             high["intercept"] + slope_high * high["spend_max"]])
    return rise, flat


def _label_contrast(ax, snap):
    for code, (dx, dy, ha) in CONTRAST.items():
        row = snap.loc[snap["code"] == code].iloc[0]
        s.focus_dots(ax, row["spend"], row["life"], s.AGAINST_COLOR)
        ax.annotate(f"{row['country']}\n{row['life']:.1f} years on {s.usd(row['spend'])}",
                    (row["spend"], row["life"]), xytext=(dx, dy), linespacing=1.35,
                    textcoords="offset points", ha=ha, va="top", fontsize=s.SMALL_SIZE,
                    color=s.INK, path_effects=s.halo(), zorder=6,
                    arrowprops={"arrowstyle": "-", "color": s.MUTED, "lw": s.HAIRLINE,
                                "shrinkA": 2, "shrinkB": 4})


def build_plateau(snap, low, high, profile, breakpoint=c.PLATEAU_USD):
    """Scatter on a dollar-linear axis with separate trends below and above the breakpoint."""
    fig = s.new_figure(
        f"Past {s.usd(breakpoint)} a person, extra spending stops buying longer lives",
        f"{len(snap)} countries, 2018. Each line is a straight-line fit to the countries "
        f"on one side of {s.usd(breakpoint)}.")
    ax = fig.add_axes([s.LEFT, s.BOTTOM, s.RIGHT - s.LEFT, s.TOP - s.BOTTOM])
    s.life_axis(ax)
    ax.set_xlim(0, SPEND_AXIS_MAX)
    ax.set_xticks(range(0, SPEND_AXIS_MAX, 2000))
    ax.set_xticklabels([s.usd(t) for t in range(0, SPEND_AXIS_MAX, 2000)])
    ax.set_xlabel("Health spending per person")

    ax.axvspan(breakpoint, SPEND_AXIS_MAX, color=s.AGAINST_TINT, lw=0, zorder=0)
    s.context_dots(ax, snap["spend"], snap["life"])
    rise, flat = _hockey_stick(low, high)
    ax.plot(*rise, color=s.MUTED, lw=s.LINE_WIDTH, zorder=3, solid_capstyle="round")
    ax.plot(*flat, color=s.AGAINST_COLOR, lw=s.LINE_WIDTH + 0.4, zorder=4,
            solid_capstyle="round")
    _label_contrast(ax, snap)
    _trend_key(ax, low, high, profile, breakpoint)
    return fig


def _breakpoint_note(ax, profile, breakpoint):
    """Why the split sits where it does, stated above the key."""
    everyone = "Every" if profile["high_income"] == profile["above"] else \
        f"{profile['high_income']} of the"
    ax.text(KEY_X, KEY_NOTE_Y,
            f"Why {s.usd(breakpoint)}? {everyone} country above it is high-income, and\n"
            f"{profile['past_floor']} of those {profile['above']} already live past "
            f"{c.LONG_LIFE} years.",
            transform=ax.transAxes, va="bottom", linespacing=1.4,
            fontsize=s.SMALL_SIZE, color=s.SECONDARY)


def _trend_key(ax, low, high, profile, breakpoint):
    """In-chart key that says why the split is at the breakpoint and what each line is."""
    _breakpoint_note(ax, profile, breakpoint)
    days = high["years_per_1000"] * DAYS_PER_YEAR
    entries = [
        (s.MUTED, s.LINE_WIDTH, "normal",
         f"Fit to the {low['n']} countries under {s.usd(breakpoint)}: "
         f"+{low['years_per_1000']:.1f} years per extra $1,000"),
        (s.AGAINST_COLOR, s.LINE_WIDTH + 0.4, "bold",
         f"Fit to the {high['n']} countries over {s.usd(breakpoint)}: "
         f"+{days:.0f} days per extra $1,000"),
    ]
    for (color, width, weight, text), y in zip(entries, KEY_ROWS_Y):
        ax.plot([KEY_X, KEY_X + KEY_LINE], [y, y], color=color, lw=width,
                transform=ax.transAxes, solid_capstyle="round", zorder=4)
        ax.text(KEY_X + KEY_LINE + 0.015, y, text, transform=ax.transAxes, va="center",
                fontsize=s.TEXT_SIZE, color=s.INK, fontweight=weight)
