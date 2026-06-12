# MALMÖ UNDERGROUND

Anime rave rhythm brawler. Enemies rush at you through a neon warehouse rave —
each one carries a **D / F / J / K** badge. Punch them **on the beat**: an
approach ring closes onto each badge and flashes white exactly when you should
strike.

Music is MilleGG originals (real audio in `public/tracks/`) plus two
synthesized tracks (Web Audio). All art is drawn in code on a canvas —
or supplied as sprite PNGs under `assets/chars/<id>/`.

## Fighters

| | |
|---|---|
| **SHERIFFEN** | Bald young viking with a sheriff's hat and a full braided beard. Perk: TANK (+35 HP) |
| **VILGOT** | Tall, curly-maned smooth operator in a white tank, baggy jeans and flip flops. Perk: FLOW (forgiving timing) |
| **MILLE** | Small blonde angel with a golden backslick, baggy linen shirt and Birkenstock loafers. Perk: STARDUST (+15% score) |
| **SAGA** | Silver-bobbed striker in a grey crop top, shorts and star high-tops. Perk: TRIGGER (ultimate at 20 combo) |

## Combat

Punches mix with **kicks** (every 4th hit). At **25 combo** (20 for Saga) the
**ULTIMATE** triggers: an anime cut-in plays, your fighter pulls two pistols,
steps back and starts **shooting** enemies instead — tracers, shells, muzzle
flash — at **1.5× score** until the combo breaks.

## Tracks

1. **ÖKA** — MilleGG original, 87 BPM ★
2. **PARADISE NOBEL** — MilleGG original, 128 BPM ★★
3. **ANAKONDHUS** — MilleGG original, halftime 169 ★★
4. **MÖLLAN MASSIV** — acid techno (synth), 138 BPM ★★
5. **NORRA GRÄNGESBERG** — MilleGG original, 138 BPM ★★★
6. **TRIANGELN OVERDRIVE** — hard dance (synth), 150 BPM ★★★

The lobby theme is also a MilleGG original. File-track BPM and first-beat
offset are measured by onset autocorrelation; charts generate on the
16th-note grid.

Every track has **EASY / NORMAL / HARD** difficulty: hard is the full chart
(doubles + 16th bursts), normal thins it to 8th notes, easy to quarter notes.
Higher difficulty deals more miss damage but pays more score.

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
`__MU.start(charIdx, songIdx)`, `__MU.autoplay()`, `__MU.state()`, `__MU.hit(lane)`,
`__MU.finish()`, `__MU.kill()`, `__MU.tick(ms)`, `__MU.shot()`.
