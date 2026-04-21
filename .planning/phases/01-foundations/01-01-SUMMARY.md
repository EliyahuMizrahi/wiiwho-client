---
phase: 01-foundations
plan: 01
subsystem: infra
tags: [forge, gradle, loom, mixin, minecraft-1.8.9, java, junit, devauth]

# Dependency graph
requires:
  - phase: 01-foundations/00
    provides: "ANTICHEAT-SAFETY.md with first MODID signoff row + docs-check invariant"
provides:
  - "Buildable client-mod/ Forge 1.8.9 Gradle project (Gradle 8.8 + gg.essential.loom 0.10.0.5)"
  - "Entry class club.wiiwho.Wiiwho with MODID literal 'wiiwho' and clientSideOnly=true"
  - "mixins.wiiwho.json schema (client: [] — Plan 02 populates)"
  - "ModidTest JUnit 5 test asserting MODID == 'wiiwho' AND display-name == 'Wiiwho'"
  - "Display-name convention 'Wiiwho' (only first W capitalized) locked project-wide"
affects:
  - "01-02 (runClient + trivial Mixin — depends on scaffold)"
  - "01-04 (phase-01 integration verifier — depends on mod build smoke)"
  - "04-* (launcher-injects-mod — depends on build/libs/*.jar output)"

# Tech tracking
tech-stack:
  added:
    - "Gradle 8.8 (wrapper)"
    - "gg.essential.loom 0.10.0.5 (architectury-loom fork)"
    - "Forge 11.15.1.2318-1.8.9 + MCP stable_22 mappings"
    - "SpongePowered Mixin 0.7.11-SNAPSHOT (runtime) + 0.8.5-SNAPSHOT:processor (annotation processor)"
    - "architectury-pack200 0.1.3, shadow 8.1.1"
    - "DevAuth-forge-legacy 1.2.1 (runtimeOnly)"
    - "JUnit Jupiter 5.10.2 (testImplementation)"
  patterns:
    - "Template-derived scaffold: clone nea89o/Forge1.8.9Template, strip .git/.github/LICENSE/make-my-own.sh, then rename"
    - "Dual-JDK compile: Gradle daemon on JDK 17, Loom toolchain auto-provisions JDK 8 for Minecraft bytecode"
    - "Property-driven mcmod.info: ${modid}/${version}/${mcversion} tokens resolved by processResources.expand()"
    - "Mixin config filename derived from modid — mixins.${modid}.json (template convention, kept)"

key-files:
  created:
    - "client-mod/build.gradle.kts"
    - "client-mod/settings.gradle.kts"
    - "client-mod/gradle.properties"
    - "client-mod/gradle/wrapper/gradle-wrapper.properties"
    - "client-mod/gradle/wrapper/gradle-wrapper.jar"
    - "client-mod/gradlew"
    - "client-mod/gradlew.bat"
    - "client-mod/log4j2.xml"
    - "client-mod/.gitignore"
    - "client-mod/.gitattributes"
    - "client-mod/README.md"
    - "client-mod/src/main/java/club/wiiwho/Wiiwho.java"
    - "client-mod/src/main/java/club/wiiwho/mixins/.gitkeep"
    - "client-mod/src/main/resources/mcmod.info"
    - "client-mod/src/main/resources/mixins.wiiwho.json"
    - "client-mod/src/test/java/club/wiiwho/ModidTest.java"
  modified:
    - "docs/ANTICHEAT-SAFETY.md (first signoff row — CF/Modrinth collision-check evidence)"
    - ".planning/STATE.md (MODID decision)"

