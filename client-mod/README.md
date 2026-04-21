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
