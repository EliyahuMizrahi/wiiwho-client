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
  - **Why x64-in-both-slots?** Temurin 8 has no arm64 JRE build (Adoptium never produced one), and 1.8.9's LWJGL native libraries are x86_64-only regardless — the JVM would have to run x86_64 anyway. Shipping one vendor (Temurin) for both slots keeps the installer smaller (~70 MB saved vs. Azul Zulu arm64) and the SHA256-verification surface simpler. Rosetta 2 is transparent at runtime.
