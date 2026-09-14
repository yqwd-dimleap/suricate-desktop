# Upstream origin

This tree was copied from https://github.com/OpenHands/OpenHands
(commit/ref: shallow clone of main at import time) to bootstrap Suricate Desktop.

Retained for desktop packaging:
- `src/` — Agent Canvas React UI
- `electron/` + `electron-builder.config.mjs` — desktop shell
- `bin/`, `scripts/`, `config/`, `public/` — launchers and static assets
- build tooling (`vite`, `react-router`, etc.)

Further branding and product changes should land on top of this import.
