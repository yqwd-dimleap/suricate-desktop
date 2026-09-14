# suricate-desktop

Suricate Desktop is a local fork of **OpenHands Agent Canvas**, focused on packaging the Canvas UI as a desktop app (Electron).

## Upstream

- Source: [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) (Agent Canvas)
- License: MIT (see [LICENSE](./LICENSE))

This repo keeps the Canvas frontend + Electron desktop packaging path so it can be built independently of a full OpenHands cloud/SaaS stack.

## Desktop

```sh
npm install
npm run desktop              # build web UI + launch Electron
npm run build:desktop        # package installers via electron-builder
```

## Web / local stack

```sh
npm install
npm run dev                  # full local stack (agent-server + UI)
npm run build:app            # static frontend build
```

## Notes

- Canvas is a React SPA that talks to Agent Server over API (not an embedded backend HTML page).
- Multi-backend switching is configured in the UI (`Manage backends`).
