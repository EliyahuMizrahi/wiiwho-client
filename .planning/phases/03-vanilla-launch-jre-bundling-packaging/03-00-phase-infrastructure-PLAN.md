---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 00
type: execute
wave: 1
depends_on: []
files_modified:
  - launcher/package.json
  - launcher/src/renderer/src/components/ui/sheet.tsx
  - launcher/src/renderer/src/components/ui/slider.tsx
  - launcher/src/renderer/src/components/ui/tooltip.tsx
  - launcher/src/main/launch/__fixtures__/1.8.9-manifest.json
  - launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt
  - launcher/src/main/monitor/__fixtures__/fake-crash-report.txt
  - .gitignore
autonomous: true
requirements:
  - LCH-01
  - LCH-02
  - LCH-03
  - LCH-05
  - LCH-07
  - LAUN-03
  - LAUN-05
  - COMP-05
must_haves:
  truths:
    - "@xmcl/core, @xmcl/installer, execa, p-queue are installed and typecheck clean"
    - "shadcn Sheet, Slider, Tooltip primitives are present and importable from @/components/ui"
    - "Fixture files exist under __fixtures__ and are consumed by later plans' tests"
    - "launcher/resources/jre/ and launcher/resources/mod/ are gitignored so JRE/mod bytes never commit"
  artifacts:
    - path: "launcher/package.json"
      provides: "@xmcl/core + @xmcl/installer + execa + p-queue in dependencies"
      contains: '"@xmcl/core"'
    - path: "launcher/src/renderer/src/components/ui/sheet.tsx"
      provides: "Radix Sheet wrapper (drawer)"
    - path: "launcher/src/renderer/src/components/ui/slider.tsx"
      provides: "Radix Slider wrapper (RAM)"
    - path: "launcher/src/renderer/src/components/ui/tooltip.tsx"
      provides: "Radix Tooltip wrapper (G1GC info)"
    - path: "launcher/src/main/launch/__fixtures__/1.8.9-manifest.json"
      provides: "Trimmed client.json fixture with known-bad SHA1 for re-download tests"
    - path: "launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt"
      provides: "Real 1.8.9 boot log for sentinel + log-parser tests"
    - path: "launcher/src/main/monitor/__fixtures__/fake-crash-report.txt"
      provides: "Crash dump fixture with fake MC token + C:\\Users\\Alice\\ + /Users/bob/ paths"
  key_links:
    - from: ".gitignore"
      to: "launcher/resources/jre/ + launcher/resources/mod/"
      via: "gitignore entries"
      pattern: "launcher/resources/jre"
    - from: "launcher/package.json"
      to: "node_modules"
      via: "pnpm install"
      pattern: '"@xmcl/installer"'
---

<objective>
Install the four Phase 3 runtime dependencies (@xmcl/core, @xmcl/installer, execa, p-queue), add the three shadcn UI primitives (Sheet, Slider, Tooltip), lay down fixture files consumed by later plans' tests, and gitignore the two new resource directories (`launcher/resources/jre/`, `launcher/resources/mod/`) so JRE/mod bytes never get committed.

Purpose: Give every Wave 2 plan its dependencies on day zero so later plans are 100% about behavior. Fixtures are created up-front (single source of truth) — no plan re-invents them.

Output: package.json updated, three new UI files, three fixtures, .gitignore updated, `pnpm install` clean, typecheck + test suite still green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
@launcher/package.json
@.gitignore

<interfaces>
<!-- Existing ui primitives the plan augments (not replaces). -->

From launcher/src/renderer/src/components/ui/button.tsx — pattern to mirror (shadcn new-york-v4 style, cn() utility, forwardRef, size variants).
From launcher/src/renderer/src/components/ui/dialog.tsx — Radix primitive wrapper idiom (uses `radix-ui` unified package since Feb 2026 — import `import * as Sheet from '@radix-ui/react-sheet'` WILL NOT WORK; use the unified `radix-ui` package namespaces).

shadcn CLI note (Phase 2 locked idiom):
- Phase 2 Plan 02-00 decision: `pnpm dlx shadcn@latest add` chokes on pnpm hoist-pattern; COMPONENTS MUST BE MANUALLY INLINED from the new-york-v4 registry JSON.
- Reference URL per component: https://ui.shadcn.com/r/styles/new-york-v4/sheet.json (and /slider.json, /tooltip.json).
- Strip the `$schema` key; copy the `files[].content` verbatim into the target file.