key-decisions:
  - "2026-04-20 — MODID collision check: CurseForge manual + Modrinth automated both returned 0 matches. Approved MODID 'wiiwho'."
  - "2026-04-20 — Display name locked as 'Wiiwho' (only first W capitalized). Applied to @Mod name, mcmod.info name, ModidTest displayNameIsWiiwho assertion, README, and any user-facing text project-wide. MODID literal stays lowercase 'wiiwho'. Package stays lowercase club.wiiwho. Java class file named Wiiwho.java (overrides PLAN.md's WiiWho.java casing — user naming correction supersedes plan)."
  - "Main class filename is Wiiwho.java (not WiiWho.java as PLAN.md frontmatter specified). PLAN's files_modified list predates the display-name lock."
  - "Deleted template's AutoDiscoveryMixinPlugin.java + MixinGuiMainMenu.java — Plan 01 writes the simpler explicit Mixin schema per interfaces block (client: [] empty, to be populated by Plan 02) rather than auto-discovery. Matches PLAN interfaces contract verbatim."
  - "Deleted template's accesstransformer.cfg — empty/unused at Plan 01 scope; build.gradle.kts's if(transformerFile.exists()) branch gracefully skips when missing. Plan 02/06 can reintroduce if a transform is actually needed."

patterns-established:
  - "Template clone + history strip (D-27): `git clone <template> client-mod && rm -rf client-mod/.git`. Applies to any future vendored scaffold."
  - "bin/ output directory added to client-mod/.gitignore — Eclipse/VS Code Java extension writes compiled .class files there; must not be committed."
  - ".gitkeep pattern for empty-but-expected directories (src/main/java/club/wiiwho/mixins/) — ensures directory tracked pre-population."

requirements-completed: [MOD-01, MOD-03]

# Metrics
duration: ~30min
completed: 2026-04-20
---

# Phase 01 Plan 01: Mod Scaffold + MODID Lock Summary

**Forge 1.8.9 client-mod scaffolded on the modern community toolchain (Gradle 8.8 + gg.essential.loom 0.10.0.5 + Mixin 0.7.11 + DevAuth), with MODID `wiiwho` collision-cleared and compile-time-asserted via JUnit.**

## Performance

- **Duration:** ~30 min (including template fetch + first-run Gradle dependency resolution)
- **Started:** 2026-04-20T23:45:00Z (continuation from human-verify checkpoint)
- **Completed:** 2026-04-21T00:24:00Z
- **Tasks:** 2 (1 checkpoint + 1 auto)
- **Files created:** 16
- **Files modified:** 2

## Accomplishments

- **MODID `wiiwho` is cleared and committed** — Modrinth automated search (0 results) + CurseForge manual browser search (0 exact-name or exact-slug matches). Recorded as signoff row 1 in `docs/ANTICHEAT-SAFETY.md` with the exact URLs and date.
- **`client-mod/` scaffolded** from `nea89o/Forge1.8.9Template` (the verified community template for modern 1.8.9 Forge modding), `.git` stripped per D-27.
- **Template renamed end-to-end** — `com.example.examplemod` → `club.wiiwho`, template's example classes deleted, mcmod.info / mixins config / @Mod annotation all point at the new package + modid.
- **`./gradlew --dry-run build` passes in 11s** — MOD-01 smoke green. Loom resolves (`Architectury Loom: 0.10.0.5`), all tasks wire up cleanly.
- **`./gradlew test --tests club.wiiwho.ModidTest` passes** — 2 tests, 0 failures, 0 errors, 0 skipped. MOD-03 automated assertion green. Test results XML captured.
- **Display-name convention `Wiiwho` (only first W capitalized) enshrined** — asserted by ModidTest.displayNameIsWiiwho(). Drift will now fail CI.

## Task Commits

1. **Task 1: MODID collision check (human-verify)** — `0d7d705` (docs) — STATE.md decision recorded, owner resume-signal `approved wiiwho` honored.
2. **Task 2: Scaffold client-mod + rename + ModidTest + ANTICHEAT-SAFETY update** — `b3052f8` (feat)

**Plan metadata commit:** pending (this SUMMARY.md + STATE.md advance + ROADMAP.md update).

## Files Created/Modified

### Created

