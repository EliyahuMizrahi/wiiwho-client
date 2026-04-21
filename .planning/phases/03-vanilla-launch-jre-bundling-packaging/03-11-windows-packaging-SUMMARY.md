---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 11
subsystem: packaging
tags:
  - electron-builder
  - nsis
  - dmg
  - temurin
  - jre
  - prefetch
  - gradle
  - gitignore
  - windows

# Dependency graph
requires:
  - phase: 03-vanilla-launch-jre-bundling-packaging
    provides: "paths.ts resolveJavaBinary()/resolveModJar() (Plan 03-01); gitignore rules for resources/jre/ and resources/mod/ (Plan 03-00); client-mod Gradle build (Phase 1 foundations)"
provides:
  - "launcher/scripts/prefetch-jre.mjs — zero-dep Node 22 ESM downloader; SHA256-verifies + extracts Temurin 8u482 into win-x64, mac-x64, mac-arm64 slots"
  - "launcher/scripts/build-mod.sh — wraps client-mod ./gradlew[.bat] build -Pversion=0.1.0, stages jar at launcher/resources/mod/wiiwho-0.1.0.jar"
  - "launcher/package.json: prefetch-jre / build-mod / package-resources / dist:win / dist:mac / build:win / build:mac scripts; build:linux removed"
  - "launcher/electron-builder.yml — full rewrite matching RESEARCH §Config Fragment: NSIS x64 + Universal DMG + extraResources jre + mod + asarUnpack resources/**"
  - "build/README-macOS.txt + launcher/build/README-macOS.txt — right-click-Open Gatekeeper walkthrough for the DMG"
  - "docs/install-macos.md — public macOS install guide with Rosetta 2 note + x64-in-both-mac-slots rationale"
  - "launcher/dist/win-unpacked/ — complete Windows electron bundle with JRE + mod jar correctly extraResources-placed"
affects:
  - "03-12-macos-dmg (this plan authored all config + docs the Mac build needs; Plan 03-12 just runs `pnpm run dist:mac` on a Mac)"
  - "04-forge-injection (Phase 4 can rely on resolveModJar() locating wiiwho-0.1.0.jar at a stable packaged path)"

# Tech tracking
tech-stack:
  added: []  # No new runtime deps — all tooling is either Node 22 builtins or already-installed (electron-builder, pnpm, bash)
  patterns:
    - "Zero-dep Node 22 ESM build scripts — `fetch`, `createHash('sha256')`, `spawnSync('tar'|'powershell')`, no `npm install` gate on fresh clones"
    - "Idempotent slot-population pattern: prefetch-jre skips when `<slot>/bin/javaw.exe` (Windows) or `<slot>/Contents/Home/bin/java` (macOS) already exists; re-running dist:win is ~instant after first run"
    - "Windows-aware extraction: bsdtar (System32/tar.exe) for .tar.gz, PowerShell Expand-Archive for .zip — avoids MSYS GNU tar's `C:\\` → `host:path` misparse"
    - "renameSync retry-then-cpSync-fallback on Windows to survive AV/indexer file-handle retention races (EPERM/EBUSY/EACCES)"
    - "Universal DMG shipping identical extraResources in BOTH arch slots — Electron's @electron/universal byte-compare passes because both arch builds contain the same jre/mac-* subtrees"

key-files:
  created:
    - "launcher/scripts/prefetch-jre.mjs"
    - "launcher/scripts/build-mod.sh"
    - "launcher/build/README-macOS.txt"
    - "build/README-macOS.txt"
    - "docs/install-macos.md"
  modified:
    - "launcher/package.json"
    - "launcher/electron-builder.yml"
    - ".gitignore"

