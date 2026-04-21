---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 12
type: execute
wave: 4
depends_on: ["03-11"]
files_modified:
  - launcher/dist/Wiiwho.dmg
autonomous: false
user_setup:
  - service: mac-build-machine
    why: "electron-builder cannot cross-build macOS DMGs from Windows. PKG-02 requires a one-time run on a physical Mac (or cloud mac-in-the-box / GitHub Actions macos-14 runner). This is the only plan that requires non-Windows hardware."
    env_vars: []
    dashboard_config:
      - task: "Access to a macOS 12+ machine with Node 22 + pnpm + JDK 17"
        location: "Owner's own Mac, friend's Mac, or GitHub Actions macos-14 runner"
requirements:
  - JRE-02
  - PKG-02
must_haves:
  truths:
    - "`pnpm run dist:mac` on a Mac produces launcher/dist/Wiiwho.dmg with both JRE slots (mac-arm64 + mac-x64) and the mod jar bundled"
    - "Mounting the DMG shows: Wiiwho.app, Applications shortcut, README-macOS.txt side-by-side (D-22 + DMG layout)"
    - "Wiiwho.app/Contents/Resources/jre/mac-arm64/Contents/Home/bin/java exists"
    - "Wiiwho.app/Contents/Resources/jre/mac-x64/Contents/Home/bin/java exists"
    - "Wiiwho.app/Contents/Resources/mod/wiiwho-0.1.0.jar exists"
    - "Right-click-Open workaround verified via the README-macOS.txt content being inside the mounted DMG"
  artifacts:
    - path: "launcher/dist/Wiiwho.dmg"
      provides: "macOS Universal DMG installer bundling launcher + both JRE slots + mod jar"
  key_links:
    - from: "launcher/electron-builder.yml mac.extraResources + dmg.contents"
      to: "launcher/resources/jre/mac-arm64 + launcher/resources/jre/mac-x64 + launcher/resources/mod + build/README-macOS.txt"
      via: "electron-builder + @electron/universal"
      pattern: "arch: universal"
---

<objective>
Run `electron-builder --mac` on a macOS 12+ machine, producing `launcher/dist/Wiiwho.dmg` — the Universal (arm64 + x64 merged) installer bundling both JRE slots and the mod jar. Verify via DMG-mount inspection that: (a) the app bundle is present, (b) the `/Applications` shortcut + README-macOS.txt are visible in the DMG window, (c) inside the app bundle, both JRE slots + the mod jar land at `Contents/Resources/jre/{mac-arm64,mac-x64}/` and `Contents/Resources/mod/wiiwho-0.1.0.jar`.

**This plan is NOT autonomous.** CLAUDE.md notes the owner is on Windows; electron-builder cannot cross-build a macOS DMG from Windows (the `@electron/universal` merge requires macOS-native tooling — `lipo`, `codesign` even ad-hoc). The executor needs access to a Mac. If unavailable, this plan is DEFERRED with no blocking impact on Plans 03-00 through 03-11.

The plan is small on purpose — all configuration was authored in Plan 03-11. This plan is just "run the build on Mac and verify the output."

