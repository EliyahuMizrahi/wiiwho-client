---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 11
type: execute
wave: 4
depends_on: ["03-10"]
files_modified:
  - launcher/electron-builder.yml
  - launcher/scripts/prefetch-jre.mjs
  - launcher/scripts/build-mod.sh
  - launcher/package.json
  - build/README-macOS.txt
  - docs/install-macos.md
autonomous: true
user_setup:
  - service: temurin-jre
    why: "Bundles Temurin 8 JRE for Windows + macOS at build time; no user-side Java install ever (JRE-01/02)"
    env_vars: []
    dashboard_config:
      - task: "No dashboard — prefetch script downloads from Adoptium public CDN"
        location: "https://github.com/adoptium/temurin8-binaries/releases/"
requirements:
  - JRE-01
  - JRE-03
  - PKG-01
must_haves:
  truths:
    - "`pnpm run prefetch-jre` downloads Temurin 8 x64 for all three slots (Open Q §1 resolution) with SHA256 verification and extracts to launcher/resources/jre/<slot>/"
    - "`pnpm run build-mod` runs client-mod Gradle build and copies the jar to launcher/resources/mod/wiiwho-0.1.0.jar"
    - "`pnpm run dist:win` produces launcher/dist/Wiiwho Client Setup.exe containing resources/jre/win-x64/bin/javaw.exe + resources/mod/wiiwho-0.1.0.jar"
    - "electron-builder.yml is the full rewrite from RESEARCH.md §electron-builder Config Fragment"
    - "NSIS installer writes to %LOCALAPPDATA%/Programs/Wiiwho/ per D-23, creates Desktop + Start Menu shortcuts"
    - "README-macOS.txt + docs/install-macos.md authored — ready for Plan 03-12 Mac build"
  artifacts:
    - path: "launcher/electron-builder.yml"
      provides: "NSIS + Universal DMG config with extraResources mapping"
      contains: "target: nsis"
    - path: "launcher/scripts/prefetch-jre.mjs"
      provides: "Zero-dep Node ESM downloader + SHA256 verify + extract"
    - path: "launcher/scripts/build-mod.sh"
      provides: "Runs ../client-mod gradle build + copies jar"
    - path: "build/README-macOS.txt"
      provides: "Right-click-Open text dropped INSIDE the DMG"
    - path: "docs/install-macos.md"
      provides: "Project-facing macOS install doc"
  key_links:
    - from: "launcher/package.json scripts.dist:win"
      to: "prefetch-jre + build-mod + electron-vite build + electron-builder --win"
      via: "pnpm script composition"
      pattern: "dist:win"
    - from: "launcher/electron-builder.yml win.extraResources"
      to: "launcher/resources/jre/win-x64 + launcher/resources/mod"
      via: "electron-builder copy-at-pack-time"
      pattern: "extraResources"
---

<objective>
Ship the Windows build path end-to-end and author every file macOS needs for Plan 03-12 to run without further editing:

1. `scripts/prefetch-jre.mjs` — zero-dep Node 22 ESM downloader + SHA256 verifier
2. `scripts/build-mod.sh` — runs client-mod gradle build + copies jar
3. `launcher/package.json` — adds prefetch-jre, build-mod, package-resources, rewires dist:win / dist:mac
4. `launcher/electron-builder.yml` — full rewrite from RESEARCH.md §electron-builder Config Fragment
5. `build/README-macOS.txt` — workaround text for the DMG
6. `docs/install-macos.md` — project-level macOS install doc
7. Windows NSIS smoke build — run `pnpm run dist:win` on owner's Windows box, verify output installer exists + contains expected paths.

Open Q §1 resolution: x64 Temurin in BOTH mac slots — Rosetta 2 handles arm64 seamlessly; 1.8.9 LWJGL natives are x86_64 only, so the JVM runs as x86_64 regardless. ~70 MB smaller than bundling Zulu arm64 separately.