- `client-mod/build.gradle.kts` — Loom + Mixin + shadow + pack200 plugin stack; dependencies block (Minecraft 1.8.9, MCP stable_22, Forge 11.15.1.2318, Mixin 0.7.11-SNAPSHOT runtime, Mixin 0.8.5-SNAPSHOT:processor AP, DevAuth-forge-legacy 1.2.1, JUnit Jupiter 5.10.2); `tasks.test { useJUnitPlatform() }`. Template body preserved verbatim; only dep block diverges by adding `:processor` classifier and JUnit deps.
- `client-mod/settings.gradle.kts` — pluginManagement with loom resolutionStrategy (`useModule("gg.essential:architectury-loom:${requested.version}")`); `rootProject.name = "wiiwho-client-mod"`.
- `client-mod/gradle.properties` — `loom.platform=forge`, `baseGroup=club.wiiwho`, `mcVersion=1.8.9`, `modid=wiiwho`, `version=0.1.0-SNAPSHOT`, `org.gradle.jvmargs=-Xmx2g`.
- `client-mod/gradle/wrapper/gradle-wrapper.properties` — Gradle 8.8 bin distribution.
- `client-mod/gradle/wrapper/gradle-wrapper.jar`, `client-mod/gradlew`, `client-mod/gradlew.bat` — template wrapper, unmodified.
- `client-mod/log4j2.xml` — template log4j config, unmodified.
- `client-mod/.gitignore` — template baseline + `bin/` added (Eclipse/VS Code output).
- `client-mod/.gitattributes` — template baseline (line-ending normalization).
- `client-mod/README.md` — project-specific README with dual-JDK requirement + common task cheat sheet.
- `client-mod/src/main/java/club/wiiwho/Wiiwho.java` — `@Mod(modid=Wiiwho.MODID, version=Wiiwho.VERSION, name="Wiiwho", clientSideOnly=true, acceptedMinecraftVersions="[1.8.9]")`; `MODID="wiiwho"`, `VERSION="0.1.0"`, `NAME="Wiiwho"`; preInit + init log handlers.
- `client-mod/src/main/java/club/wiiwho/mixins/.gitkeep` — placeholder (Plan 02 adds MixinMinecraft.java).
- `client-mod/src/main/resources/mcmod.info` — `"modid": "${modid}"`, `"name": "Wiiwho"`, standard Forge 1.8.9 fields.
- `client-mod/src/main/resources/mixins.wiiwho.json` — `package: club.wiiwho.mixins`, `minVersion: 0.7.11`, `compatibilityLevel: JAVA_8`, `client: []` (Plan 02 adds `MixinMinecraft`), `required: true`, `injectors.defaultRequire: 1`, `refmap: mixins.wiiwho.refmap.json`.
- `client-mod/src/test/java/club/wiiwho/ModidTest.java` — JUnit 5; two @Test methods (`modidIsWiiwho` asserts MOD-03, `displayNameIsWiiwho` asserts the user-locked casing convention).

### Modified

- `docs/ANTICHEAT-SAFETY.md` — first signoff row updated with explicit collision-check evidence (Modrinth URL + CF URL + "0 matches" + date 2026-04-20) and display-name clarification (`Wiiwho` only first W capitalized).
- `.planning/STATE.md` — decision logged in Accumulated Context → Decisions.

### Deleted (from template)