Output: Wiiwho.dmg artifact + verified layout.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
@launcher/electron-builder.yml
@launcher/scripts/prefetch-jre.mjs
@launcher/scripts/build-mod.sh
@launcher/package.json
@build/README-macOS.txt
@docs/install-macos.md
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Confirm Mac build machine is available</name>
  <what-built>Plans 03-00 through 03-11 are complete; all code + config + scripts + docs for a macOS build are in place (Plan 03-11 authored them).</what-built>
  <how-to-verify>
    Before running the build, confirm Mac access:

    1. Is the owner running this plan on a macOS 12+ machine directly? (Preferred.)
    2. Alternative: Is the plan being run in GitHub Actions with a macos-14 runner configured? (Acceptable.)
    3. Alternative: Is a friend's Mac or a cloud Mac-in-the-box (MacStadium, AWS EC2 mac1.metal, etc.) available for a one-shot build? (Acceptable.)

    If none of the above: **STOP HERE**. This plan is deferred. Phase 3 completion criteria are satisfied with PKG-02 flagged as "pending Mac access" — owner tracks in STATE.md blockers and picks up later when a Mac is borrowable.

    If Mac access is confirmed, resume with Task 2.
  </how-to-verify>
  <resume-signal>Type "mac-available" to proceed with Task 2, or "deferred" to end Phase 3 with PKG-02 tracked as pending.</resume-signal>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Run dist:mac + verify the output DMG</name>
  <files>
    launcher/dist/Wiiwho.dmg
  </files>
  <read_first>
    - launcher/electron-builder.yml (Plan 03-11 — the config this build consumes)
    - launcher/scripts/prefetch-jre.mjs (Plan 03-11 — the JRE sourcing)
    - launcher/scripts/build-mod.sh (Plan 03-11 — the mod jar)
    - build/README-macOS.txt (Plan 03-11 — the DMG-embedded workaround)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §electron-builder Config Fragment Universal DMG gotcha
  </read_first>
  <action>
    On the Mac machine (assumption: Node 22 + pnpm + JDK 17 + Internet):

    1. Clone + install:
       ```bash
       git clone <repo-url>
       cd wiiwho-client/launcher
       pnpm install
       ```

    2. Run the Mac dist script:
       ```bash
       pnpm run dist:mac
       ```

       This chains: `package-resources` (prefetch-jre + build-mod) → `electron-vite build` → `electron-builder --mac`. Expected wall-clock: 5-10 minutes depending on network + Gradle cache.

       Expected output: `launcher/dist/Wiiwho.dmg` (~250-300 MB — Electron + 2× JRE + mod jar).

    3. Verify the DMG artifact:
       ```bash
       ls -lh launcher/dist/Wiiwho.dmg
       ```
       File exists; size > 200 MB.

    4. Mount the DMG and inspect its window content (D-22 layout):
       ```bash
       hdiutil attach launcher/dist/Wiiwho.dmg
       ls "/Volumes/Wiiwho Client/"
       # Expected entries:
       #   Wiiwho.app           (the app)
       #   Applications         (shortcut target of the arrow)
       #   README-macOS.txt     (the workaround doc)
       ```

    5. Verify the app bundle contents:
       ```bash
       ls "/Volumes/Wiiwho Client/Wiiwho.app/Contents/Resources/jre/"
       # Expected:
       #   mac-arm64
       #   mac-x64
       ls "/Volumes/Wiiwho Client/Wiiwho.app/Contents/Resources/jre/mac-arm64/Contents/Home/bin/java"
       ls "/Volumes/Wiiwho Client/Wiiwho.app/Contents/Resources/jre/mac-x64/Contents/Home/bin/java"
       # Both exist.
       ls "/Volumes/Wiiwho Client/Wiiwho.app/Contents/Resources/mod/wiiwho-0.1.0.jar"
       # Exists.
       ```

    6. Eject the DMG:
       ```bash
       hdiutil detach "/Volumes/Wiiwho Client"
       ```

    7. Confirm the app is NOT signed (intentional — PKG-02 accepts unsigned for v0.1):
       ```bash
       codesign -dv "/Volumes/Wiiwho Client/Wiiwho.app" 2>&1 | head
       # Expected: "code object is not signed at all" OR ad-hoc signature only
       ```

    If Universal build fails with `@electron/universal` byte-compare errors (Pitfall 6 from RESEARCH.md):
    - The likely cause is arch-conditional `extraResources` — verify electron-builder.yml has BOTH mac-arm64 AND mac-x64 entries in `mac.extraResources` unconditionally (both JREs in both arch builds so bytes match).
    - If still failing, escalate + document. The fix might be adding the JRE slots to `singleArchFiles` if electron-builder's Universal merge can't handle same-byte dirs.

    Document in SUMMARY:
    - Final DMG file size
    - `codesign -dv` output (confirms unsigned state)
    - `hdiutil attach` output (confirms DMG integrity)
    - Any warnings from electron-builder
    - Wall-clock time for each step of the build chain
  </action>
  <verify>
    <automated>test -f launcher/dist/Wiiwho.dmg</automated>
    <human_verify>
      Run on a Mac:
      1. `hdiutil attach launcher/dist/Wiiwho.dmg`
      2. Confirm Finder window shows: Wiiwho.app + Applications-shortcut + README-macOS.txt at positions (140,180), (400,180), (270,330) respectively
      3. `ls "/Volumes/Wiiwho Client/Wiiwho.app/Contents/Resources/"` shows jre/ and mod/ directories
      4. `ls "/Volumes/Wiiwho Client/Wiiwho.app/Contents/Resources/jre/"` shows `mac-arm64` AND `mac-x64`
      5. `ls "/Volumes/Wiiwho Client/Wiiwho.app/Contents/Resources/jre/mac-arm64/Contents/Home/bin/java"` — file exists, executable
      6. `ls "/Volumes/Wiiwho Client/Wiiwho.app/Contents/Resources/jre/mac-x64/Contents/Home/bin/java"` — file exists, executable
      7. `ls "/Volumes/Wiiwho Client/Wiiwho.app/Contents/Resources/mod/wiiwho-0.1.0.jar"` — file exists
      8. `cat "/Volumes/Wiiwho Client/README-macOS.txt" | grep "RIGHT-CLICK"` — text present
      9. `hdiutil detach "/Volumes/Wiiwho Client"`
    </human_verify>
  </verify>
  <acceptance_criteria>
    - File exists: `launcher/dist/Wiiwho.dmg`
    - File size > 200 MB: `test $(stat -f%z launcher/dist/Wiiwho.dmg 2>/dev/null || stat -c%s launcher/dist/Wiiwho.dmg) -gt 209715200`
    - DMG mounts without error (`hdiutil attach` exit 0)
    - Mounted volume contains Wiiwho.app, Applications shortcut, README-macOS.txt
    - Inside Wiiwho.app: Contents/Resources/jre/{mac-arm64,mac-x64}/Contents/Home/bin/java both present
    - Inside Wiiwho.app: Contents/Resources/mod/wiiwho-0.1.0.jar present
    - README-macOS.txt content matches build/README-macOS.txt (same bytes)
    - codesign reports unsigned or ad-hoc (not Developer ID — PKG-02 accepts)
  </acceptance_criteria>
  <done>Wiiwho.dmg produced, verified via DMG-mount inspection, all expected paths present, unsigned status confirmed.</done>