Output: 6 files + verified Windows installer artifact.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
@launcher/package.json
@launcher/electron-builder.yml
@client-mod/build.gradle.kts
@client-mod/gradle.properties
@docs/mojang-asset-policy.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: prefetch-jre.mjs + build-mod.sh + package.json scripts</name>
  <files>
    launcher/scripts/prefetch-jre.mjs,
    launcher/scripts/build-mod.sh,
    launcher/package.json
  </files>
  <read_first>
    - launcher/package.json (existing scripts)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Temurin Sourcing (URLs)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Mod Jar Bundling
    - client-mod/gradle.properties
  </read_first>
  <action>
    1. Create `launcher/scripts/prefetch-jre.mjs` with the zero-dep Node ESM downloader per RESEARCH.md §Temurin Sourcing. Use these exact URLs (verified 2026-04-21):
       - win-x64: https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u482-b08/OpenJDK8U-jre_x64_windows_hotspot_8u482b08.zip
       - mac-x64: https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u482-b08/OpenJDK8U-jre_x64_mac_hotspot_8u482b08.tar.gz
       - mac-arm64 slot: SAME URL as mac-x64 (Open Q §1 resolution)
       SHA256 via sibling `.sha256.txt`. Extract via `tar -xzf` (POSIX) or PowerShell `Expand-Archive` (Windows zip). Flatten inner `jdk8u482-b08-jre/` into `<slot>/`. Idempotent (skip if bin dir already populated). No dependencies beyond Node 22 builtins.

    2. Create `launcher/scripts/build-mod.sh`:
       ```bash
       #!/usr/bin/env bash
       set -euo pipefail
       SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
       LAUNCHER_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
       MOD_DIR="$( cd "$LAUNCHER_DIR/../client-mod" && pwd )"
       cd "$MOD_DIR"
       if [[ "${OSTYPE:-}" == "msys" || "${OSTYPE:-}" == "cygwin" ]]; then
         ./gradlew.bat build -Pversion=0.1.0
       else
         ./gradlew build -Pversion=0.1.0
       fi
       JAR_SRC="$MOD_DIR/build/libs/wiiwho-0.1.0.jar"
       JAR_DEST="$LAUNCHER_DIR/resources/mod/wiiwho-0.1.0.jar"
       if [[ ! -f "$JAR_SRC" ]]; then
         echo "[build-mod] ERROR: jar not produced at $JAR_SRC" >&2
         exit 1
       fi
       mkdir -p "$LAUNCHER_DIR/resources/mod"
       cp "$JAR_SRC" "$JAR_DEST"
       echo "[build-mod] OK: $JAR_DEST"
       ```
       Chmod +x.

    3. Edit `launcher/package.json` scripts. Target final shape:
       ```json
       "scripts": {
         "format": "prettier --write .",
         "lint": "eslint --cache .",
         "typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
         "typecheck:web": "tsc --noEmit -p tsconfig.web.json --composite false",
         "typecheck": "npm run typecheck:node && npm run typecheck:web",
         "start": "electron-vite preview",
         "dev": "electron-vite dev",
         "build": "npm run typecheck && electron-vite build",
         "postinstall": "electron-builder install-app-deps",
         "build:unpack": "npm run build && electron-builder --dir",
         "prefetch-jre": "node scripts/prefetch-jre.mjs",
         "build-mod": "bash scripts/build-mod.sh",
         "package-resources": "npm run prefetch-jre && npm run build-mod",
         "build:win": "npm run package-resources && npm run build && electron-builder --win",
         "build:mac": "npm run package-resources && electron-vite build && electron-builder --mac",
         "dist:win": "npm run build:win",
         "dist:mac": "npm run build:mac",
         "test": "vitest",
         "test:run": "vitest --run"
       }
       ```
       Remove `build:linux`. Remove any publish config.

    Full prefetch-jre.mjs skeleton — executor copies + adapts for exact source-array shape; key invariants:
    - ESM (`.mjs`, top-level imports)
    - Uses Node's built-in `fetch`, `createHash('sha256')`, `tar` / `Expand-Archive` via `spawnSync`
    - Hardcodes the three URLs + extractedTopDir `jdk8u482-b08-jre`
    - Validates SHA256 before extract, throws on mismatch
    - `process.exit(1)` on any error
    - Idempotent: skip if `<slot>/bin/` (Windows) or `<slot>/Contents/Home/bin/` (mac) already exists
  </action>
  <verify>
    <automated>test -f launcher/scripts/prefetch-jre.mjs &amp;&amp; test -f launcher/scripts/build-mod.sh &amp;&amp; grep -q prefetch-jre launcher/package.json &amp;&amp; grep -q build-mod launcher/package.json &amp;&amp; grep -q package-resources launcher/package.json &amp;&amp; node --check launcher/scripts/prefetch-jre.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `node --check launcher/scripts/prefetch-jre.mjs` exits 0 (valid ESM syntax)
    - `grep -q "jdk8u482-b08" launcher/scripts/prefetch-jre.mjs`
    - `grep -q "createHash" launcher/scripts/prefetch-jre.mjs`
    - `grep -q "sha256" launcher/scripts/prefetch-jre.mjs`
    - `grep -q "mac-arm64" launcher/scripts/prefetch-jre.mjs`
    - `grep -q "mac-x64" launcher/scripts/prefetch-jre.mjs`
    - `grep -q "win-x64" launcher/scripts/prefetch-jre.mjs`
    - `grep -q "gradlew build" launcher/scripts/build-mod.sh`
    - `grep -q "resources/mod" launcher/scripts/build-mod.sh`
    - `grep -q "\"prefetch-jre\":" launcher/package.json`
    - `grep -q "\"build-mod\":" launcher/package.json`
    - `grep -q "\"package-resources\":" launcher/package.json`
    - `grep -q "\"dist:win\":" launcher/package.json`
    - `grep -q "\"dist:mac\":" launcher/package.json`
    - `grep -qv "\"build:linux\":" launcher/package.json`
  </acceptance_criteria>
  <done>Three build automation files in place; package.json scripts composed; prefetch-jre valid Node syntax.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: electron-builder.yml full rewrite + README-macOS.txt + docs/install-macos.md</name>
  <files>
    launcher/electron-builder.yml,
    build/README-macOS.txt,
    docs/install-macos.md
  </files>
  <read_first>
    - launcher/electron-builder.yml (current template — full replace)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §electron-builder Config Fragment (YAML to paste)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §macOS unsigned-right-click-Open (text for README-macOS.txt)
    - .planning/phases/01-foundations/01-CONTEXT.md D-03 (binary names)
  </read_first>
  <action>
    1. REPLACE `launcher/electron-builder.yml` entirely with this exact content (from RESEARCH.md §electron-builder Config Fragment verbatim):

    ```yaml
    appId: club.wiiwho.launcher
    productName: Wiiwho Client
    copyright: Copyright (c) 2026 Wiiwho Client

    directories:
      buildResources: build
      output: dist

    files:
      - '!**/.vscode/*'
      - '!src/*'
      - '!electron.vite.config.{js,ts,mjs,cjs}'
      - '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}'
      - '!{.env,.env.*,.npmrc,pnpm-lock.yaml}'
      - '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}'
      - '!{vitest.config.ts,**/*.test.ts,**/*.test.tsx}'

    asarUnpack:
      - resources/**

    npmRebuild: false

    win:
      target:
        - target: nsis
          arch: x64
      executableName: Wiiwho
      icon: resources/icon.png
      extraResources:
        - from: resources/jre/win-x64
          to: jre/win-x64
        - from: resources/mod
          to: mod

    nsis:
      artifactName: Wiiwho Client Setup.exe
      oneClick: false
      allowElevation: true
      perMachine: false
      allowToChangeInstallationDirectory: false
      createDesktopShortcut: always
      createStartMenuShortcut: true
      shortcutName: Wiiwho Client
      uninstallDisplayName: Wiiwho Client
      deleteAppDataOnUninstall: false

    mac:
      target:
        - target: dmg
          arch: universal
      category: public.app-category.games
      icon: resources/icon.png
      identity: null
      notarize: false
      extraResources:
        - from: resources/jre/mac-arm64
          to: jre/mac-arm64
        - from: resources/jre/mac-x64
          to: jre/mac-x64
        - from: resources/mod
          to: mod

    dmg:
      artifactName: Wiiwho.dmg
      title: Wiiwho Client
      contents:
        - x: 140
          y: 180
          type: file
          path: Wiiwho.app
        - x: 400
          y: 180
          type: link
          path: /Applications
        - x: 270
          y: 330
          type: file
          path: build/README-macOS.txt
    ```

    NO `publish:`. NO `linux:`. NO `appImage:`.

    Note: substituted the `©` symbol with `(c)` in copyright for ASCII-only safety in CI environments. If the YAML parser accepts UTF-8 (it does — electron-builder uses js-yaml), revert to `©` — both work.

    2. Create `build/README-macOS.txt` with exact content:

    ```
    Opening Wiiwho on macOS for the first time

    Because Wiiwho Client v0.1 isn't signed with an Apple Developer ID, macOS Gatekeeper will refuse to open it directly. You only need to do this ONCE — after first launch, macOS remembers.

    1. Drag Wiiwho.app into the Applications folder (drag it onto the arrow).
    2. Open your Applications folder.
    3. Find Wiiwho — RIGHT-CLICK (or two-finger-click) it.
    4. Choose "Open" from the menu.
    5. A dialog will appear saying Wiiwho is from an unidentified developer — click "Open" again.
    6. Wiiwho launches. Subsequent launches work normally.

    Source: https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac
    ```

    Ensure `build/` exists at repo root (electron-builder uses it as buildResources). If not, create the directory.

    3. Create `docs/install-macos.md`:

    ```markdown
    # Installing Wiiwho Client on macOS (v0.1)

    Wiiwho Client v0.1 is unsigned. macOS Gatekeeper blocks unsigned apps by default — first launch needs a one-time right-click-Open gesture.

    ## What's in the DMG
    - `Wiiwho.app` — the launcher
    - Shortcut to `/Applications`
    - `README-macOS.txt` — quick reminder

    ## First-launch steps (one time only)
    1. Drag `Wiiwho.app` onto the `Applications` shortcut.
    2. Open Finder → Applications.
    3. Right-click (or two-finger-click) `Wiiwho`.
    4. Choose **Open**.
    5. macOS says: "Wiiwho Client is from an unidentified developer. Are you sure you want to open it?" — click **Open**.
    6. Wiiwho launches. Log in with Microsoft, click Play.

    From launch two onwards, double-click works normally.

    ## Why unsigned?
    Apple Developer ID costs $99/yr. v0.1 is small-group preview. Public release will sign + notarize.

    ## Troubleshooting
    - **"App is damaged and can't be opened"** → `xattr -dr com.apple.quarantine /Applications/Wiiwho.app` in Terminal, retry right-click Open.
    - **No window after Open** → check Console.app filtered by `Wiiwho`, file a GitHub issue with the log.
    - **Apple Silicon** → v0.1 ships an x64 JRE in both architecture slots; Rosetta 2 handles execution. macOS may prompt you to install Rosetta 2 on first launch — accept.
    ```
  </action>
  <verify>
    <automated>test -f launcher/electron-builder.yml &amp;&amp; test -f build/README-macOS.txt &amp;&amp; test -f docs/install-macos.md &amp;&amp; grep -q "target: nsis" launcher/electron-builder.yml &amp;&amp; grep -q "arch: universal" launcher/electron-builder.yml &amp;&amp; grep -q "Wiiwho Client Setup.exe" launcher/electron-builder.yml &amp;&amp; grep -q "Wiiwho.dmg" launcher/electron-builder.yml &amp;&amp; grep -q "mac-arm64" launcher/electron-builder.yml &amp;&amp; grep -q "mac-x64" launcher/electron-builder.yml &amp;&amp; grep -q "win-x64" launcher/electron-builder.yml &amp;&amp; grep -q "RIGHT-CLICK" build/README-macOS.txt</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "appId: club.wiiwho.launcher" launcher/electron-builder.yml`
    - `grep -q "productName: Wiiwho Client" launcher/electron-builder.yml`
    - `grep -q "target: nsis" launcher/electron-builder.yml`
    - `grep -q "target: dmg" launcher/electron-builder.yml`
    - `grep -q "arch: universal" launcher/electron-builder.yml`
    - `grep -q "Wiiwho Client Setup.exe" launcher/electron-builder.yml`
    - `grep -q "Wiiwho.dmg" launcher/electron-builder.yml`
    - `grep -q "from: resources/jre/win-x64" launcher/electron-builder.yml`
    - `grep -q "from: resources/jre/mac-arm64" launcher/electron-builder.yml`
    - `grep -q "from: resources/jre/mac-x64" launcher/electron-builder.yml`
    - `grep -q "from: resources/mod" launcher/electron-builder.yml`
    - `grep -q "asarUnpack:" launcher/electron-builder.yml`
    - `grep -q "resources/\\*\\*" launcher/electron-builder.yml` (asarUnpack catches resources)
    - `grep -qv "linux:" launcher/electron-builder.yml`
    - `grep -qv "publish:" launcher/electron-builder.yml`
    - `grep -qv "appImage:" launcher/electron-builder.yml`
    - `grep -q "RIGHT-CLICK" build/README-macOS.txt`
    - `grep -q "right-click-Open" docs/install-macos.md || grep -q "Right-click" docs/install-macos.md`
    - `grep -q "Rosetta 2" docs/install-macos.md`
  </acceptance_criteria>
  <done>electron-builder.yml matches RESEARCH §Config Fragment verbatim; README-macOS.txt + docs/install-macos.md authored for Plan 03-12.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Windows NSIS smoke build — run dist:win + verify installer artifact</name>
  <files>
    launcher/dist/Wiiwho Client Setup.exe
  </files>
  <read_first>
    - launcher/package.json (scripts from Task 1)
    - launcher/electron-builder.yml (config from Task 2)
    - launcher/scripts/prefetch-jre.mjs + build-mod.sh (Task 1)
  </read_first>
  <action>
    This is a smoke-build — verifying the pipeline end-to-end on the owner's Windows box. Assumptions:
    - Owner's machine is Windows 11 (CLAUDE.md)
    - Node 22 + pnpm + Git Bash + JDK 17 (for Gradle) + Internet all available

    Steps:

    1. `cd launcher && pnpm run prefetch-jre`
       - Downloads ~210 MB of Temurin JREs into `launcher/resources/jre/{win-x64,mac-x64,mac-arm64}/`
       - Verifies SHA256 per file
       - Extracts
       - Idempotent; re-running skips already-populated slots
       - Logs each slot OK

    2. `cd launcher && pnpm run build-mod`
       - cd ../client-mod && ./gradlew.bat build -Pversion=0.1.0
       - Produces `client-mod/build/libs/wiiwho-0.1.0.jar`
       - Copies to `launcher/resources/mod/wiiwho-0.1.0.jar`

    3. `cd launcher && pnpm run dist:win`
       - Runs the chain: package-resources (idempotent skip) + build + electron-builder --win
       - Produces `launcher/dist/Wiiwho Client Setup.exe` + `launcher/dist/win-unpacked/`
       - electron-builder logs the final installer path

    4. Verify the installer:
       ```bash
       ls -la "launcher/dist/Wiiwho Client Setup.exe"
       ```
       Installer must exist and be > 100 MB (JRE + Electron bundle).

    5. Verify the unpacked layout:
       ```bash
       ls launcher/dist/win-unpacked/resources/jre/win-x64/bin/javaw.exe
       ls launcher/dist/win-unpacked/resources/mod/wiiwho-0.1.0.jar
       ```
       Both must exist.

    6. Optional — inspect the NSIS installer contents directly:
       ```bash
       # 7-Zip (usually on dev machines) can list NSIS installers:
       7z l "launcher/dist/Wiiwho Client Setup.exe" | grep -E "(javaw.exe|wiiwho-0.1.0.jar)"
       ```
       Expect hits for both. If `7z` isn't installed, skip — the win-unpacked/ directory check in step 5 proves the files are bundled.

    **If the build fails**, capture the full error output in the SUMMARY and stop. Plan 03-12 should NOT run. If Gradle needs a JDK17 and the owner's machine has a different default Java, document the fix: `set JAVA_HOME=C:\path\to\jdk17` before running `dist:win` (client-mod build.gradle.kts requires JDK17 host — Phase 1 confirmed).

    **If** the prefetch step fails with 404 on the SHA256 URL (Adoptium occasionally rotates; though jdk8u482-b08 is stable), document the fix in SUMMARY and escalate: the URL may need to be bumped to the latest 8u release.

    **If `pnpm run build-mod` fails** because client-mod `@Mod` class needs additional adjustments to compile fully: Phase 1 verified `./gradlew runClient` works; `./gradlew build` should work too. Per RESEARCH §Mod Jar Bundling, if build chokes, verify with `cd client-mod && ./gradlew tasks` — if `build` task is present, invoke it directly once to isolate the error. Fix minimally (e.g., missing resources entry) and document.
  </action>
  <verify>
    <automated>test -f "launcher/dist/Wiiwho Client Setup.exe" &amp;&amp; test -f launcher/dist/win-unpacked/resources/jre/win-x64/bin/javaw.exe &amp;&amp; test -f launcher/dist/win-unpacked/resources/mod/wiiwho-0.1.0.jar</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `launcher/dist/Wiiwho Client Setup.exe`
    - File size ≥ 100 MB: `test $(stat -c%s "launcher/dist/Wiiwho Client Setup.exe" 2>/dev/null || stat -f%z "launcher/dist/Wiiwho Client Setup.exe") -gt 104857600`
    - Unpacked JRE present: `test -f launcher/dist/win-unpacked/resources/jre/win-x64/bin/javaw.exe`
    - Unpacked mod present: `test -f launcher/dist/win-unpacked/resources/mod/wiiwho-0.1.0.jar`
    - `cd launcher && npm run test:run` still green (no regression from packaging changes)
    - `cd launcher && npm run typecheck` still green
    - SUMMARY documents: (a) final installer file size; (b) any command that took > 2 min; (c) any warning from electron-builder
  </acceptance_criteria>
  <done>Windows NSIS installer built successfully, JRE + mod jar bundled correctly, smoke-verified via filesystem checks.</done>
</task>

</tasks>

<verification>
- `cd launcher && npm run test:run` — full Phase 3 test suite still green
- `cd launcher && npm run typecheck` — no regression
- Windows NSIS installer artifact produced at `launcher/dist/Wiiwho Client Setup.exe`
- Unpacked dir contains JRE `javaw.exe` + mod jar at expected paths
- electron-builder.yml follows RESEARCH.md config fragment verbatim
- Mojang asset policy: `launcher/resources/` contains only JRE + mod — NO Mojang jars, assets, libraries (confirmed by fact that resources/jre/ and resources/mod/ are the only extraResources; `grep -q "mc/" launcher/electron-builder.yml` returns empty)
</verification>

<success_criteria>
- JRE-01: Temurin 8 bundled for Windows (extraResources) — PKG-01 satisfied on Windows
- JRE-03: Runtime resolves via `resources/jre/` (Plan 03-01 paths.ts + confirmed packaged layout)
- PKG-01: NSIS installer exists + bundles JRE + mod jar
- Scripts are idempotent (re-running dist:win skips prefetch if already done)
- macOS build machinery (electron-builder.yml, README-macOS.txt, docs/install-macos.md) ready for Plan 03-12
</success_criteria>

<output>
After completion, create `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-11-SUMMARY.md` documenting:
- Final installer file size (for comparison with Plan 03-12 mac DMG)
- Total elapsed build time (prefetch-jre, build-mod, electron-builder)
- Any warnings from electron-builder's output
- Exact JRE archive sizes (for sanity check on the ~70 MB per slot estimate)
- Confirmation that `launcher/dist/win-unpacked/` contains ONLY launcher + JRE + mod — no Mojang assets (enforces docs/mojang-asset-policy.md)
</output>
