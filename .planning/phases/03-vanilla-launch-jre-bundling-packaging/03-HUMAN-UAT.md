---
status: partial
phase: 03-vanilla-launch-jre-bundling-packaging
source: [03-VERIFICATION.md]
started: 2026-04-21T10:30:00Z
updated: 2026-04-21T10:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end Play → Minecraft main menu (SC1 / LCH-05 / LCH-06 / JRE-03)
expected: Click Play from the Windows launcher with a real Microsoft account. After ~60 s first run (or ~10 s cached), the Minecraft 1.8.9 main menu is visible, logged in with the real MSA gamertag. Launcher window minimized on the `Sound engine started` sentinel. Only the bundled Temurin JRE spawned — no system Java. Uninstall any system Java first to prove JRE-03 at runtime.
result: [pending]

### 2. SC3 real-token redaction (crash viewer) (COMP-05 / LAUN-05)
expected: Force a JVM crash (edit argv to point at a bad natives path, or inject a real `access_token`-looking string into a crash-report fixture). In BOTH the on-screen `<pre>` block AND the output of `Copy report` → paste into a scratch file: any `eyJ...` JWT body, `access_token: ...`, `refresh_token: ...`, `--accessToken <value>`, `%USERNAME%`, `C:\Users\<name>`, `/Users/<name>` tokens are replaced with `[REDACTED]` / `<USER>`. Both strings must match byte-for-byte (D-21).
result: [pending]

### 3. PKG-02 — macOS DMG build on a Mac (JRE-02 / PKG-02)
expected: On a macOS 12+ machine with Node 22 + JDK 17 installed: `pnpm install && pnpm --filter ./launcher run dist:mac` produces `launcher/dist/Wiiwho.dmg`. Mount the DMG, right-click-Open `Wiiwho.app`, Gatekeeper prompt dismisses, Play button works, bundled Java under `Contents/Resources/jre/{mac-arm64,mac-x64}` is what runs. All prep artifacts (electron-builder.yml mac target, prefetch-jre mac slots, README-macOS.txt, docs/install-macos.md) are already in place per Plan 03-11 + 03-12.
result: [pending]

### 4. PKG-01 — Windows NSIS installer binary (PKG-01)
expected: After enabling Windows Developer Mode (Settings → Privacy & Security → For developers → Developer Mode: On) OR running `pnpm --filter ./launcher run dist:win` from an elevated admin shell, commit `94da6e2` produces `launcher/dist/Wiiwho Client Setup.exe`. Install it, launch Wiiwho from Start Menu, Play to main menu.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

None — all 4 items are external-access blockers, not code gaps. Verified by 03-VERIFICATION.md: 5/5 automated must-haves verified; SC2/SC3/SC5 already fully verified via unit + integration tests; SC1/SC4 correctly routed to human testing.
