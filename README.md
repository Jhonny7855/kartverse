# KARTVERSE

A premium 3D browser go-kart racer built with React, TypeScript and Three.js. Everything — karts, circuits, textures, audio — is generated procedurally at runtime, so there are no external assets and no network calls.

## Play

https://jhonny7855.github.io/kartverse/

## Features

- **6 kart classes** with distinct handling: Speedster, Aurelia (balanced), Drifter, Heavy, Rocket, Tech
- **6 themed circuits**: Neon City, Sunset Coast, Forest Rush, Volcano Circuit, Skyline GP, Desert Storm
- **5 race modes**: Quick Race, Time Trial, Grand Prix (4 rounds with points), Elimination, Practice
- **Ghost replay** in Time Trial, recorded at 20 Hz and replayed against your best lap
- **Full garage**: paint, wheels, rims, underglow, decals, racing number, spoilers, exhausts
- **Progression**: XP and levels, credits, kart unlocks, 16 achievements, local leaderboards
- Procedural kart models, spline-built tracks, synthesized engine audio via Web Audio
- Save data persisted to `localStorage` with versioning, sanitisation, export and import

## Controls

| Action | Keys |
| --- | --- |
| Accelerate / Brake | `W` / `S` or `↑` / `↓` |
| Steer | `A` / `D` or `←` / `→` |
| Drift | `Shift` |
| Boost | `Space` |
| Use item | `F` |
| Change camera | `C` |
| Pause | `Esc` |

Bindings are rebindable in Settings.

## Development

```bash
npm install
npm run dev        # dev server on port 5173
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

## Tech

React 18 · TypeScript 5.6 · Three.js 0.170 · Vite 5.4

Physics runs on a fixed 120 Hz step with sub-stepping. The AI uses a corner-speed model derived from track curvature and lateral grip, with avoidance, mistakes and rubber-banding.

## Licence

Personal project. Not affiliated with any kart racing franchise.