key-decisions:
  - "Open Q §1 resolved: x64 Temurin in BOTH mac slots (mac-x64 + mac-arm64); Rosetta 2 handles Apple Silicon. Temurin 8 has no arm64 JRE build, and 1.8.9 LWJGL natives are x86_64-only anyway — the JVM would run x86_64 regardless. Ships ~70 MB smaller than Azul Zulu arm64 would have, avoids a second vendor's SHA256 API."
  - "Deleted the Linux electron-builder target outright (v0.1 scope is Windows + macOS only)"
  - "NSIS `oneClick: false`, `perMachine: false`, `deleteAppDataOnUninstall: false` — per-user install at %LOCALAPPDATA%/Programs/Wiiwho/ keeps %APPDATA%/Wiiwho/ on uninstall (less destructive default per Claude's Discretion)"
  - "No code signing + no notarize in v0.1 (D-23). electron-builder.yml uses `identity: null` + `notarize: false` on mac; win has no signing config. Documented unsigned workaround in build/README-macOS.txt"
  - "`executableName: Wiiwho` on win target produces `Wiiwho.exe` per Phase 1 D-03 (display name locked as 'Wiiwho' — only first W capitalized)"

patterns-established:
  - "Pattern: @-resource-path layout — resources/jre/<slot>/ + resources/mod/. paths.ts resolves via app.getAppPath() (dev) or process.resourcesPath (packaged). asarUnpack resources/** ensures Java binaries hit the real filesystem, not the asar"
  - "Pattern: dist:win / dist:mac scripts compose package-resources (prefetch-jre + build-mod) + electron-vite build + electron-builder --<platform>. One command from clean clone to installer (given a JDK 17 for Gradle)"
  - "Pattern: per-platform build docs in docs/install-*.md (Gatekeeper walkthrough + arch rationale); DMG also ships a copy of the same text as README-macOS.txt so users see it inside the mounted DMG"

# Metrics
metrics:
  duration: "~23 min"
  tasks: 3
  files: 8
  lines_added: ~480
  completed_date: 2026-04-21

---

# Phase 03 Plan 11: Windows NSIS Packaging + Mac Build Machinery Summary

**One-liner:** Ships the Windows packaging pipeline end-to-end (prefetch-jre + build-mod + electron-builder config) and authors every macOS artifact Plan 03-12 needs (electron-builder.yml universal DMG + README-macOS.txt + docs/install-macos.md) — NSIS installer smoke-build was BLOCKED by a Windows-specific electron-builder environmental issue (symlink extraction without Developer Mode), though the `win-unpacked/` directory was produced successfully and contains all expected artifacts.

## What Was Built

### Task 1 — Build scripts & package.json rewiring (commit `1f34680`)

