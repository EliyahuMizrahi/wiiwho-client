# Wiiwho Client — Forge 1.8.9 Mod

Built from [nea89o/Forge1.8.9Template](https://github.com/nea89o/Forge1.8.9Template) per decision D-27. History stripped on initial scaffold (2026-04-20).

## Toolchain (locked)

- **Gradle 8.8** (via wrapper — `./gradlew`)
- **gg.essential.loom 0.10.0.+** (fork of architectury-loom)
- **Forge 11.15.1.2318-1.8.9** + **MCP mappings `stable_22`**
- **Mixin 0.7.11-SNAPSHOT** runtime (LaunchWrapper-compatible — do NOT upgrade)
- **Mixin 0.8.5-SNAPSHOT** annotation processor (refmap generation)
- **DevAuth-forge-legacy 1.2.1** — real MS login during `runClient`

## Requirements

- **JDK 8** (Temurin recommended) — compile target for Minecraft 1.8.9
- **JDK 17** (Temurin recommended) — Gradle daemon runtime (Gradle 8 refuses to boot on Java 8)

If only one JDK is available, point Gradle at JDK 17 via `org.gradle.java.home` in `~/.gradle/gradle.properties`. Loom's `java.toolchain.languageVersion.set(8)` will auto-provision JDK 8 for compilation.

## Common tasks

- `./gradlew --dry-run build` — verify configuration (no compilation)
- `./gradlew :client-mod:test --tests club.wiiwho.ModidTest` — run unit tests
- `./gradlew runClient -Ddevauth.enabled=1` — launch dev 1.8.9 with the mod + DevAuth MS login (requires MS account on first run). **Plan 02 scope — not wired end-to-end in Plan 01.**
- `./gradlew build` — produce the remapped release jar (Phase 4 wires this into the launcher's injection step).

## Tip

Add `systemProp.devauth.enabled=1` to `~/.gradle/gradle.properties` (user-global, NOT committed) if you want DevAuth to always be on for this workspace.

## First-time runClient on Windows

1. **Prerequisites:**
   - JDK 8 (Temurin 8u4xx+) installed; Loom auto-provisions this via `java.toolchain.languageVersion.set(8)` — no PATH change required if a JDK 8 is discoverable.
   - JDK 17 (Temurin 17) installed; used as Gradle daemon. If your system PATH has JDK 24 (or any non-17 JDK) pointed at `JAVA_HOME`, Gradle 8.8 will either fail or behave unpredictably. Set `org.gradle.java.home=C:/Program Files/Java/jdk-17` in `~/.gradle/gradle.properties` OR export `JAVA_HOME=/c/Program\ Files/Java/jdk-17` for the shell session.
   - Working internet connection (Gradle downloads dependencies on first run; DevAuth opens browser to `https://microsoft.com/devicelogin`).

2. **Run:**
   ```powershell
   cd client-mod
   ./gradlew runClient -Ddevauth.enabled=1
   ```

3. **First-time DevAuth flow:**
   - Watch console output. DevAuth prints: `To sign in, use a web browser to open the page https://microsoft.com/devicelogin and enter the code <ABCDEFGH>`.
   - Open `https://microsoft.com/devicelogin` in your browser.
   - Enter the code. Sign in with your Minecraft-owning Microsoft account (owner's personal MS account per D-14).
   - Return to the terminal. DevAuth persists refresh token to `%APPDATA%\devauth\microsoft_accounts.json`.
   - Minecraft 1.8.9 window opens. Title bar reads `Minecraft 1.8.9`; username in top-right is the owner's real MS username (NOT "Player").
   - Console stdout contains `[Wiiwho] Mixin hello — Minecraft.startGame hooked` before the title screen renders.
   - F3 debug overlay lists the mod: `wiiwho` appears alongside `Minecraft`, `mcp`, `FML`, `Forge` in the loaded-mods list.

4. **Subsequent runs:**
   DevAuth silently refreshes. No browser interaction required unless the refresh token expired (rare — weeks/months).

5. **Optional always-on DevAuth:**
   Add to `~/.gradle/gradle.properties` (user-global, NOT in repo):
   ```properties
   systemProp.devauth.enabled=1
   ```
   Then `./gradlew runClient` alone activates DevAuth. Do NOT commit this to the repo-local gradle.properties — other developers may not want it.

6. **Troubleshooting:**

   | Symptom | Fix |
   |---------|-----|
   | Username shows "Player" | Forgot `-Ddevauth.enabled=1` (RESEARCH Pitfall 2) |
   | `UnsatisfiedLinkError: lwjgl64.dll` | Delete `.gradle/loom-cache/` and re-run |
   | 30s pause at launch | Windows Defender scanning; add repo as exclusion |
   | `class file has wrong version 61.0, should be 52.0` | Gradle picked JDK 17 for compile; check Project Structure JDK is 8, Gradle JVM is 17 (RESEARCH Pitfall 7) |
   | Gradle daemon refuses to start / `Unsupported class file major version` | `JAVA_HOME` is pointing at an unsupported JDK (e.g. JDK 24). Set `org.gradle.java.home` in `~/.gradle/gradle.properties` to your JDK 17 install path |
   | `[Wiiwho] Mixin hello` does NOT appear | `mixins.wiiwho.json` `client` array missing `"MixinMinecraft"`, OR package rename from Plan 01 was incomplete — grep for legacy template packages (`com.example`, `example.examplemod`) in `client-mod/` (RESEARCH Pitfall 3) |

## Layout

```
client-mod/
├── build.gradle.kts            # loom + mixin + shadow + pack200 plugins
├── settings.gradle.kts         # pluginManagement + loom resolutionStrategy
├── gradle.properties           # modid=wiiwho, baseGroup=club.wiiwho
├── log4j2.xml                  # log config for dev runs
├── gradle/wrapper/             # Gradle 8.8 wrapper
├── src/main/java/club/wiiwho/
│   ├── Wiiwho.java             # @Mod entry class — MODID="wiiwho"
│   └── mixins/                 # (empty — Plan 02 adds MixinMinecraft)
├── src/main/resources/
│   ├── mcmod.info              # Forge metadata (name "Wiiwho")
│   └── mixins.wiiwho.json      # Mixin config, package club.wiiwho.mixins
└── src/test/java/club/wiiwho/
    └── ModidTest.java          # JUnit 5 asserts MOD-03
```
