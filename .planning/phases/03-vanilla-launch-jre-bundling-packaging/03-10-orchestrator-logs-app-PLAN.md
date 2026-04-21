---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 10
type: execute
wave: 3
depends_on: ["03-02", "03-03", "03-04", "03-05", "03-06", "03-07", "03-08", "03-09"]
files_modified:
  - launcher/src/main/ipc/game.ts
  - launcher/src/main/ipc/game.test.ts
  - launcher/src/main/ipc/logs.ts
  - launcher/src/main/ipc/logs.test.ts
  - launcher/src/main/ipc/settings.ts
  - launcher/src/main/index.ts
  - launcher/src/renderer/src/App.tsx
  - launcher/src/renderer/src/components/__tests__/App.test.tsx
autonomous: true
requirements:
  - LCH-01
  - LCH-02
  - LCH-03
  - LCH-05
  - LCH-06
  - LCH-07
  - LAUN-05
  - COMP-05
must_haves:
  truths:
    - "On game:play, the main-process orchestrator runs: manifest → libraries → assets → natives → spawn, pushing game:status-changed + game:progress along the way"
    - "game:cancel during downloading/verifying aborts in-flight work via AbortController"
    - "Main-menu sentinel firing minimizes the launcher window (D-12)"
    - "Non-zero JVM exit + crash-reports file → logs:read-crash returns sanitizeCrashReport(body); game:crashed pushed to renderer (D-17 + D-21)"
    - "Non-zero JVM exit + NO crash file within 5s → game:exited with non-zero code, renderer falls back to ring-buffer tail (D-11)"
    - "App.tsx renders CrashViewer as a full-page takeover when useGameStore.phase.state === 'crashed' (D-18)"
    - "App.tsx mounts SettingsDrawer as an overlay; gear icon button opens it; ESC/X/click-outside close it (D-01 + D-02)"
    - "logs:open-crash-folder opens <game-dir>/crash-reports/ in Explorer/Finder (D-19)"
    - "logs:list-crashes returns the list from monitor/crashReport.listCrashReports (D-19)"
  artifacts:
    - path: "launcher/src/main/ipc/game.ts"
      provides: "The orchestrator — game:play/cancel/status bodies + game:* push emitters"
    - path: "launcher/src/main/ipc/logs.ts"
      provides: "logs:read-crash, logs:open-crash-folder, logs:list-crashes bodies"
    - path: "launcher/src/main/index.ts"
      provides: "registerLogsHandlers hook + passes mainWindow reference to game handlers for minimize + push"
    - path: "launcher/src/renderer/src/App.tsx"
      provides: "gear-icon trigger, SettingsDrawer overlay, CrashViewer takeover branch, useGameStore.subscribe() on mount"
  key_links:
    - from: "launcher/src/main/ipc/game.ts"
      to: "launcher/src/main/launch/{manifest,libraries,assets,natives,args,spawn}.ts + AuthManager.getMinecraftToken + settings store"
      via: "orchestrator call graph"
      pattern: "spawnGame\\|getMinecraftToken"
    - from: "launcher/src/main/ipc/logs.ts"
      to: "launcher/src/main/auth/redact.ts sanitizeCrashReport + launcher/src/main/monitor/crashReport.ts"
      via: "read+sanitize+return"
      pattern: "sanitizeCrashReport"
    - from: "launcher/src/renderer/src/App.tsx"
      to: "useGameStore + CrashViewer + SettingsDrawer"
      via: "render branching on phase.state"
      pattern: "phase.state === 'crashed'"
---

<objective>
Close the loop. This plan is where every Phase 3 module meets:

1. **`ipc/game.ts`** becomes THE orchestrator — Play click → read settings → get MC token (AuthManager) → manifest → libraries → assets → natives → build argv → spawn → log-parse → sentinel-triggered window.minimize() → exit-watch → crash-watch → push events. AbortController wired from game:cancel.

2. **`ipc/logs.ts`** — new file. Handlers: `logs:read-crash` (sanitizes + returns), `logs:open-crash-folder` (shell.showItemInFolder), `logs:list-crashes` (delegates to crashReport.listCrashReports).