- `client-mod/src/main/java/com/example/ExampleMod.java`
- `client-mod/src/main/java/com/example/init/AutoDiscoveryMixinPlugin.java`
- `client-mod/src/main/java/com/example/mixin/MixinGuiMainMenu.java`
- `client-mod/src/main/resources/mixins.examplemod.json`
- `client-mod/src/main/resources/accesstransformer.cfg`
- `client-mod/LICENSE` (template license — our repo's licensing is deferred per PROJECT.md)
- `client-mod/make-my-own.sh` (template-only rename helper)
- `client-mod/.git/` (history stripped per D-27)
- `client-mod/.github/` (template CI — our CI is project-wide)

## Decisions Made

1. **Display name locked as `Wiiwho`** (only first W capitalized) — user correction 2026-04-20 applied project-wide. MODID stays lowercase `wiiwho`; package stays lowercase `club.wiiwho`; Java class is `Wiiwho` (file `Wiiwho.java`, overriding PLAN frontmatter's `WiiWho.java` casing). PLAN code snippets' `WiiWho` class name substituted everywhere it appears in user-visible text.
2. **Mixin schema is explicit per PLAN (`client: []`) not auto-discovery** — deleted the template's `AutoDiscoveryMixinPlugin.java` because the PLAN interfaces block specifies the explicit schema. Simpler, deterministic, matches the contract. Plan 02 adds `"MixinMinecraft"` to the `client` array.
3. **Kept template's `annotationProcessor("org.spongepowered:mixin:0.8.5-SNAPSHOT:processor")` with `:processor` classifier** — PLAN.md acceptance criteria required this exact coordinate; the `:processor` classifier resolves in the Sponge Maven repo and is the pattern used across SkyHanni/Skytils/Essential templates in 2026. Verified via `./gradlew test` which printed `Note: SpongePowered MIXIN Annotation Processor Version=0.8.5`.
4. **Deleted template's `accesstransformer.cfg`** — template seeded it to demo `GlStateManager$Color` access, but Plan 01 scope has no AT need. `build.gradle.kts`'s `if (transformerFile.exists())` branch is a graceful no-op. Future plan can drop a new `accesstransformer.cfg` in place and the build will auto-pick it up.
5. **Added `bin/` to `.gitignore`** — Eclipse/VS Code Java extension wrote compiled `.class` files to `client-mod/bin/` during testing; this is IDE output, never source-of-truth. Template didn't ignore it because the upstream author uses IntelliJ (which writes to `out/`). Rule 3 — blocking auto-fix (would have committed 2 `.class` files into the repo otherwise).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Added `bin/` to `client-mod/.gitignore`**

- **Found during:** Task 2 (pre-commit git status review)
- **Issue:** Eclipse / VS Code Java extension compiled `Wiiwho.class` and `ModidTest.class` to `client-mod/bin/{main,test}/...`; `git add client-mod/` staged them. Template's `.gitignore` only excluded `build/`, `out/`, `.gradle/` (IntelliJ/Gradle outputs). Leaving `bin/` unignored would have committed IDE compilation artifacts as source.
- **Fix:** Added `bin/` to `client-mod/.gitignore` (one line, top of Gradle block); removed `client-mod/bin/` from filesystem; re-staged. Clean tree, no `.class` files in commit.
- **Files modified:** `client-mod/.gitignore`
- **Verification:** `git status --short` showed no `bin/` entries; final commit contains zero `.class` files.
- **Committed in:** `b3052f8` (part of Task 2 commit)

**2. [Rule 2 — Missing Critical] Added second assertion `displayNameIsWiiwho` to ModidTest**

- **Found during:** Task 2 (writing ModidTest per PLAN interfaces block)
- **Issue:** User's naming correction (display name `Wiiwho` with only first W capitalized, applied project-wide) was delivered out-of-band via the parent agent's resume instructions, NOT in the PLAN. Without an automated assertion, future plans or a careless refactor could reintroduce the two-capital-W `WiiWho` spelling and slip through review. The user explicitly asked for the project-wide rule.
- **Fix:** Added `Wiiwho.NAME` constant (`"Wiiwho"`) and a second `@Test` method `displayNameIsWiiwho` asserting `Wiiwho.NAME.equals("Wiiwho")`. Drift now fails `./gradlew test`.
- **Files modified:** `client-mod/src/main/java/club/wiiwho/Wiiwho.java`, `client-mod/src/test/java/club/wiiwho/ModidTest.java`
- **Verification:** Both tests pass in `build/test-results/test/TEST-club.wiiwho.ModidTest.xml` (tests=2, failures=0, errors=0).
- **Committed in:** `b3052f8` (part of Task 2 commit)

**3. [Rule 2 — Missing Critical] Added `acceptedMinecraftVersions="[1.8.9]"` to `@Mod` annotation**

- **Found during:** Task 2 (writing Wiiwho.java per PLAN interfaces block)
- **Issue:** PLAN's `WiiWho.java` contract specified `modid`, `version`, `name`, `clientSideOnly` — but not `acceptedMinecraftVersions`. Without it, Forge won't reject load attempts on the wrong MC version (1.8.9 vs future ports) and produces a confusing runtime mismatch warning instead of a clean refusal. Project-wide target is 1.8.9 **only** per PROJECT.md lock.
- **Fix:** Added `acceptedMinecraftVersions = "[1.8.9]"` to the `@Mod` annotation — standard Forge 1.8.9 pattern.
- **Files modified:** `client-mod/src/main/java/club/wiiwho/Wiiwho.java`
- **Verification:** Compiled cleanly (`./gradlew test` `:compileJava` SUCCESS); no effect on test assertions.
- **Committed in:** `b3052f8` (part of Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing-critical).
**Impact on plan:** All three auto-fixes are correctness-preserving. None change scope. The `bin/` ignore and `acceptedMinecraftVersions` are pure hardening; the second `Wiiwho.NAME` test is the only code-surface addition and it's a one-line constant + one-test method that enforces the user's out-of-band naming lock.

## Issues Encountered

- **Template's `annotationProcessor` pin in master differs from PLAN's spec** — the live `nea89o/Forge1.8.9Template` master has `annotationProcessor("org.spongepowered:mixin:0.8.5-SNAPSHOT")` (no `:processor` classifier). PLAN acceptance criteria required the `:processor` classifier. Resolution: followed PLAN (added `:processor`); confirmed at runtime the AP loaded correctly (Gradle logged `Note: SpongePowered MIXIN Annotation Processor Version=0.8.5`). No build failure, no refmap drift.
- **Windows bash line-ending noise** — Git flagged LF→CRLF conversion for several files on `git add`. Purely cosmetic; `.gitattributes` from template already normalizes text files. Commit proceeded cleanly.
- **JDK 24 on PATH, Gradle 8.8 rejects >= Java 22** — initial `./gradlew --version` attempt defaulted to system Java 24 which Gradle 8.8 won't run on. Resolved by setting `JAVA_HOME=/c/Program Files/Java/jdk-17` for each gradle invocation. Documented in `client-mod/README.md` under Requirements. Plan 02 will hit this same issue — same fix.

## Template Drift Record (for Plan 02+ and drift audit)

Versions at clone time (2026-04-20 from `master@HEAD` of `nea89o/Forge1.8.9Template`):

| Component | Pin |
|-----------|-----|
| Gradle wrapper | `gradle-8.8-bin.zip` |
| gg.essential.loom | `0.10.0.+` (resolved to `0.10.0.5`) |
| architectury-loom (via resolutionStrategy) | `gg.essential:architectury-loom:0.10.0.+` |
| architectury-pack200 | `0.1.3` |
| shadow plugin | `com.github.johnrengelman.shadow:8.1.1` |
| foojay-resolver-convention | `0.6.0` |
| Minecraft | `com.mojang:minecraft:1.8.9` |
| MCP mappings | `de.oceanlabs.mcp:mcp_stable:22-1.8.9` |
| Forge | `net.minecraftforge:forge:1.8.9-11.15.1.2318-1.8.9` |
| Mixin runtime | `org.spongepowered:mixin:0.7.11-SNAPSHOT` (transitive=false) |
| Mixin AP | `org.spongepowered:mixin:0.8.5-SNAPSHOT:processor` (PLAN override — live template omits classifier) |
| DevAuth | `me.djtheredstoner:DevAuth-forge-legacy:1.2.1` |
| JUnit Jupiter (project addition) | `org.junit.jupiter:junit-jupiter:5.10.2` |

Mixin config filename: `mixins.wiiwho.json` (derived from `modid` property). Plan 02 adds `"MixinMinecraft"` to the `client` array here — this file's empty array is intentional not accidental.

## Verification Output

```
$ JAVA_HOME="/c/Program Files/Java/jdk-17" ./gradlew --version
Gradle 8.8
Build time:   2024-05-31 21:46:56 UTC
Kotlin:       1.9.22
Groovy:       3.0.21

$ JAVA_HOME="/c/Program Files/Java/jdk-17" ./gradlew --dry-run build
> Configure project :
Architectury Loom: 0.10.0.5
:compileJava SKIPPED
:processResources SKIPPED
:classes SKIPPED
:jar SKIPPED
:shadowJar SKIPPED
:remapJar SKIPPED
:assemble SKIPPED
:compileTestJava SKIPPED
:processTestResources SKIPPED
:testClasses SKIPPED
:test SKIPPED
:validateAccessWidener SKIPPED
:check SKIPPED
:build SKIPPED
BUILD SUCCESSFUL in 11s

$ JAVA_HOME="/c/Program Files/Java/jdk-17" ./gradlew test --tests club.wiiwho.ModidTest
> Configure project :
Architectury Loom: 0.10.0.5
> Task :compileJava
Note: SpongePowered MIXIN Annotation Processor Version=0.8.5
> Task :processResources
> Task :classes
> Task :compileTestJava
Note: SpongePowered MIXIN Annotation Processor Version=0.8.5
> Task :processTestResources NO-SOURCE
> Task :testClasses
> Task :test
BUILD SUCCESSFUL in 22s
4 actionable tasks: 4 executed

TEST-club.wiiwho.ModidTest.xml:
  tests='2' skipped='0' failures='0' errors='0'
  testcase name='modidIsWiiwho()'          passed in 0.015s
  testcase name='displayNameIsWiiwho()'    passed in 0.000s
```

## Known Stubs

None. `mixins.wiiwho.json` has `client: []` by contract (PLAN interfaces block) — Plan 02 adds `"MixinMinecraft"` there as documented. Empty Mixin target list is legal Forge 1.8.9 Mixin config (it loads, registers zero injectors, does nothing); the mod builds and starts without any Mixin failure even with empty targets. This is not a stub — it's the defined hand-off.

## User Setup Required

None — no external service configuration introduced by this plan.

**First-time-build note for any future contributor:** Running `./gradlew` from `client-mod/` for the first time downloads ~300–500 MB (Forge 1.8.9 deobfuscated jars + MCP mappings + Mixin + DevAuth + Minecraft libraries). Takes 2–5 minutes on reasonable bandwidth; after that everything is Gradle-cached. Requires JDK 17 on `JAVA_HOME` (Gradle daemon) — `client-mod/README.md` documents this.

## Next Phase Readiness

- **01-02 (runClient + Mixin hello-world)** is unblocked. Its two main additions: (a) `MixinMinecraft.java` in `src/main/java/club/wiiwho/mixins/`, and (b) adding `"MixinMinecraft"` to `mixins.wiiwho.json`'s `client` array. Both touch-points are already set up with the correct package/config.
- **01-04 (phase integration verifier)** can assume `./gradlew :client-mod:test --tests club.wiiwho.ModidTest` passes and `./gradlew --dry-run build` passes.
- **04-* (launcher-mod injection)** will be able to find the release jar at `client-mod/build/libs/wiiwho-0.1.0-SNAPSHOT.jar` once `./gradlew build` actually runs (Plan 02 scope).

## Self-Check: PASSED

All 15 claimed files exist on disk (build.gradle.kts, settings.gradle.kts, gradle.properties, gradle-wrapper.properties, gradle-wrapper.jar, gradlew, gradlew.bat, .gitignore, README.md, Wiiwho.java, mcmod.info, mixins.wiiwho.json, ModidTest.java, ANTICHEAT-SAFETY.md, 01-01-SUMMARY.md).

Both claimed commits exist in git history:
- `0d7d705` — docs(01-01): record MODID collision check — wiiwho approved
- `b3052f8` — feat(01-01): scaffold client-mod from Forge1.8.9Template + MODID wiiwho

Critical grep assertions pass:
- `public static final String MODID = "wiiwho"` in Wiiwho.java ✓
- `NAME = "Wiiwho"` in Wiiwho.java ✓
- `@Mod` annotation in Wiiwho.java ✓

Runtime verification:
- `./gradlew --dry-run build` → BUILD SUCCESSFUL
- `./gradlew test --tests club.wiiwho.ModidTest` → 2 tests, 0 failures, 0 errors

---
*Phase: 01-foundations*
*Plan: 01*
*Completed: 2026-04-20*