Radix unified import convention (from existing dialog.tsx + dropdown-menu.tsx):
- `import * as DialogPrimitive from 'radix-ui/react-dialog'` pattern (unified package since Feb 2026) — confirm by grep in existing dialog.tsx.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Install Phase 3 runtime dependencies</name>
  <files>launcher/package.json</files>
  <read_first>
    - launcher/package.json (current deps)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Standard Stack — exact versions to pin
  </read_first>
  <action>
    In `launcher/` run:
    ```
    pnpm add @xmcl/core @xmcl/installer execa p-queue
    ```
    Do NOT add Temurin/Azul JRE dependencies — those come via the prefetch-jre script in Plan 03-11, never as npm deps.

    Expected resolved versions (verify via `npm view <pkg> version` before install; record actual in commit message):
    - @xmcl/core ^2.x (latest stable; RESEARCH.md §Standard Stack — "latest (^2.x per STACK.md)")
    - @xmcl/installer latest
    - execa ^9.x (RESEARCH.md §JVM Spawn requires cancelSignal support — 9.x has it)
    - p-queue ^8.x

    After install:
    1. Confirm `pnpm install` completes with no errors.
    2. Confirm `pnpm --filter ./launcher run typecheck` still passes (`npm run typecheck` from `launcher/`).
    3. Confirm `pnpm --filter ./launcher test:run` still green (no Phase 2 tests broken).

    Do NOT modify `package.json` manually beyond what pnpm writes. Do NOT install `electron-updater` (v0.2+ per PROJECT.md out-of-scope).
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; pnpm install &amp;&amp; npm run typecheck &amp;&amp; npm run test:run</automated>
  </verify>
  <acceptance_criteria>
    - `grep '"@xmcl/core"' launcher/package.json` returns a match
    - `grep '"@xmcl/installer"' launcher/package.json` returns a match
    - `grep '"execa"' launcher/package.json` returns a match
    - `grep '"p-queue"' launcher/package.json` returns a match
    - `launcher/node_modules/@xmcl/installer/package.json` exists
    - `cd launcher &amp;&amp; npm run typecheck` exits 0
    - `cd launcher &amp;&amp; npm run test:run` exits 0 (Phase 2 tests still pass)
  </acceptance_criteria>
  <done>Four new deps listed in package.json; lockfile updated; pnpm install + typecheck + existing tests all green.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add shadcn Sheet, Slider, Tooltip primitives</name>
  <files>
    launcher/src/renderer/src/components/ui/sheet.tsx,
    launcher/src/renderer/src/components/ui/slider.tsx,
    launcher/src/renderer/src/components/ui/tooltip.tsx
  </files>
  <read_first>
    - launcher/src/renderer/src/components/ui/button.tsx (shadcn new-york-v4 idiom — cn utility, forwardRef, size variants)
    - launcher/src/renderer/src/components/ui/dialog.tsx (Radix primitive wrapper pattern — how `radix-ui` unified import works)
    - launcher/src/renderer/src/components/ui/dropdown-menu.tsx (same)
    - .planning/phases/02-microsoft-authentication/02-CONTEXT.md §shadcn CLI note (manual-inline idiom was locked Phase 2)
  </read_first>
  <action>
    Per Phase 2 Plan 02-00 precedent (CLI chokes on pnpm workspace hoist-pattern), MANUALLY INLINE each component from the new-york-v4 registry JSON. DO NOT run `pnpm dlx shadcn@latest add`.

    For each component, fetch the registry JSON, extract `files[0].content`, and write to the target path:

    1. **sheet.tsx** — fetch `https://ui.shadcn.com/r/styles/new-york-v4/sheet.json`; copy `files[0].content` verbatim into `launcher/src/renderer/src/components/ui/sheet.tsx`. This component wraps Radix Dialog (Sheet is Dialog with side-panel variants); it exports `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`.
    2. **slider.tsx** — fetch `https://ui.shadcn.com/r/styles/new-york-v4/slider.json`; same pattern. Exports `Slider` (a single component wrapping Radix Slider primitives).
    3. **tooltip.tsx** — fetch `https://ui.shadcn.com/r/styles/new-york-v4/tooltip.json`; same pattern. Exports `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`.

    **If the registry import path is `@radix-ui/react-sheet` (per-package shape):** change the import to match the EXISTING project convention. Grep existing `launcher/src/renderer/src/components/ui/dialog.tsx` for its Radix import pattern (should be `import * as DialogPrimitive from 'radix-ui/react-dialog'` or `from 'radix-ui'` with namespace access). Apply the SAME pattern to sheet/slider/tooltip — the project uses the unified `radix-ui` package (version 1.4.3 in package.json), not individual `@radix-ui/react-*` packages. Mismatch here will cause runtime import failures.

    Each file must typecheck cleanly. Do NOT add custom color tweaks yet — defaults are fine; Plan 03-07 tunes them.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npm run typecheck</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `launcher/src/renderer/src/components/ui/sheet.tsx`
    - File exists: `launcher/src/renderer/src/components/ui/slider.tsx`
    - File exists: `launcher/src/renderer/src/components/ui/tooltip.tsx`
    - `grep "export.*Sheet" launcher/src/renderer/src/components/ui/sheet.tsx` returns at least 3 matches (Sheet, SheetContent, SheetTrigger minimum)
    - `grep "export.*Slider" launcher/src/renderer/src/components/ui/slider.tsx` returns a match
    - `grep "export.*Tooltip" launcher/src/renderer/src/components/ui/tooltip.tsx` returns at least 3 matches (Tooltip, TooltipContent, TooltipTrigger minimum)
    - Imports in all three files match the unified `radix-ui` pattern used by existing `dialog.tsx` (no `@radix-ui/react-*` imports)
    - `cd launcher &amp;&amp; npm run typecheck` exits 0
  </acceptance_criteria>
  <done>Three shadcn UI files present, export expected primitives, import pattern consistent with existing components, typecheck passes.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Create fixtures and gitignore resource dirs</name>
  <files>
    launcher/src/main/launch/__fixtures__/1.8.9-manifest.json,
    launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt,
    launcher/src/main/monitor/__fixtures__/fake-crash-report.txt,
    .gitignore
  </files>
  <read_first>
    - .gitignore (current state)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Mojang Manifest Shape (values for fixture)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Redaction Patterns (fixture crash report must contain these strings)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Main-Menu Detection (boot-log fixture must contain `Sound engine started`)
  </read_first>
  <action>
    **1. Create `launcher/src/main/launch/__fixtures__/1.8.9-manifest.json`:**

    Trimmed 1.8.9 client.json fixture used by Plans 03-03 and 03-04 tests. Content (paste verbatim):

    ```json
    {
      "id": "1.8.9",
      "type": "release",
      "mainClass": "net.minecraft.client.main.Main",
      "minimumLauncherVersion": 14,
      "minecraftArguments": "--username ${auth_player_name} --version ${version_name} --gameDir ${game_directory} --assetsDir ${assets_root} --assetIndex ${assets_index_name} --uuid ${auth_uuid} --accessToken ${auth_access_token} --userProperties ${user_properties} --userType ${user_type}",
      "assetIndex": {
        "id": "1.8",
        "sha1": "f6ad102bcaa53b1a58358f16e376d548d44933ec",
        "size": 78494,
        "totalSize": 114885064,
        "url": "https://launchermeta.mojang.com/v1/packages/f6ad102bcaa53b1a58358f16e376d548d44933ec/1.8.json"
      },
      "javaVersion": { "component": "jre-legacy", "majorVersion": 8 },
      "downloads": {
        "client": {
          "sha1": "3870888a6c3d349d3771a3e9d16c9bf5e076b908",
          "size": 8461484,
          "url": "https://launcher.mojang.com/v1/objects/3870888a6c3d349d3771a3e9d16c9bf5e076b908/client.jar"
        }
      },
      "libraries": [
        {
          "name": "org.lwjgl.lwjgl:lwjgl-platform:2.9.4-nightly-20150209",
          "downloads": {
            "classifiers": {
              "natives-osx": {
                "sha1": "bcab850f8f487c3f4c4dbabde778bb82bd1a40ed",
                "size": 426822,
                "url": "https://libraries.minecraft.net/org/lwjgl/lwjgl/lwjgl-platform/2.9.4-nightly-20150209/lwjgl-platform-2.9.4-nightly-20150209-natives-osx.jar"
              },
              "natives-windows": {
                "sha1": "b84d5102b9dbfabfeb5e43c7e2828d98a7fc80e0",
                "size": 613748,
                "url": "https://libraries.minecraft.net/org/lwjgl/lwjgl/lwjgl-platform/2.9.4-nightly-20150209/lwjgl-platform-2.9.4-nightly-20150209-natives-windows.jar"
              }
            }
          },
          "extract": { "exclude": ["META-INF/"] },
          "natives": { "osx": "natives-osx", "windows": "natives-windows" },
          "rules": [{ "action": "allow" }]
        },
        {
          "name": "com.paulscode:codecjorbis:20101023",
          "downloads": {
            "artifact": {
              "sha1": "c293f4b13eb2e9cfd6d0a0e339afc96a02cfa2f2",
              "size": 99298,
              "url": "https://libraries.minecraft.net/com/paulscode/codecjorbis/20101023/codecjorbis-20101023.jar"
            }
          }
        },
        {
          "_comment": "Fixture: library with INTENTIONALLY-BAD SHA1 for re-download-on-corruption test (SC5).",
          "name": "fixture.bad:bad-sha1:1.0",
          "downloads": {
            "artifact": {
              "sha1": "0000000000000000000000000000000000000000",
              "size": 123,
              "url": "https://fixture.example.com/bad-sha1.jar"
            }
          }
        }
      ]
    }
    ```

    **2. Create `launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt`:**

    Captured 1.8.9 boot log (15-20 lines) — Plan 03-06 tests the main-menu sentinel detection against this. Content:

    ```
    [12:34:56] [main/INFO]: Loading tweak class name net.minecraftforge.fml.common.launcher.FMLTweaker
    [12:34:56] [main/INFO]: Using primary tweak class name net.minecraftforge.fml.common.launcher.FMLTweaker
    [12:34:57] [Client thread/INFO]: Setting user: Wiiwho
    [12:34:58] [Client thread/INFO]: LWJGL Version: 2.9.4
    [12:34:58] [Client thread/INFO]: Reloading ResourceManager: Default
    [12:34:59] [Client thread/INFO]: Initialized twitch
    [12:35:00] [Sound Library Loader/INFO]: Starting up SoundSystem...
    [12:35:00] [Thread-8/INFO]: Initializing LWJGL OpenAL
    [12:35:00] [Thread-8/INFO]: (The LWJGL binding of OpenAL.  For more information, see http://www.lwjgl.org)
    [12:35:00] [Thread-8/INFO]: OpenAL initialized.
    [12:35:00] [Sound Library Loader/INFO]: Sound engine started
    [12:35:01] [Client thread/INFO]: SoundSystem shutting down...
    [12:35:10] [Client thread/INFO]: Stopping!
    ```

    The key line Plan 03-06 tests for: `[Sound Library Loader/INFO]: Sound engine started`. Verify: regex `/\[.*?\/INFO\]:\s+Sound engine started$/` matches line 11 (1-indexed, counting the first line as 1) exactly ONCE in this fixture.

    **3. Create `launcher/src/main/monitor/__fixtures__/fake-crash-report.txt`:**

    Crash-dump fixture containing all the redaction targets from D-20. Plan 03-01's `sanitizeCrashReport` test reads this verbatim. Content:

    ```
    ---- Minecraft Crash Report ----
    // I let you down. Sorry :(

    Time: 4/21/26 3:04 PM
    Description: Unexpected error

    java.lang.NullPointerException: Cannot invoke "net.minecraft.client.entity.EntityPlayerSP.getName()" because the return value of "net.minecraft.client.Minecraft.getPlayer()" is null
        at net.minecraft.client.Minecraft.runTick(Minecraft.java:1657)

    -- System Details --
    Details:
        Minecraft Version: 1.8.9
        Operating System: Windows 11 (amd64) version 10.0
        Java Version: 1.8.0_482, Temurin
        Launched Version: 1.8.9
        Launched command: javaw -Xmx2048M -Xms2048M -XX:+UseG1GC -cp "C:\Users\Alice\AppData\Roaming\Wiiwho\game\libraries\...;C:\Users\Alice\AppData\Roaming\Wiiwho\game\versions\1.8.9\1.8.9.jar" net.minecraft.client.main.Main --username Wiiwho --accessToken ey.fakeTokenBody123.secretsig --userType msa
        Game files at: /Users/bob/Library/Application Support/Wiiwho/game
        User home: %USERNAME% and also $USER and $HOME references
    ```

    This fixture contains (for Plan 03-01's redaction test to assert on):
    - `--accessToken ey.fakeTokenBody123.secretsig` (MC_TOKEN_CLI_PATTERN)
    - `C:\Users\Alice\` (WINDOWS_USER_PATH_PATTERN)
    - `/Users/bob/` (MACOS_USER_PATH_PATTERN)
    - `%USERNAME%` (WINDOWS_ENV_USERNAME_PATTERN)
    - `$USER` (UNIX_ENV_USER_PATTERN)
    - `$HOME` (UNIX_ENV_HOME_PATTERN)

    **4. Update `.gitignore`:**

    Append two lines (keeping existing content unchanged):

    ```
    # Phase 3: Temurin/Azul JRE binaries fetched at build time — NEVER commit.
    launcher/resources/jre/
    # Phase 3: Wiiwho mod jar built from client-mod at build time — NEVER commit.
    launcher/resources/mod/
    ```

    Confirm `launcher/resources/icon.png` is still tracked (the gitignore uses dir-specific ignores, not a wildcard that would eat icon.png).
  </action>
  <verify>
    <automated>test -f launcher/src/main/launch/__fixtures__/1.8.9-manifest.json &amp;&amp; test -f launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt &amp;&amp; test -f launcher/src/main/monitor/__fixtures__/fake-crash-report.txt &amp;&amp; grep -q "launcher/resources/jre/" .gitignore &amp;&amp; grep -q "launcher/resources/mod/" .gitignore &amp;&amp; grep -q "Sound engine started" launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt &amp;&amp; grep -q "ey.fakeTokenBody123" launcher/src/main/monitor/__fixtures__/fake-crash-report.txt</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q '"mainClass": "net.minecraft.client.main.Main"' launcher/src/main/launch/__fixtures__/1.8.9-manifest.json` succeeds
    - `grep -q '"sha1": "3870888a6c3d349d3771a3e9d16c9bf5e076b908"' launcher/src/main/launch/__fixtures__/1.8.9-manifest.json` succeeds (LCH-01 SHA1)
    - `grep -q '"sha1": "0000000000000000000000000000000000000000"' launcher/src/main/launch/__fixtures__/1.8.9-manifest.json` succeeds (bad-SHA1 library for SC5 test)
    - `grep -q 'Sound engine started' launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt` succeeds
    - `grep -qc 'Sound engine started' launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt` returns exactly 1 (the sentinel must fire ONCE)
    - Fake crash report contains ALL of these strings: `--accessToken ey.fakeTokenBody123`, `C:\Users\Alice`, `/Users/bob`, `%USERNAME%`, `$USER`, `$HOME`
    - `.gitignore` contains `launcher/resources/jre/` and `launcher/resources/mod/`
    - `launcher/resources/icon.png` remains git-tracked (`git ls-files launcher/resources/icon.png` succeeds)
  </acceptance_criteria>
  <done>Three fixture files exist with the exact content specified; .gitignore updated; icon.png untouched.</done>
</task>

</tasks>

<verification>
- `cd launcher && pnpm install` clean
- `cd launcher && npm run typecheck` exits 0
- `cd launcher && npm run test:run` all Phase 1 + Phase 2 tests still pass
- All three fixture files grep-verified to contain required markers
- `.gitignore` ignores both resource subdirs without affecting icon.png
</verification>

<success_criteria>
- 4 new deps in package.json (@xmcl/core, @xmcl/installer, execa, p-queue)
- 3 new shadcn UI files (sheet, slider, tooltip) — importable, typecheck clean
- 3 fixtures (manifest JSON, boot log, fake crash report) — ready for Plans 03-01, 03-03, 03-04, 03-06 tests
- .gitignore blocks `launcher/resources/jre/` and `launcher/resources/mod/` so no build artifact ever accidentally commits
- Existing Phase 1+2 test suite remains green (no regressions)
</success_criteria>

<output>
After completion, create `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-00-SUMMARY.md` documenting:
- Resolved versions of the 4 installed deps
- Which import pattern shadcn components use (`radix-ui/*` unified vs `@radix-ui/react-*`)
- Fixture file sizes (sanity-check they're reasonable, not empty)
- Any install warnings for later plans to be aware of
</output>