</task>

</tasks>

<verification>
- `launcher/dist/Wiiwho.dmg` exists + mounts cleanly
- Mounted DMG layout matches D-22 (Wiiwho.app + /Applications shortcut + README-macOS.txt)
- Both JRE slots present inside the app bundle (arm64 + x64 — Universal merge succeeded)
- Mod jar present at Contents/Resources/mod/wiiwho-0.1.0.jar
- Unsigned state confirmed (PKG-02 acceptable)
- docs/mojang-asset-policy.md invariant: no Mojang bytes in the DMG
</verification>

<success_criteria>
- JRE-02: Temurin 8 JRE bundled in macOS installer (verified via DMG mount)
- PKG-02: Universal DMG produced, both arches represented, unsigned with documented workaround
- D-22: Single Universal DMG (not separate arm64/x64)
- README-macOS.txt present INSIDE the DMG next to the app (not linked externally)
- No Mojang assets in the installer (paths.ts enforces runtime fetch; electron-builder.yml's extraResources only ships JRE + mod)
</success_criteria>

<output>
After completion, create `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-12-SUMMARY.md` documenting:
- Mac machine used (model + macOS version)
- Final DMG file size
- Wall-clock time for the full `pnpm run dist:mac`
- codesign -dv output (unsigned confirmation)
- Any electron-builder Universal-merge warnings
- DMG-mount screenshot recommended (but optional) — if captured, save as `.planning/phases/03-vanilla-launch-jre-bundling-packaging/dmg-layout.png` (not committed — ephemeral).

If this plan was DEFERRED (Task 1 resume-signal was "deferred"):
- Create `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-12-DEFERRED.md` describing the PKG-02 gap
- Update STATE.md blockers: "PKG-02 pending — needs macOS 12+ build machine"
- Phase 3 is otherwise complete; rest of the requirements satisfied by Plans 03-00 through 03-11.
</output>
