# Wiiwho Client — Launcher

Electron + TypeScript + React. Scaffolded from `@quick-start/electron`
(RESEARCH.md §Launcher Scaffold Playbook).

## Phase 1 scope

- Opens a 1000x650 non-resizable window with a "Play" button (dead button —
  logs stub payload; no launch logic — Phase 3 implements).
- Security posture: `contextIsolation: true` + `nodeIntegration: false` +
  `sandbox: true`, verified at runtime via the `__security:audit` IPC handler.
- Full Named-Channel IPC surface defined as stubs: `auth:*`, `game:*`,
  `settings:*`, `logs:read-crash`, plus the Phase-1-only `__security:audit`.

## Commands

From the repo root:

- `pnpm --filter launcher dev` — launch the dev window with HMR.
- `pnpm --filter launcher test:run` — run the Vitest unit suite.
- `pnpm --filter launcher build` — production main/preload/renderer bundle
  (Phase 3 wires `electron-builder` packaging).

## Security verification

In the DevTools console of the running dev window:

```js
await window.wiiwho.__debug.securityAudit()
// { contextIsolation: true, nodeIntegration: true /*=isOff*/, sandbox: true, allTrue: true }
```

`allTrue: true` is the single-bit go/no-go for LAUN-06. Two runtime assertions
in `App.tsx` also fire on page load:

```js
typeof window.process // 'undefined'
typeof window.require // 'undefined'
```

## What Phase 1 MUST NOT do (anti-scope per RESEARCH Pitfall 5)

The following dependencies are intentionally absent from `package.json`:

- `@azure/msal-node`, `prismarine-auth` — Phase 2 (auth)
- `@xmcl/core`, `@xmcl/installer`, `execa`, `p-queue` — Phase 3 (launch)
- `electron-log` — Phase 3 (structured logging)

The Play button is DEAD — clicking it only logs the stub payload.
No real auth, no subprocess spawning, no filesystem writes (settings are
in-memory only).

## Phase 2 / Phase 3 contract

See `src/renderer/src/wiiwho.d.ts` — that type surface is fixed. Phase 2 fills
the `auth.*` handler bodies in `src/main/ipc/auth.ts`; Phase 3 fills `game.*`,
`settings.*`, and `logs.*`. Neither phase adds new channels or new top-level
keys on `window.wiiwho`.
