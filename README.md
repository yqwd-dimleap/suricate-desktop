# suricate-desktop

Suricate Desktop is a local fork of **OpenHands Agent Canvas**, focused on packaging the Canvas UI as a desktop app (Electron).

## Upstream

- Source: [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) (Agent Canvas)
- License: MIT (see [LICENSE](./LICENSE))

This repo keeps the Canvas frontend + Electron desktop packaging path so it can be built independently of a full OpenHands cloud/SaaS stack.

## Desktop (independent installer, like Agent Canvas `.dmg`)

From this repo root:

```sh
npm install
npm run build                # same as npm run build:desktop
# or: ./build.sh
```

macOS output (Apple Silicon):

```
dist-electron/Suricate-Desktop-0.1.0-arm64.dmg
```

Other scripts:

| Command | What it does |
|---------|----------------|
| `npm run build` / `npm run build:dmg` / `npm run build:mac` | Frontend + uv/node + electron-builder DMG |
| `npm run build:desktop:universal` | Universal macOS (still ships host-arch uv/node) |
| `npm run desktop` | Dev: build web UI and open Electron (not a DMG) |
| `npm run build:web` / `npm run build:app` | Static web UI only (`build/`) |

## Web / local stack

```sh
npm install
npm run dev                  # full local stack (agent-server + UI)
npm run build:app            # static frontend build
```

## Notes

- Canvas is a React SPA that talks to Agent Server over API (not an embedded backend HTML page).
- Multi-backend switching is configured in the UI (`Manage backends`).
