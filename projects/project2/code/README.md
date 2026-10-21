# DSC 106 Project 2: code for the figures

Builds the charts in the report (`../index.html`) from World Bank health indicators, 2018.

## Setup

1. Download `health-raw-2021.csv` (36 MB, too big to keep here) from the course dataset repo:
   https://github.com/light-and-salt/World-Bank-Data-by-Indicators/blob/master/health/health-raw-2021.csv
2. Put it in `data/` next to `country_metadata.csv`.
3. Install the libraries: `pip install pandas numpy matplotlib`

## Run

```bash
python3 src/main.py
```

Charts are written to `output/` as PDF and PNG, together with `countries_2018.csv`, the data used by the interactive chart.
The report uses `for_a_doubling.png` (Figure 1) and `against_d_plateau.png` (Figure 2). Copy those two and the CSV into `projects/project2/` to update the page.

```bash
python3 -m unittest discover -s tests
```

## Files

| File | What it does |
|---|---|
| `src/clean.py` | Loads the data, keeps 178 countries, and does the fits (log2 regression, split at $2,000) |
| `src/plot_pro.py` | Figures for the proposition: A (log scatter, used in the report) and B (spending fifths) |
| `src/plot_con.py` | Figures against it: C (top 15 spenders) and D (the $2,000 plateau, used in the report) |
| `src/style.py` | Shared colors, fonts and layout |
| `src/main.py` | Builds everything and prints the numbers quoted in the report |