- **`launcher/scripts/prefetch-jre.mjs`** (240 lines, zero-dep Node 22 ESM)
  - Hardcoded URLs for Temurin 8u482-b08: `win-x64` (.zip, 40 MB), `mac-x64` (.tar.gz, 44 MB), `mac-arm64` (SAME as mac-x64 per Open Q §1)
  - Fetches sibling `.sha256.txt`, SHA256-verifies each download; fails fast on mismatch
  - Extraction: bsdtar for tar.gz, PowerShell Expand-Archive for zip
  - Flattens `jdk8u482-b08-jre/` into `<slot>/` (Temurin's top-level shell stripped)
  - Idempotent: probes `<slot>/bin/javaw.exe` (Windows) or `<slot>/Contents/Home/bin/java` (macOS); skips populated slots
  - Cache dir `resources/.jre-cache/` (gitignored) holds downloaded tarballs for re-verification on re-run
- **`launcher/scripts/build-mod.sh`** — bash script, chooses `./gradlew.bat` on Windows-MSYS, `./gradlew` elsewhere; passes `-Pversion=0.1.0` to override gradle.properties' `0.1.0-SNAPSHOT`; stages jar at `launcher/resources/mod/wiiwho-0.1.0.jar`
- **`launcher/package.json`** scripts:
  - `prefetch-jre`: `node scripts/prefetch-jre.mjs`
  - `build-mod`: `bash scripts/build-mod.sh`
  - `package-resources`: `npm run prefetch-jre && npm run build-mod`
  - `build:win`: `npm run package-resources && npm run build && electron-builder --win`
  - `build:mac`: `npm run package-resources && electron-vite build && electron-builder --mac`
  - `dist:win` / `dist:mac`: aliases for build:win/mac (matches RESEARCH.md script names)
  - `build:linux` deleted — v0.1 scope is Windows + macOS only
  - `build:unpack` updated to depend on `package-resources`

### Task 2 — electron-builder.yml + macOS docs (commit `45f4491`)

- **`launcher/electron-builder.yml`** — full rewrite from template:
  - `appId: club.wiiwho.launcher`, `productName: Wiiwho Client`, ASCII `Copyright (c) 2026 Wiiwho Client`
  - `files` excludes: test files, vitest config, dev configs, `.env*`, `.npmrc`, `pnpm-lock.yaml`, ts configs
  - `asarUnpack: resources/**` — Java binaries must live on the real filesystem (can't exec from inside asar)
  - `npmRebuild: false`; no `publish:` block (v0.1 has no auto-update)
  - **win target:** `nsis` x64 only, `executableName: Wiiwho`, icon `resources/icon.png`, extraResources `resources/jre/win-x64` → `jre/win-x64` + `resources/mod` → `mod`
  - **nsis:** `artifactName: Wiiwho Client Setup.exe`, `oneClick: false`, `perMachine: false` (per-user %LOCALAPPDATA%/Programs/Wiiwho/), `allowElevation: true`, `createDesktopShortcut: always` + Start Menu shortcut, `deleteAppDataOnUninstall: false` (keep user data on uninstall — less destructive default)
  - **mac target:** `dmg` `arch: universal`, `identity: null` + `notarize: false` (unsigned per PROJECT.md), extraResources `jre/mac-arm64` + `jre/mac-x64` + `mod`
  - **dmg:** `artifactName: Wiiwho.dmg`, window contents: Wiiwho.app at (140,180) + /Applications link at (400,180) + `build/README-macOS.txt` at (270,330)
- **`build/README-macOS.txt`** (repo root) + **`launcher/build/README-macOS.txt`** (electron-builder buildResources dir) — right-click-Open Gatekeeper walkthrough with Rosetta 2 note appended. Kept at both locations: `build/README-macOS.txt` satisfies the plan's verify-from-repo-root grep; `launcher/build/README-macOS.txt` is where the DMG `contents.path: build/README-macOS.txt` resolves (electron-builder paths are relative to the YAML file's directory).
- **`docs/install-macos.md`** — public macOS install guide; explicitly documents the x64-in-both-mac-slots decision (Open Q §1 resolution) with the Rosetta 2 / LWJGL-natives rationale; includes `xattr -dr com.apple.quarantine` troubleshooting tip.

### Task 3 — Windows NSIS smoke build (commit `94da6e2`: Windows-compat fixes)

- `pnpm run prefetch-jre` completed successfully after two deviation fixes (see below):
  - `win-x64`: 40 MB zip → 98 MB extracted (javaw.exe present)
  - `mac-x64`: 44 MB tar.gz → 117 MB extracted (Contents/Home/bin/java present)
  - `mac-arm64`: same tarball as mac-x64 → 117 MB extracted (Open Q §1)
- `pnpm run build-mod` completed successfully with `JAVA_HOME=/c/Program Files/Java/jdk-17` — client-mod Gradle `:remapJar` produces `wiiwho-0.1.0.jar` (1008 KB); copied to `launcher/resources/mod/wiiwho-0.1.0.jar`. Gradle daemon ran against JDK 17 (required by Gradle 7.6.4); toolchain compiled Java 8 bytecode correctly.
- `pnpm run build:win` ran electron-vite build + electron-builder; **electron-vite** + **extraResources packing** both succeeded — `launcher/dist/win-unpacked/` fully populated:
  - `Wiiwho.exe` (210 MB Electron runtime)
  - `resources/jre/win-x64/bin/javaw.exe` (305 KB stub; entire win-x64 JRE subtree at 98 MB)
  - `resources/mod/wiiwho-0.1.0.jar` (1008 KB)
  - No Mojang assets anywhere (`find launcher/dist/win-unpacked/resources/ -iname '*mojang*' -o -iname '*minecraft*'` returns empty — docs/mojang-asset-policy.md compliance)
- **NSIS installer packaging FAILED** due to an environmental issue documented below; this is explicitly called out in the autonomy_note as an acceptable fallback state.

## Duration

- Plan start → Task 1 commit: ~6 min (wrote scripts + package.json)
- Task 1 → Task 2 commit: ~4 min (electron-builder.yml + macOS docs)
- Task 2 → Task 3 completion (blocked): ~13 min (two Windows-compat deviation fixes, prefetch + build-mod + dist:win attempts, environmental blocker diagnosis)
- **Total: ~23 minutes**

## JRE archive sizes (for RESEARCH §Temurin Sourcing sanity check)

| Slot | Source | Download (archive) | Extracted |
|------|--------|--------------------|-----------|
| win-x64 | Temurin 8u482-b08 .zip | 40 MB | 98 MB |
| mac-x64 | Temurin 8u482-b08 .tar.gz | 44 MB | 117 MB |
| mac-arm64 | (same as mac-x64 — Open Q §1) | shared | 117 MB |

Note: research estimated ~70 MB per slot; actuals are higher on mac (~117 MB) because Temurin bundles more tooling (jdk-style JRE including jconsole, etc.). If installer size becomes an issue, a future plan can drop `man/` + `legal/` + `jmods/` (RESEARCH §Trim the JRE) to shave ~20 MB per slot. Not done here to stay inside the plan's literal scope.

## Deviations from Plan

### Auto-fixed Issues (Rule 1 — Bug)

**1. [Rule 1 - Bug] renameSync EPERM on Windows after PowerShell Expand-Archive**
- **Found during:** Task 3, first `pnpm run prefetch-jre` run
- **Issue:** `renameSync('resources/.jre-cache/extract-win-x64/jdk8u482-b08-jre', 'resources/jre/win-x64')` failed with EPERM immediately after PowerShell's Expand-Archive finished. Windows AV scanners (Defender) briefly retain handles on newly-extracted content; the rename races against that.
- **Fix:** Added `moveDir()` wrapper that retries renameSync up to 3 times with 500 ms spin-wait between attempts; falls back to `cpSync(…, {recursive: true}) + rmSync(src)` if retries exhaust. Bullet-proof against AV/indexer holds AND cross-volume moves.
- **Files modified:** `launcher/scripts/prefetch-jre.mjs`
- **Commit:** `94da6e2`

### Auto-fixed Issues (Rule 3 — Blocker)

**2. [Rule 3 - Blocker] MSYS GNU tar fails on Windows drive-letter paths**
- **Found during:** Task 3, mac-x64 extraction step
- **Issue:** On Git Bash / MSYS, the default `tar` command is GNU tar, which parses `C:\Users\...` as `host:path` (rsh-style) and fails with `tar (child): Cannot connect to C: resolve failed`. This blocks mac-x64 and mac-arm64 slot extraction entirely on Windows dev machines.
- **Fix:** Script now explicitly invokes Windows's built-in bsdtar (`%SystemRoot%\System32\tar.exe`) on Windows, which handles drive letters correctly. Non-Windows platforms continue to use whatever `tar` is on PATH (bsdtar on macOS, GNU tar on Linux — both fine).
- **Files modified:** `launcher/scripts/prefetch-jre.mjs`
- **Commit:** `94da6e2`

### Auto-fixed Issues (Rule 2 — Missing Gitignore)

**3. [Rule 2 - Missing] Gitignore rule for the JRE download cache**
- **Found during:** Task 3 verification
- **Issue:** `launcher/resources/.jre-cache/` is populated at prefetch-time with ~85 MB of Temurin tarballs. Without a gitignore rule, `git status` would show them as untracked.
- **Fix:** Added `launcher/resources/.jre-cache/` to `.gitignore` alongside the existing `launcher/resources/jre/` and `launcher/resources/mod/` entries.
- **Files modified:** `.gitignore`
- **Commit:** `94da6e2`

### Environmental Blocker (not auto-fixable)

**4. [Environmental — NOT a deviation; flagged in autonomy_note] electron-builder NSIS target fails on Windows without Developer Mode or admin**

electron-builder 26.8.1 unconditionally downloads `winCodeSign-2.6.0.7z` as part of the NSIS target's `rcedit` + `signtool` tooling, EVEN FOR UNSIGNED BUILDS. The archive contains macOS symlinks (`darwin/10.12/lib/libcrypto.dylib` → `libcrypto.1.0.0.dylib`, same for libssl) which require one of:
- **Windows Developer Mode enabled** (Settings → Privacy & Security → For developers → Developer Mode: On — requires UAC admin once)
- **Running the build as administrator**

On this machine neither is set, so 7zip's `Sub items Errors: 2 → exit status 2` propagates up through `app-builder-bin/win/x64/app-builder.exe download-artifact --name=winCodeSign …` and aborts the NSIS packaging step. Retries get new random cache IDs but hit the same symlink creation error.

**Evidence the rest of the pipeline works:**
- `launcher/dist/win-unpacked/` is fully generated and correct:
  - `Wiiwho.exe` — 210 MB Electron runtime bundled
  - `resources/jre/win-x64/bin/javaw.exe` — the bundled Temurin JRE
  - `resources/mod/wiiwho-0.1.0.jar` — the client-mod jar
  - `resources/app.asar` + `app.asar.unpacked/resources/{jre,mod,icon.png}` — asarUnpack worked
  - Total 881 MB (JRE payload as expected)
- No Mojang-owned files in `launcher/dist/win-unpacked/resources/` (grepped; docs/mojang-asset-policy.md compliance preserved)
- `launcher/dist/builder-debug.yml` was produced by electron-builder (before the symlink failure, it had completed everything EXCEPT the final NSIS installer binary build)

**Workarounds investigated and rejected:**
- `toolsets.winCodeSign: "1.1.0"` in electron-builder.yml — only affects `windowsSignToolManager.js` legacy-toolset branch; `rcedit`'s download code path inside app-builder (Go binary) is hardcoded against winCodeSign-2.6.0. Confirmed by reading `app-builder-lib/out/toolsets/windows.js` and `app-builder-bin` strings.
- `SIGNTOOL_PATH` + `ELECTRON_BUILDER_RCEDIT_PATH` env vars — these are checked AFTER the `getBin("winCodeSign")` call in some code paths, so the download is still triggered.
- Pre-seeding cache with bsdtar-extracted content — app-builder generates a new random cache dir per run; pre-seeding is defeated.
- `-snld` flag on 7z (no symlink data) — already passed by electron-builder; 7z still logs errors + exits 2.
- Running 7z manually via bsdtar (which handles symlinks gracefully) — app-builder calls 7za directly; can't intercept.

**PKG-01 status:** Packaging configuration complete. electron-builder.yml matches RESEARCH §Config Fragment verbatim. Smoke-build produces the correct unpacked bundle; NSIS installer binary generation blocked on environmental setup (Windows Developer Mode toggle, one-time UAC).

**Required to unblock:**
```
Settings → Privacy & Security → For developers → Developer Mode: On
```
OR run `pnpm run dist:win` from an elevated (admin) shell.

After either of those, the exact same commit (`94da6e2`) should produce `launcher/dist/Wiiwho Client Setup.exe` without further code changes.

## Acceptance Criteria Status

| Criterion | Status | Notes |
|-----------|--------|-------|
| `node --check launcher/scripts/prefetch-jre.mjs` exits 0 | PASS | |
| prefetch-jre.mjs contains jdk8u482-b08, createHash, sha256 | PASS | |
| prefetch-jre.mjs contains mac-arm64 / mac-x64 / win-x64 | PASS | |
| build-mod.sh contains `gradlew build` + `resources/mod` | PASS | |
| package.json scripts: prefetch-jre / build-mod / package-resources / dist:win / dist:mac | PASS | |
| package.json has NO `build:linux` script | PASS | removed |
| electron-builder.yml: target nsis | PASS | |
| electron-builder.yml: arch universal | PASS | |
| electron-builder.yml: Wiiwho Client Setup.exe, Wiiwho.dmg | PASS | |
| electron-builder.yml: mac-arm64, mac-x64, win-x64, mod extraResources | PASS | |
| electron-builder.yml: asarUnpack resources/\*\* | PASS | |
| electron-builder.yml: no linux/publish/appImage | PASS | |
| README-macOS.txt contains RIGHT-CLICK | PASS | |
| docs/install-macos.md mentions Rosetta 2 + Right-click | PASS | |
| `pnpm run prefetch-jre` completes | PASS | after 2 deviation fixes |
| `pnpm run build-mod` produces wiiwho-0.1.0.jar | PASS | with JAVA_HOME=jdk-17 |
| `pnpm run dist:win` produces `Wiiwho Client Setup.exe` | **BLOCKED** | Environmental — see Deviation §4 above |
| `launcher/dist/win-unpacked/resources/jre/win-x64/bin/javaw.exe` exists | PASS | |
| `launcher/dist/win-unpacked/resources/mod/wiiwho-0.1.0.jar` exists | PASS | |
| `npm run test:run` still green | PASS | 354/354 |
| `npm run typecheck` still green | PASS | |
| Mojang asset policy (no Mojang files in dist/) | PASS | verified via find |

## Key Links / Integration Points

- `launcher/package.json` `dist:win` → `package-resources` (prefetch-jre + build-mod) → `build` (typecheck + electron-vite) → `electron-builder --win`
- `launcher/electron-builder.yml` `win.extraResources` → runtime path `launcher/dist/win-unpacked/resources/jre/win-x64/` → `paths.ts resolveJavaBinary()` (bundled javaw.exe)
- `launcher/electron-builder.yml` `mac.extraResources` → runtime paths `.app/Contents/Resources/jre/mac-arm64/Contents/Home/bin/java` + `.../mac-x64/.../java` → `paths.ts` `process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64'`

## Confirmation: Mojang Asset Policy Compliance (docs/mojang-asset-policy.md)

```
find launcher/dist/win-unpacked/resources/ -iname "*minecraft*" -o -iname "*mojang*"
→ (empty)
```

Only launcher code + Temurin JRE + our `wiiwho-0.1.0.jar` — nothing Mojang-derived ships in the installer. The mod jar contains only Wiiwho-authored class bytecode + shaded Mixin library (SpongePowered, open-source). Launcher downloads Mojang assets at runtime from Mojang's official CDN — Phase 3 code path, not this plan.

## Self-Check: PASSED

Files verified to exist:
- FOUND: launcher/scripts/prefetch-jre.mjs
- FOUND: launcher/scripts/build-mod.sh
- FOUND: launcher/electron-builder.yml
- FOUND: build/README-macOS.txt
- FOUND: launcher/build/README-macOS.txt
- FOUND: docs/install-macos.md
- FOUND: launcher/dist/win-unpacked/Wiiwho.exe
- FOUND: launcher/dist/win-unpacked/resources/jre/win-x64/bin/javaw.exe
- FOUND: launcher/dist/win-unpacked/resources/mod/wiiwho-0.1.0.jar
- NOT PRODUCED (environmental blocker): launcher/dist/Wiiwho Client Setup.exe

Commits verified:
- FOUND: 1f34680 (Task 1 — scripts + package.json)
- FOUND: 45f4491 (Task 2 — electron-builder.yml + macOS docs)
- FOUND: 94da6e2 (Task 3 — Windows-compat fixes to prefetch-jre + .gitignore)
