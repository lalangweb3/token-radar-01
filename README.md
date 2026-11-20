# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/lalangweb3/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/lalangweb3/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: protocols that record no token yet, ranked by what a token would be worth if their record stayed as it is. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## How the value is built

One formula scores every protocol — no name is ever special-cased:

```
implied = tvl_usd × compsMultiple(category) × growthFactor × maturityFactor
```

- **compsMultiple(category)** — the median market-cap-to-TVL ratio of the live tokens in the same category, computed from the sealed DefiLlama snapshot at run time. Categories with fewer than three live comparables use the global median.
- **growthFactor** — `1 + clamp(change_7d, −50, +100) / 100 × 0.4`: a week of growth moves the value, it never decides it.
- **maturityFactor** — `0.7 + min(age_days, 1460) / 1460 × 0.5`: a protocol that has run longer with no token scores higher, up to ×1.2.

The board covers every protocol on the snapshot's watchlist, plus every other rankable pre-token protocol below the floor. Live tokens are kept apart as the comparables that calibrate the model. Every row carries a six-step farm plan with what it costs and how long it takes.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

`main.ts` (Node 22, standard library only) reads the snapshot, writes `board.json` and `data.js`, copies `dashboard/` and `screenshots/` into the output directory, and writes `dossier.json` with the vendored make.fun library. Open `out/dashboard/index.html` in a browser — no network needed.

## Layout

- `main.ts` — the entrypoint: snapshot in, ranked board and dashboard out.
- `lib/model.ts` — the model: calibration, implied value, farm plans, board validation.
- `dashboard/` — the page: sortable, filterable board, per-protocol detail with the model's working, live-token comparables, and the model page.
- `screenshots/` — the board, a detail view, and a filtered view.
- `vendor/makefun-board.ts` — the make.fun dossier library (vendored from the kit).

---

<sub>Entered on [make.fun](https://make.fun/?ref=2pjpz4b5&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