3. **`ipc/settings.ts`** — update the `logs:read-crash` stub line: remove it from settings.ts (Plan 03-02 preserved it as a stub). Move that responsibility into the new `ipc/logs.ts`. Update `main/index.ts` to `registerLogsHandlers()`.

4. **`main/index.ts`** — pass `mainWindow` reference to game handlers so orchestrator can `mainWindow.minimize()` on sentinel (D-12) and send push events to `mainWindow.webContents`.

5. **`App.tsx`** — render branches: `phase.state === 'crashed'` → `<CrashViewer>` full-page takeover. Otherwise render existing Home + `<PlayButton>` + `<AccountBadge>` + gear icon that opens `<SettingsDrawer>`. Wire `useGameStore.subscribe()` on mount. Wire "Logs"/"Crashes" drawer entries via prop callbacks.

Output: orchestrator + logs IPC + App.tsx wiring + integration tests. This is the LCH-05/LAUN-05/COMP-05 closure plan.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
@launcher/src/main/launch/manifest.ts
@launcher/src/main/launch/libraries.ts
@launcher/src/main/launch/assets.ts
@launcher/src/main/launch/natives.ts
@launcher/src/main/launch/args.ts
@launcher/src/main/launch/spawn.ts
@launcher/src/main/monitor/logParser.ts
@launcher/src/main/monitor/crashReport.ts
@launcher/src/main/auth/redact.ts
@launcher/src/main/auth/AuthManager.ts
@launcher/src/main/settings/store.ts
@launcher/src/main/paths.ts
@launcher/src/main/index.ts
@launcher/src/main/ipc/game.ts
@launcher/src/main/ipc/settings.ts
@launcher/src/renderer/src/App.tsx
@launcher/src/renderer/src/stores/game.ts
@launcher/src/renderer/src/stores/settings.ts
@launcher/src/renderer/src/components/PlayButton.tsx
@launcher/src/renderer/src/components/CrashViewer.tsx
@launcher/src/renderer/src/components/SettingsDrawer.tsx

<interfaces>
All Wave 2 + Plan 03-09 outputs are in place. This plan is pure integration.

Orchestrator phases map to game:status-changed payloads:
```
{state:'downloading'} → after settings read + token read; wrap manifest+libraries+assets+natives
{state:'verifying'}   → post-xmcl (xmcl already SHA1-verifies; this is essentially a no-op flip for UI)
{state:'starting'}    → just before spawn
{state:'playing'}     → on sentinel fire (LogParser.onMainMenu) — also minimize window here (D-12)
{state:'idle'}        → on clean exit (code 0 / SIGINT / SIGTERM)
```

