# Handoff — NSIS long-path blocker on `dist:win`

**Status:** `pnpm --filter ./launcher run dist:win` builds successfully through typecheck, vite, signing, and winCodeSign. Fails at the final NSIS installer step with `!include: could not open file`. Every earlier step of the pipeline works.

**Confirmed working:**
- `launcher/dist/win-unpacked/Wiiwho.exe` — fully packaged launcher with bundled JRE + mod jar, runnable by double-click
- 354/354 vitest tests green
- Typecheck clean (node + web)
- winCodeSign + signtool all succeed (Developer Mode is on, symlinks fine)
- JRE in `resources/jre/win-x64/bin/javaw.exe` + mod jar in `resources/mod/wiiwho-0.1.0.jar` all on disk

**Failing step only:** NSIS installer wrapper `Wiiwho Client Setup.exe`.

---

## Exact error

```
⨯ makensis.exe process failed ERR_ELECTRON_BUILDER_CANNOT_EXECUTE
Exit code: 1

Error output:
!include: could not open file: "C:\Users\Eliyahu\Desktop\Everything\code\wiiwho-client\node_modules\.pnpm\app-builder-lib@26.8.1_dmg-builder@26.8.1_electron-builder-squirrel-windows@26.8.1_dmg-builde_24uv3nwg37v6agkno6ngdxz5l4\node_modules\app-builder-lib\templates\nsis\include\allowOnlyOneInstallerInstance.nsh"
Error in script "<stdin>" on line 88 -- aborting creation process
```

That path is **280 characters** (over Windows's 260 MAX_PATH limit).

---

## Why each attempted fix failed

| Attempt | Outcome | Why |
|---|---|---|
| Enable Developer Mode (Settings UI) | Fixed winCodeSign symlink extraction (separate earlier blocker) | Doesn't affect makensis's path handling |
| `.npmrc` with `node-linker=hoisted` | Broke electron-builder's `install-app-deps` postinstall (electron ended up at repo-root `node_modules` instead of `launcher/node_modules`) | pnpm hoisted layout + pnpm workspaces is incompatible with electron-builder's assumption that deps live in the project's own `node_modules` |
| `.npmrc` with `virtual-store-dir-max-length=50` | Setting silently ignored — paths unchanged | pnpm 9.0.0 predates the setting (needs 9.5+) |
| Upgrade pnpm to 10.33.0 via `npm install -g pnpm@latest` | Paths STILL unchanged after reinstall | Lockfile was reused ("Lockfile is up to date, resolution step is skipped") — pnpm didn't re-resolve, so `.pnpm/` dir names kept their long form |
| Enable Windows Long Paths registry (`LongPathsEnabled=1`) + reboot | No effect on makensis | Windows Long Paths requires the **application** to declare long-path awareness in its manifest. `makensis.exe` from NSIS 3.0.4 (what electron-builder bundles) is a legacy binary without that manifest, so the registry flag doesn't apply to it. |

---

## Known-working fix paths (none tried yet)

### Option 1 — Shorten repo base path (quickest, highest success probability)

Move the repo from `C:\Users\Eliyahu\Desktop\Everything\code\wiiwho-client\` (51 chars) to `C:\dev\wiiwho-client\` (20 chars). Saves 31 chars. The failing path drops from 280 to ~249 — under 260.

Steps:
```powershell
# Close VSCode first
Move-Item "C:\Users\Eliyahu\Desktop\Everything\code\wiiwho-client" "C:\dev\wiiwho-client"
# Reopen in VSCode from the new path
cd C:\dev\wiiwho-client
Remove-Item -Recurse -Force node_modules, launcher\node_modules, client-mod\node_modules -ErrorAction SilentlyContinue
pnpm install
pnpm --filter ./launcher run dist:win
```

Risk: VSCode's workspace state, Git's `.git/config` absolute-path remotes, any tool caching absolute paths. Generally safe for this project.

### Option 2 — Force pnpm to re-resolve with `virtual-store-dir-max-length`

The `.npmrc` at repo root has `virtual-store-dir-max-length=50`, but pnpm didn't apply it because the lockfile was reused. Force regeneration:

```powershell
Remove-Item pnpm-lock.yaml
Remove-Item -Recurse -Force node_modules, launcher\node_modules, client-mod\node_modules -ErrorAction SilentlyContinue
pnpm install
pnpm --filter ./launcher run dist:win
```

Risk: Fresh lockfile may pull different minor/patch versions than the committed one. Verify test suite still green after.

### Option 3 — Pre-extract NSIS includes to a short path

Hack, but works. Copy the `app-builder-lib/templates/nsis/include/` tree from the deeply-nested pnpm store into a short path, and set `NSISDIR` or patch the include resolution. Not recommended — brittle across reinstalls.

### Option 4 — Use `oneClick: true` in electron-builder.yml

`oneClick: true` uses a different NSIS template that has fewer `!include` directives and may avoid the specific file that's failing. Currently set to `oneClick: false` in `launcher/electron-builder.yml` because we want an install-directory picker. Losing that in exchange for a working build may be acceptable for v0.1.

### Option 5 — Skip NSIS entirely, ship win-unpacked as a ZIP

Change target in `launcher/electron-builder.yml` from `nsis` to `portable` or `zip`. Users get a `Wiiwho-win-x64.zip` instead of `Wiiwho Client Setup.exe`. Unzip + run. Less polished but unblocks shipping.

---

## Relevant file paths

- `launcher/electron-builder.yml` — NSIS config (`oneClick: false`, `perMachine: false`, `artifactName: Wiiwho Client Setup.exe`)
- `launcher/scripts/prefetch-jre.mjs` — downloads Temurin 8u482
- `launcher/scripts/build-mod.sh` — gradle wrapper for client-mod (already skip-cached)
- `.npmrc` at repo root — currently has `virtual-store-dir-max-length=50` (ignored until lockfile regenerates)
- `launcher/dist/win-unpacked/` — fully functional unpacked build (can run Wiiwho.exe directly)

## Environment

- Windows 11 Home 10.0.26200
- Developer Mode: On
- Registry `HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled`: 1 (set this session, rebooted)
- pnpm 10.33.0 (upgraded)
- Node 22.x
- Current repo path: `C:\Users\Eliyahu\Desktop\Everything\code\wiiwho-client\` (51 chars)

## Git state

All fixes committed. 100+ commits ahead of `origin/master` pushed (confirmed earlier in session). Most recent commits:
- `93012cb` fix(build): skip build-mod when a fresh jar is already staged
- `1152cc4` fix(build): heal CRLF-corrupted gradlew on Windows clones
- `5918cd6` docs(03): commit remaining plan specs + validation updates

## Recommended next move for fresh chat

Try Option 1 (move repo to `C:\dev\wiiwho-client\`) first — highest success probability, no risky dep changes. If that fails, Option 2. If both fail, accept Option 5 (ZIP target) as a v0.1-acceptable fallback.
