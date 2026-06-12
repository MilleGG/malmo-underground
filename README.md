# MALMÖ UNDERGROUND

Anime rave rhythm brawler. Enemies rush at you through a neon warehouse rave —
each one carries a **D / F / J / K** badge. Punch them **on the beat**.

All music is synthesized live in the browser (Web Audio) — no audio files.
All art is drawn in code on a canvas — no image files.

## Fighters

| | |
|---|---|
| **SHERIFFEN** | Bald young viking with a sheriff's hat and a full beard. Perk: TÅLIG (+35 HP) |
| **VILGOT** | Tall, curly-haired smooth operator in a white tank, baggy jeans and flip flops. Perk: FLOW (kinder timing windows) |
| **MILLE** | Small blonde angel with a backslick, baggy linen shirt and Birkenstock loafers. Perk: STJÄRNGLANS (+15% score) |

## Tracks

1. **NEON TUNNELBANA** — deep rave, 124 BPM ★
2. **MÖLLAN MASSIV** — acid techno, 138 BPM ★★
3. **TRIANGELN OVERDRIVE** — hard dance, 150 BPM ★★★

## Controls

- `D F J K` — punch the matching row
- `Enter` — confirm · `Esc` — back / pause · `R` — retry · `M` — mute
- Touch: tap the four vertical screen zones

## Run locally

```
npm install
npm start            # http://localhost:4312
```

## Debug

`window.__MU` exposes a headless test handle:
`__MU.start(charIdx, songIdx)`, `__MU.autoplay()`, `__MU.state()`, `__MU.hit(lane)`, `__MU.finish()`, `__MU.kill()`.
