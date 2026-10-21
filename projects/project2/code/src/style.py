"""Shared look for the four Project 2 figures."""
import matplotlib.pyplot as plt
from matplotlib import patheffects

# Text and chrome: labels stay in ink, only marks carry the series color.
INK, SECONDARY, MUTED = "#0b0b0b", "#52514e", "#898781"
GRID, AXIS, CONTEXT = "#e1e0d9", "#c3c2b7", "#b9b8b1"
FOR_COLOR = "#2a78d6"       # blue: the side arguing the proposition is true
AGAINST_COLOR = "#eb6834"   # orange: the side arguing it is false
AGAINST_TINT = "#fdf0eb"    # the orange as a ~10% wash
FIG_SIZE = (7.2, 4.0)       # two figures stack on one US Letter page
LEFT, RIGHT, BOTTOM, TOP = 0.09, 0.97, 0.185, 0.80
TITLE_Y, SUBTITLE_Y, SOURCE_Y = 0.925, 0.855, 0.025
TITLE_SIZE, TEXT_SIZE, SMALL_SIZE = 13.5, 9.5, 8.5
LINE_WIDTH, HAIRLINE = 1.8, 0.7
DOT_SIZE, FOCUS_SIZE = 24, 52          # marker areas in pt^2
DOT_RING, FOCUS_RING = 0.8, 1.5        # white ring that separates overlapping markers
LIFE_LIMITS = (50, 88)
LIFE_LABEL = "Life expectancy (years)"
SOURCE = "Source: World Bank, World Development Indicators"


def apply():
    plt.rcParams.update({
        "font.family": ["Arial", "Arial Unicode MS"], "font.size": TEXT_SIZE,
        "axes.edgecolor": AXIS, "axes.labelcolor": SECONDARY, "axes.labelsize": TEXT_SIZE,
        "axes.labelpad": 7, "axes.linewidth": HAIRLINE,
        "xtick.color": MUTED, "ytick.color": MUTED,
        "xtick.labelsize": SMALL_SIZE, "ytick.labelsize": SMALL_SIZE,
        "xtick.major.size": 0, "ytick.major.size": 0,
        "xtick.major.pad": 5, "ytick.major.pad": 5,
        "pdf.fonttype": 42,
        "text.parse_math": False,   # dollar signs are money here, not TeX
    })


def new_figure(title, subtitle):
    """Return a figure with the shared title block and source line already drawn."""
    apply()
    fig = plt.figure(figsize=FIG_SIZE)
    fig.text(LEFT, TITLE_Y, title, fontsize=TITLE_SIZE, fontweight="bold", color=INK)
    fig.text(LEFT, SUBTITLE_Y, subtitle, fontsize=TEXT_SIZE, color=SECONDARY)
    fig.text(LEFT, SOURCE_Y, SOURCE, fontsize=SMALL_SIZE - 1, color=MUTED)
    return fig


def strip_spines(ax, keep=("bottom",)):
    for side in ("left", "right", "top", "bottom"):
        ax.spines[side].set_visible(side in keep)


def life_axis(ax):
    """Shared y-axis so the scatter and ladder figures are directly comparable."""
    ax.set_ylim(*LIFE_LIMITS)
    ax.set_yticks(range(50, 90, 10))
    ax.set_ylabel(LIFE_LABEL)
    ax.grid(axis="y", color=GRID, lw=HAIRLINE, zorder=0)
    strip_spines(ax)


def context_dots(ax, x, y):
    ax.scatter(x, y, s=DOT_SIZE, color=CONTEXT, edgecolor="white", lw=DOT_RING, zorder=2)


def focus_dots(ax, x, y, color):
    ax.scatter(x, y, s=FOCUS_SIZE, color=color, edgecolor="white", lw=FOCUS_RING, zorder=5)


def halo():
    """White outline that keeps a label readable where it crosses markers."""
    return [patheffects.withStroke(linewidth=2.6, foreground="white")]


def usd(value):
    return f"${value:,.0f}"