Push events the main orchestrator fires (channels already listed in Plan 03-09):
- `game:status-changed` — state transitions
- `game:progress` — from ensureXxx progress callbacks
- `game:log` — from LogParser.opts.onLine
- `game:exited` — from spawnGame's `{exitCode}` resolution
- `game:crashed` — after crashReport.watchForCrashReport resolves with a filename (sanitize + push)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: ipc/game.ts orchestrator — full launch pipeline</name>
  <files>
    launcher/src/main/ipc/game.ts,
    launcher/src/main/ipc/game.test.ts
  </files>
  <read_first>
    - launcher/src/main/ipc/game.ts (Phase 1 stub — identify shape to replace)
    - launcher/src/main/ipc/game.test.ts (Phase 1 tests — rewrite around orchestrator)
    - launcher/src/main/launch/*.ts (ALL modules — call graph must match)
    - launcher/src/main/monitor/logParser.ts (LogParser is constructed here)
    - launcher/src/main/monitor/crashReport.ts (watchForCrashReport wired post-exit)
    - launcher/src/main/auth/AuthManager.ts (getMinecraftToken())
    - launcher/src/main/settings/store.ts (readSettings for ramMb)
    - launcher/src/main/paths.ts (resolveJavaBinary, resolveGameDir, resolveCrashReportsDir)
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1: `game:play` handler runs the orchestrator: readSettings → getMinecraftToken → fetchAndCacheManifest → resolveVersion → ensureClientJar → ensureLibraries → ensureAssets → ensureNatives → buildArgv → spawnGame. Mock every downstream module; assert call order.
    - Test 2: game:status-changed push events fired in the expected sequence (downloading → verifying → starting → playing).
    - Test 3: game:progress events relayed from ensureLibraries progress callback.
    - Test 4: game:log events fired from LogParser.onLine.
    - Test 5: LogParser.onMainMenu fires → orchestrator calls `mainWindow.minimize()` (mocked BrowserWindow) AND sends `game:status-changed {state:'playing'}`.
    - Test 6: spawnGame resolves `{exitCode: 0}` → game:exited `{exitCode: 0}` push + game:status-changed `{state:'idle'}`.
    - Test 7: spawnGame resolves `{exitCode: 1}` + crashReport.watchForCrashReport resolves a filename → `readCrashReport + sanitizeCrashReport(body)` → `game:crashed {sanitizedBody, crashId}` pushed to renderer.
    - Test 8: spawnGame `{exitCode: 1}` + watchForCrashReport resolves null → `game:exited {exitCode:1}` pushed but NO game:crashed.
    - Test 9: `game:cancel` during downloading aborts the in-flight AbortController → xmcl receives the signal → game:status-changed `{state:'idle'}`.
    - Test 10: Calling `game:play` while already `'downloading'` is a no-op (guard against double-launch).
    - Test 11: `game:play` without an authenticated user (getMinecraftToken throws) → game:status-changed `{state:'failed'}` + `game:exited {exitCode: -1}` OR equivalent error surface.
    - Test 12 (COMP-05 regression): The crash-body sent via game:crashed is `sanitizeCrashReport(rawBody)` — assert the push event's payload does NOT contain the raw token fixture value `ey.fakeTokenBody123`.

    Heavy mocking — but the call graph is the real test.
  </behavior>
  <action>
    Rewrite `launcher/src/main/ipc/game.ts` as the orchestrator. Structure:

    ```typescript
    import { ipcMain, BrowserWindow } from 'electron'
    import log from 'electron-log/main'
    import { readSettings } from '../settings/store'
    import { getAuthManager } from '../auth/AuthManager'
    import { sanitizeCrashReport } from '../auth/redact'
    import { fetchAndCacheManifest, resolveVersion } from '../launch/manifest'
    import { ensureClientJar, ensureLibraries, resolveClasspath } from '../launch/libraries'
    import { ensureAssets } from '../launch/assets'
    import { ensureNatives } from '../launch/natives'
    import { buildArgv } from '../launch/args'
    import { spawnGame } from '../launch/spawn'
    import { LogParser } from '../monitor/logParser'
    import { watchForCrashReport, readCrashReport } from '../monitor/crashReport'
    import { resolveJavaBinary, resolveGameDir, resolveCrashReportsDir } from '../paths'
    import path from 'node:path'

    type GetWin = () => BrowserWindow | null

    type Phase = 'idle' | 'downloading' | 'verifying' | 'starting' | 'playing'

    let currentAbort: AbortController | null = null
    let currentPhase: Phase = 'idle'

    function send(getWin: GetWin, channel: string, payload: unknown): void {
      const win = getWin()
      if (!win) return
      win.webContents.send(channel, payload)
    }
    function setStatus(getWin: GetWin, state: Phase): void {
      currentPhase = state
      send(getWin, 'game:status-changed', { state })
    }

    export function registerGameHandlers(getWin: GetWin): void {
      ipcMain.handle('game:play', async () => {
        if (currentPhase !== 'idle') {
          return { ok: false, reason: 'already-running' }
        }
        const abort = new AbortController()
        currentAbort = abort

        try {
          const settings = await readSettings()
          const mc = await getAuthManager().getMinecraftToken()

          setStatus(getWin, 'downloading')
          const gameDir = resolveGameDir()
          const progress = (p: { bytesDone: number; bytesTotal: number; currentFile: string }): void => {
            send(getWin, 'game:progress', p)
          }

          await fetchAndCacheManifest('1.8.9', gameDir, fetch, abort.signal)
          const resolved = await resolveVersion(gameDir, '1.8.9')
          await ensureClientJar(resolved, gameDir, progress, abort.signal)
          await ensureLibraries(resolved, gameDir, progress, abort.signal)
          await ensureAssets(resolved, gameDir, progress, abort.signal)

          setStatus(getWin, 'verifying')   // xmcl verified as it downloaded; flip for UI
          const nativesDir = await ensureNatives(resolved, gameDir)

          setStatus(getWin, 'starting')
          const javaPath = resolveJavaBinary()
          const classpath = resolveClasspath(resolved, gameDir)
          const argv = buildArgv(resolved, {
            ramMb: settings.ramMb,
            gameDir,
            nativesDir,
            classpath,
            username: mc.username,
            uuid: mc.uuid,
            accessToken: mc.accessToken,
            launcherVersion: '0.1.0'
          })

          const parser = new LogParser({
            onLine: (entry) => send(getWin, 'game:log', entry),
            onMainMenu: () => {
              setStatus(getWin, 'playing')
              const w = getWin()
              if (w && !w.isDestroyed()) w.minimize()  // D-12
            }
          })

          const { exitCode } = await spawnGame({
            javaPath,
            argv,
            cwd: gameDir,
            abortSignal: abort.signal,
            onLine: (line, stream) => parser.ingest(line, stream)
          })
          parser.stop()
          send(getWin, 'game:exited', { exitCode })

          if (exitCode !== 0 && exitCode !== 130 && exitCode !== 143) {
            // Non-zero — watch for crash report (D-17)
            const filename = await watchForCrashReport(resolveCrashReportsDir(), 5000)
            if (filename) {
              const body = await readCrashReport(resolveCrashReportsDir(), filename)
              const sanitizedBody = sanitizeCrashReport(body)
              send(getWin, 'game:crashed', { sanitizedBody, crashId: filename })
            }
          }

          setStatus(getWin, 'idle')
          return { ok: true }
        } catch (err) {
          log.warn('[game] play failed:', err)
          setStatus(getWin, 'idle')
          return {
            ok: false,
            error: err instanceof Error ? err.message : String(err)
          }
        } finally {
          currentAbort = null
        }
      })

      ipcMain.handle('game:cancel', async () => {
        currentAbort?.abort()
        return { ok: true }
      })

      ipcMain.handle('game:status', async () => {
        return { state: currentPhase }
      })
    }
    ```

    Rewrite `game.test.ts` with the 12 tests. Use module-level mocks for every imported `../launch/*`, `../monitor/*`, `../auth/*`, `../settings/*`, and `../paths`. Test `ipcMain.handle` capture pattern from Phase 2.

    Edit `launcher/src/main/index.ts` to pass `() => mainWindowRef` to `registerGameHandlers`:
    ```typescript
    registerGameHandlers(() => mainWindowRef)
    ```
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/ipc/game.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "registerGameHandlers" launcher/src/main/ipc/game.ts`
    - `grep -q "getMinecraftToken" launcher/src/main/ipc/game.ts` (LCH-06)
    - `grep -q "fetchAndCacheManifest" launcher/src/main/ipc/game.ts` (LCH-01)
    - `grep -q "ensureLibraries" launcher/src/main/ipc/game.ts` (LCH-02)
    - `grep -q "ensureAssets" launcher/src/main/ipc/game.ts` (LCH-02)
    - `grep -q "ensureNatives" launcher/src/main/ipc/game.ts`
    - `grep -q "buildArgv" launcher/src/main/ipc/game.ts` (LCH-05)
    - `grep -q "spawnGame" launcher/src/main/ipc/game.ts` (LCH-05)
    - `grep -q "LogParser" launcher/src/main/ipc/game.ts` (LCH-07)
    - `grep -q "watchForCrashReport" launcher/src/main/ipc/game.ts` (LAUN-05)
    - `grep -q "sanitizeCrashReport" launcher/src/main/ipc/game.ts` (COMP-05)
    - `grep -q ".minimize()" launcher/src/main/ipc/game.ts` (D-12)
    - `grep -q "AbortController" launcher/src/main/ipc/game.ts` (D-13)
    - `grep -q "game:crashed" launcher/src/main/ipc/game.ts`
    - `grep -q "game:exited" launcher/src/main/ipc/game.ts`
    - `grep -q "game:log" launcher/src/main/ipc/game.ts`
    - `grep -q "registerGameHandlers(() =>" launcher/src/main/index.ts` (window ref passed)
    - `cd launcher &amp;&amp; npx vitest run src/main/ipc/game.test.ts` exits 0 with ≥12 tests passing
  </acceptance_criteria>
  <done>Orchestrator complete; all 12 tests green; LCH-05/06/07 + LAUN-05 + COMP-05 covered.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: ipc/logs.ts + move read-crash out of settings.ts</name>
  <files>
    launcher/src/main/ipc/logs.ts,
    launcher/src/main/ipc/logs.test.ts,
    launcher/src/main/ipc/settings.ts,
    launcher/src/main/index.ts
  </files>
  <read_first>
    - launcher/src/main/ipc/settings.ts (REMOVE the logs:read-crash stub from here)
    - launcher/src/main/auth/redact.ts (sanitizeCrashReport)
    - launcher/src/main/monitor/crashReport.ts (readCrashReport, listCrashReports)
    - launcher/src/main/paths.ts (resolveCrashReportsDir)
    - launcher/src/preload/index.ts (the 3 channels this file handles)
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1: `logs:read-crash` with `{crashId: 'crash-2026-...-client.txt'}` reads that file from `resolveCrashReportsDir()`, runs `sanitizeCrashReport`, returns `{sanitizedBody}`.
    - Test 2: `logs:read-crash` without crashId reads the NEWEST crash file (via listCrashReports — first entry).
    - Test 3: `logs:read-crash` when no crashes exist returns `{sanitizedBody: ''}` (never throws to the renderer).
    - Test 4 (COMP-05 regression): The returned `sanitizedBody` does NOT contain the raw token fixture value `ey.fakeTokenBody123` — assert with the fixture file as input.
    - Test 5: `logs:open-crash-folder` calls `shell.showItemInFolder` with the resolved crash-reports path — or the specific crash file if crashId is passed.
    - Test 6: `logs:list-crashes` returns `{crashes: [...]}` matching crashReport.listCrashReports output.
  </behavior>
  <action>
    Create `launcher/src/main/ipc/logs.ts`:

    ```typescript
    /**
     * logs:* handlers — fills the Phase 1 stub and adds open-crash-folder + list-crashes.
     *
     * Sanitization invariant (D-21): the sanitizedBody returned by logs:read-crash
     * is what the renderer displays AND writes to the clipboard (CrashViewer does
     * NO further sanitization — assertion in Plan 03-08).
     */

    import { ipcMain, shell } from 'electron'
    import { promises as fs } from 'node:fs'
    import path from 'node:path'
    import log from 'electron-log/main'
    import { sanitizeCrashReport } from '../auth/redact'
    import { readCrashReport, listCrashReports } from '../monitor/crashReport'
    import { resolveCrashReportsDir } from '../paths'

    export function registerLogsHandlers(): void {
      ipcMain.handle('logs:read-crash', async (_event, opts?: { crashId?: string }) => {
        const dir = resolveCrashReportsDir()
        let filename = opts?.crashId ?? null
        if (!filename) {
          const list = await listCrashReports(dir)
          filename = list[0] ?? null
        }
        if (!filename) return { sanitizedBody: '' }
        try {
          const raw = await readCrashReport(dir, filename)
          return { sanitizedBody: sanitizeCrashReport(raw) }
        } catch (err) {
          log.warn('[logs] read-crash failed', err)
          return { sanitizedBody: '' }
        }
      })

      ipcMain.handle(
        'logs:open-crash-folder',
        async (_event, opts?: { crashId?: string | null }) => {
          const dir = resolveCrashReportsDir()
          try {
            // If the user passed a crashId, reveal that specific file; else open the folder itself.
            const target = opts?.crashId ? path.join(dir, opts.crashId) : dir
            // Ensure dir exists so Finder/Explorer doesn't error.
            await fs.mkdir(dir, { recursive: true })
            shell.showItemInFolder(target)
            return { ok: true }
          } catch (err) {
            log.warn('[logs] open-crash-folder failed', err)
            return { ok: false }
          }
        }
      )

      ipcMain.handle('logs:list-crashes', async () => {
        const dir = resolveCrashReportsDir()
        const crashes = await listCrashReports(dir)
        return { crashes: crashes.map((f) => ({ crashId: f })) }
      })
    }
    ```

    **Edit `launcher/src/main/ipc/settings.ts`** — REMOVE the `ipcMain.handle('logs:read-crash', ...)` stub. The rest of the file stays. The registerSettingsHandlers function must no longer register `logs:read-crash`. This cleanly separates Plan 03-02's domain from Plan 03-10's.

    **Edit `launcher/src/main/index.ts`** — import and call `registerLogsHandlers()` alongside the other register calls.

    ```typescript
    import { registerLogsHandlers } from './ipc/logs'
    // ...
    registerAuthHandlers(() => mainWindowRef)
    registerGameHandlers(() => mainWindowRef)
    registerSettingsHandlers()
    registerLogsHandlers()    // NEW
    registerSecurityHandlers()
    ```

    Write `logs.test.ts` with the 6 tests. Mock `electron.shell`, `../auth/redact`, `../monitor/crashReport`, `../paths`. For Test 4, use the fixture file + call the real redact module (don't mock redact — assert the integration).
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/ipc/logs.test.ts src/main/ipc/settings.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export function registerLogsHandlers" launcher/src/main/ipc/logs.ts`
    - `grep -q "logs:read-crash" launcher/src/main/ipc/logs.ts`
    - `grep -q "logs:open-crash-folder" launcher/src/main/ipc/logs.ts`
    - `grep -q "logs:list-crashes" launcher/src/main/ipc/logs.ts`
    - `grep -q "sanitizeCrashReport" launcher/src/main/ipc/logs.ts` (D-21)
    - `grep -q "shell.showItemInFolder" launcher/src/main/ipc/logs.ts`
    - `grep -qv "logs:read-crash" launcher/src/main/ipc/settings.ts` (removed from settings.ts)
    - `grep -q "registerLogsHandlers" launcher/src/main/index.ts` (wired)
    - `cd launcher &amp;&amp; npx vitest run src/main/ipc/logs.test.ts` exits 0 with ≥6 tests passing
    - `cd launcher &amp;&amp; npx vitest run src/main/ipc/settings.test.ts` still exits 0 (removing the stub doesn't break settings tests — update them if needed)
  </acceptance_criteria>
  <done>Logs IPC file owns all three logs:* channels; settings.ts clean of logs:* references; main bootstrap wires it; tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: App.tsx wiring — crashed takeover, SettingsDrawer, gear icon, game subscribe</name>
  <files>
    launcher/src/renderer/src/App.tsx,
    launcher/src/renderer/src/components/__tests__/App.test.tsx
  </files>
  <read_first>
    - launcher/src/renderer/src/App.tsx (current Phase 2 state)
    - launcher/src/renderer/src/stores/game.ts (Plan 03-08 — subscribe wired)
    - launcher/src/renderer/src/stores/settings.ts (Plan 03-07 — initialize wired)
    - launcher/src/renderer/src/components/PlayButton.tsx (Plan 03-08 — replaces inline button)
    - launcher/src/renderer/src/components/SettingsDrawer.tsx (Plan 03-07 — overlay)
    - launcher/src/renderer/src/components/CrashViewer.tsx (Plan 03-08 — full-page takeover)
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1 (mount): When state='logged-in' and phase='idle', the existing Play-forward screen renders. Gear icon button is present top-right (near AccountBadge). PlayButton is centered.
    - Test 2 (gear click → drawer): Clicking gear icon sets drawer open=true. SettingsDrawer is in the DOM.
    - Test 3 (gear ESC → drawer close): Opening drawer then pressing ESC closes it. Home remains.
    - Test 4 (phase=crashed → CrashViewer): Setting `useGameStore.setState({phase: {state:'crashed', sanitizedBody:'...body...', crashId:'crash-x'}})` → CrashViewer is rendered full-page; PlayButton returns null (Plan 03-08 behavior).
    - Test 5 (CrashViewer Close → back to Home): Clicking Close on CrashViewer calls `resetToIdle()` → phase goes to idle → Home renders.
    - Test 6 (CrashViewer Play again → orchestrator call): Clicking Play again calls `useGameStore.play()` → game:play IPC invoked.
    - Test 7 (subscribe on mount): Mounting App calls `useGameStore.subscribe()` once. Unmount calls unsubscribe.
    - Test 8 (settings hydrate on mount): Mounting App calls `useSettingsStore.initialize()` once.

    Use the Phase 2 pattern for state override: `useAuthStore.setState({state:'logged-in', username:'Wiiwho', uuid:'u'})` to jump past the login screen.
  </behavior>
  <action>
    Edit `launcher/src/renderer/src/App.tsx` — replace the inline Play button with `<PlayButton />`, add gear icon + SettingsDrawer overlay, add CrashViewer branch, wire subscribe on mount.

    ```tsx
    import { useEffect, useState } from 'react'
    import { Settings as SettingsIcon } from 'lucide-react'
    import { useAuthStore } from './stores/auth'
    import { useGameStore } from './stores/game'
    import { useSettingsStore } from './stores/settings'
    import { LoginScreen } from './components/LoginScreen'
    import { LoadingScreen } from './components/LoadingScreen'
    import { AccountBadge } from './components/AccountBadge'
    import { PlayButton } from './components/PlayButton'
    import { SettingsDrawer } from './components/SettingsDrawer'
    import { CrashViewer } from './components/CrashViewer'

    console.assert(
      typeof (globalThis as unknown as { process?: unknown }).process === 'undefined',
      'SECURITY: process is defined in renderer'
    )
    console.assert(
      typeof (globalThis as unknown as { require?: unknown }).require === 'undefined',
      'SECURITY: require is defined in renderer'
    )

    const LOADING_MIN_MS = 300
    const LOADING_FALLBACK_MS = 8000

    function App(): React.JSX.Element {
      const authState = useAuthStore((s) => s.state)
      const initializeAuth = useAuthStore((s) => s.initialize)
      const subscribeGame = useGameStore((s) => s.subscribe)
      const gamePhase = useGameStore((s) => s.phase)
      const resetGame = useGameStore((s) => s.resetToIdle)
      const playGame = useGameStore((s) => s.play)
      const initSettings = useSettingsStore((s) => s.initialize)
      const [loadingHeld, setLoadingHeld] = useState(true)
      const [settingsOpen, setSettingsOpen] = useState(false)

      useEffect(() => {
        void initializeAuth()
        void initSettings()
        const unsubscribeGame = subscribeGame()

        const unsubDeviceCode = window.wiiwho.auth.onDeviceCode((payload) => {
          useAuthStore.getState().setDeviceCode(payload)
        })

        const fallback = setTimeout(() => {
          if (useAuthStore.getState().state === 'loading') {
            useAuthStore.setState({ state: 'logged-out', initialized: true })
          }
        }, LOADING_FALLBACK_MS)
        const minHold = setTimeout(() => setLoadingHeld(false), LOADING_MIN_MS)

        return (): void => {
          unsubDeviceCode()
          unsubscribeGame()
          clearTimeout(fallback)
          clearTimeout(minHold)
        }
      }, [initializeAuth, subscribeGame, initSettings])

      if (authState === 'loading' || loadingHeld) {
        return <LoadingScreen />
      }

      if (authState !== 'logged-in') {
        return <LoginScreen />
      }

      // D-18: crashed state takes over the whole screen, suppresses normal Home chrome.
      if (gamePhase.state === 'crashed') {
        return (
          <CrashViewer
            sanitizedBody={gamePhase.sanitizedBody}
            crashId={gamePhase.crashId}
            onClose={() => resetGame()}
            onPlayAgain={() => {
              resetGame()
              void playGame()
            }}
            onOpenCrashFolder={(crashId) => {
              void window.wiiwho.logs.openCrashFolder(crashId ?? undefined)
            }}
          />
        )
      }

      return (
        <div className="relative h-screen w-screen bg-neutral-900">
          <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
            <button
              type="button"
              aria-label="Open settings"
              onClick={() => setSettingsOpen(true)}
              className="text-neutral-400 hover:text-neutral-200 p-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16e0ee]"
            >
              <SettingsIcon className="size-5" aria-hidden="true" />
            </button>
            <AccountBadge />
          </div>

          <div className="h-full w-full flex flex-col items-center justify-center">
            <h1 className="text-4xl font-semibold text-[#16e0ee] mb-8">
              Wiiwho Client
            </h1>
            <PlayButton />
            <p className="text-xs font-normal text-neutral-500 mt-8">v0.1.0-dev</p>
          </div>

          <SettingsDrawer
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            onOpenLogs={() => {
              // Logs sub-view deferred (D-07 entry in drawer; in v0.1 we just open the folder)
              void window.wiiwho.logs.openCrashFolder()
            }}
            onOpenCrashes={() => {
              void window.wiiwho.logs.openCrashFolder()
            }}
          />
        </div>
      )
    }

    export default App
    ```

    Write `App.test.tsx` under `launcher/src/renderer/src/components/__tests__/App.test.tsx` with the 8 tests. Use `@vitest-environment jsdom`, afterEach cleanup, pointer-capture stubs.

    For each test, pre-set `useAuthStore.setState({state:'logged-in', username:'Wiiwho', uuid:'u', initialized:true})` before render. Use `vi.useFakeTimers()` to advance past LOADING_MIN_MS.

    For Test 7 (subscribe), mock `useGameStore.getState().subscribe` with a vi.fn — assert it was called once.

    For Test 8 (settings hydrate), mock `window.wiiwho.settings.get` → assert it was called once.

    Mock `window.wiiwho.logs.openCrashFolder` as vi.fn so CrashViewer's Open-folder test works.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/renderer/src/components/__tests__/App.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "import.*PlayButton" launcher/src/renderer/src/App.tsx`
    - `grep -q "import.*SettingsDrawer" launcher/src/renderer/src/App.tsx`
    - `grep -q "import.*CrashViewer" launcher/src/renderer/src/App.tsx`
    - `grep -q "useGameStore" launcher/src/renderer/src/App.tsx`
    - `grep -q "useSettingsStore" launcher/src/renderer/src/App.tsx`
    - `grep -q "subscribeGame\\|subscribe()" launcher/src/renderer/src/App.tsx`
    - `grep -q "gamePhase.state === 'crashed'" launcher/src/renderer/src/App.tsx` (D-18 branch)
    - `grep -q "Open settings\\|aria-label=\"Open settings\"" launcher/src/renderer/src/App.tsx` (gear button)
    - `grep -q "openCrashFolder" launcher/src/renderer/src/App.tsx`
    - `cd launcher &amp;&amp; npx vitest run src/renderer/src/components/__tests__/App.test.tsx` exits 0 with ≥8 tests passing
  </acceptance_criteria>
  <done>App.tsx wires the full Phase 3 UI: gear, drawer, crashed takeover, game subscribe, settings hydrate; 8 tests green.</done>
</task>

</tasks>

<verification>
- `cd launcher && npm run test:run` — full suite green (Phase 1 + Phase 2 + all Phase 3 plans)
- `cd launcher && npm run typecheck` — no type regressions
- `cd launcher && npm run build` — dev bundle builds clean
- Frozen IPC surface invariant confirmed: `grep -c "contextBridge.exposeInMainWorld" launcher/src/preload/index.ts` === 1 and top-level keys still 5
</verification>

<success_criteria>
- LCH-01, LCH-02, LCH-03, LCH-05, LCH-06, LCH-07 all exercised in orchestrator integration test
- LAUN-05: crash path → game:crashed push with sanitized body (test covers)
- COMP-05: `sanitizeCrashReport` is the ONLY redaction path for clipboard + display (tests confirm)
- D-12 window minimize on sentinel (test covers)
- D-13 cancel during downloading aborts (test covers)
- D-18 crashed takeover in App.tsx (test covers)
- D-19 four crash-viewer actions wired through to main-process shell operations
- Frozen IPC surface preserved
</success_criteria>

<output>
After completion, create `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-10-SUMMARY.md` documenting:
- The actual phase-transition sequence observed in the E2E test
- Any xmcl progress-callback quirks (fineness, frequency)
- AbortSignal plumbing through xmcl — whether its installers honor the signal or we need p-queue wrapping
- How the 6s exit-to-crashed-fallback interacts with the renderer's 6s fallback (should be compatible; main fires game:crashed within 5s, renderer timeout is 6s)
</output>
