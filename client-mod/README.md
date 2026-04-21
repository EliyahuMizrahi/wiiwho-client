# Wiiwho Client — Forge 1.8.9 Mod

Built from [nea89o/Forge1.8.9Template](https://github.com/nea89o/Forge1.8.9Template) per decision D-27. History stripped on initial scaffold (2026-04-20).

## Toolchain (locked)

- **Gradle 7.6.4** (via wrapper — `./gradlew`). Do NOT upgrade to 8.x — `gg.essential.loom 0.10.0.5`'s `RunGameTask` exposes an unannotated `main` property that Gradle 8.x strict validation rejects as a hard error. Aligns with RESEARCH.md §"Gradle 7.6.x is the sweet spot".
- **gg.essential.loom 0.10.0.+** (fork of architectury-loom)
- **Shadow plugin 7.1.2** (Gradle 7-compatible; Shadow 8.x requires Gradle 8+).
- **Forge 11.15.1.2318-1.8.9** + **MCP mappings `stable_22`**
- **Mixin 0.7.11-SNAPSHOT** runtime (LaunchWrapper-compatible — do NOT upgrade)
- **Mixin 0.8.5-SNAPSHOT** annotation processor (refmap generation)
- **DevAuth-forge-legacy 1.2.1** — real MS login during `runClient`

## Requirements

- **JDK 17** (Temurin recommended) — Gradle 7.6 daemon runtime (`$env:JAVA_HOME` or `org.gradle.java.home`).
- **JDK 8** (Temurin 8u4xx+) — Minecraft 1.8.9 compile + runtime target. The `runClient` task is pinned to a Java 8 launcher via Gradle's toolchain service, which auto-provisions Temurin 8 into `~/.gradle/jdks/` on first run — but it needs an installed Temurin 8 on disk to locate first. On Windows: `winget install EclipseAdoptium.Temurin.8.JDK`.

## Common tasks

- `./gradlew --dry-run build` — verify configuration (no compilation).
- `./gradlew :client-mod:test --tests club.wiiwho.ModidTest` — run unit tests.
- `./gradlew runClient` — launch dev 1.8.9 with the mod + DevAuth MS login. **DevAuth is wired on by default** via `runConfigs.client.property("devauth.enabled", "true")` in `build.gradle.kts` — no `-D` flag required.
- `./gradlew build` — produce the remapped release jar (Phase 4 wires this into the launcher's injection step).

## First-time runClient on Windows

**Validated end-to-end on 2026-04-20** — exact evidence recorded in `.planning/STATE.md`. These steps produced a working Minecraft 1.8.9 client with real Microsoft auth on a fresh Windows 11 machine.

### 1. Prerequisites (one-time)

**JDK 17 (Gradle daemon):**
```powershell
winget install EclipseAdoptium.Temurin.17.JDK
# Close and reopen PowerShell so PATH refreshes.
```

Set `JAVA_HOME` to the Temurin 17 install (PowerShell session-scoped):
```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.X-hotspot"
```

For persistence across sessions, set it via `System Properties → Environment Variables` or add to `~/.gradle/gradle.properties`:
```properties
org.gradle.java.home=C:/Program Files/Eclipse Adoptium/jdk-17.0.X-hotspot
```

**JDK 8 (Minecraft 1.8.9 runtime):**
```powershell
winget install EclipseAdoptium.Temurin.8.JDK
```
Installs to `C:\Program Files\Eclipse Adoptium\jdk-8.0.XYZ-hotspot\`. Gradle's toolchain service discovers this on first `runClient` and auto-provisions a copy at `~/.gradle/jdks/temurin-8-amd64-windows/jdk8uXYZ-b08/`. You only need the system install for the initial discovery — subsequent runs use the provisioned copy.

### 2. DevAuth first-run config (one-time)

DevAuth reads config from the **user home directory**, NOT from the project tree. After the first failed `runClient` (DevAuth creates the skeleton file), edit:

```
C:\Users\<your-username>\.devauth\config.toml
```

Uncomment the `defaultAccount` line so DevAuth knows which account to log in as:

```toml
defaultAccount = "main"
```

(Or whatever account name you prefer — the string is just a local key; DevAuth will prompt you to OAuth into Microsoft the first time that name is used.)

### 3. Run

```powershell
cd client-mod
./gradlew runClient
```

**First-time flow:**

1. Gradle downloads dependencies (60-180s on fresh machines).
2. Loom extracts Minecraft 1.8.9 + LWJGL natives into `.gradle/loom-cache/`.
3. DevAuth prints an OAuth URL (NOT the device-code URL — this is browser OAuth with PKCE):
   ```
   [DevAuth/Microsoft] OAuth URL, open this in a browser to complete authentication:
     https://login.live.com/oauth20_authorize.srf?client_id=757bb3b3...&redirect_uri=http://127.0.0.1:3000&scope=XboxLive.signin+XboxLive.offline_access...
   ```
4. Open the URL, sign in with your Microsoft (Minecraft) account. DevAuth captures the callback on `127.0.0.1:3000`.
5. DevAuth fetches the full token chain (verified in the log: `oauth → xbl → xsts → session`) and persists to:
   ```
   %USERPROFILE%\.devauth\microsoft_accounts.json
   ```
6. Forge logs `Setting user: <your-ms-username>` and Minecraft 1.8.9 opens logged in as your real account.
7. Console/log contains `[Wiiwho] Mixin hello — Minecraft.startGame hooked` before the title screen renders (see Mojibake note in Troubleshooting).
8. `Mod Options` screen lists 4 mods: Minecraft Coder Pack, Forge Mod Loader, Minecraft Forge, Wiiwho.

### 4. Subsequent runs

DevAuth silently refreshes from the cached tokens — no browser interaction unless the refresh token expired (weeks/months). `./gradlew runClient` opens Minecraft in <30s on a warm Gradle cache.

### 5. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Username shows `Player###` | `defaultAccount` not set in `C:\Users\<user>\.devauth\config.toml` — uncomment the line and re-run |
| Gradle daemon refuses to start / `Unsupported class file major version 65/66/67` | `JAVA_HOME` points at a too-new JDK. Set `$env:JAVA_HOME` to your Temurin 17 install for the session, or `org.gradle.java.home` in `~/.gradle/gradle.properties` for permanence |
| `Windows firewall prompt for OpenJDK Platform binary` | Allow — DevAuth binds 127.0.0.1:3000 for the OAuth callback. Blocking it kills the OAuth redirect |
| `[Wiiwho] Mixin hello` appears with `?` or `�` between "hello" and "Minecraft" | Harmless Windows `PrintStream` mojibake — `System.out` uses CP1252 on Windows, log4j writes the CP1252 byte `0x97` as the invalid-UTF8 replacement. The Mixin hook fired correctly; the line's presence (grep for `[Wiiwho] Mixin hello`) is the signal, not the em-dash byte |
| `UnsatisfiedLinkError: lwjgl64.dll` | Delete `client-mod/.gradle/loom-cache/` and re-run — a corrupted LWJGL native unpack |
| 30s pause at launch | Windows Defender scanning — add `client-mod/` as a Defender exclusion |
| `class file has wrong version 61.0, should be 52.0` | Gradle is compiling Minecraft's sources with JDK 17. Confirm `java { toolchain.languageVersion.set(JavaLanguageVersion.of(8)) }` is still in `build.gradle.kts` (Plan 01-01 + 01-02 wired this) |
| `[Wiiwho] Mixin hello` missing from log entirely | `mixins.wiiwho.json` `client` array must contain `"MixinMinecraft"`; grep `client-mod/src/main/resources/mixins.wiiwho.json` for `MixinMinecraft`. Also check for legacy template package names (`com.example`, `example.examplemod`) — Plan 01-01 rename incomplete (RESEARCH Pitfall 3) |

### 6. What was verified on 2026-04-20

- Owner logged into `Wiiwho` MS account; Forge `Setting user: Wiiwho`, chat `<Wiiwho> yo`
- 4 mods loaded: `mcp, FML, Forge, wiiwho`
- `[Wiiwho] Mixin hello � Minecraft.startGame hooked` in `client-mod/run/logs/latest.log` (em-dash mojibake — see Troubleshooting)
- `%USERPROFILE%\.devauth\microsoft_accounts.json` created
- **Anticheat safety bonus:** connected to `geo.minemen.club` (NA Practice lobby, runs Vanicheat/custom anticheat), chatted publicly as `Wiiwho` without kick — proves the `@Inject HEAD Minecraft.startGame` hook is anticheat-safe at the minimum baseline

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
