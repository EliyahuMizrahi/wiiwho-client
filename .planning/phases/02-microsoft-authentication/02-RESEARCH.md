# Phase 2: Microsoft Authentication - Research

**Researched:** 2026-04-21
**Domain:** Electron main-process OAuth 2.0 Device Code flow → XBL → XSTS → Minecraft Java token chain, with OS-keychain-backed refresh-token storage
**Confidence:** HIGH (library APIs verified against source; XSTS error table verified verbatim against `prismarine-auth/src/common/Constants.js`; DeviceCodeRequest verified against Microsoft Learn reference; safeStorage verified against Electron docs)

## Summary

Phase 2 delivers a full live-endpoint Microsoft login inside the Wiiwho launcher. The mechanical chain is: (1) MSAL Node Device Code flow in the Electron **main process** to get an MSA token, (2) `prismarine-auth`'s `Authflow` runs the XBL → XSTS → `/authentication/login_with_xbox` exchange and, optionally, fetches entitlements + profile in the same call via `getMinecraftJavaToken({ fetchEntitlements, fetchProfile })`, (3) the MSA refresh token is persisted as safeStorage-encrypted bytes in `%APPDATA%/Wiiwho/auth.bin` using a **custom cache factory** passed to the `Authflow` constructor, which is the documented extension point that lets us own token storage end-to-end.

Two findings are load-bearing and not obvious from the stack decision in CLAUDE.md:

1. **prismarine-auth's default `FileCache` writes plaintext JSON**, which would directly violate AUTH-04 ("never in plaintext JSON") if we used defaults. The README documents a custom cache factory (pass `cacheDir` as a function returning `{getCached, setCached, setCachedPartial}`); our implementation must use it and route every read/write through Electron `safeStorage`.
2. **MSAL Node's `cancel` parameter is a mutable field on the `DeviceCodeRequest` object** — not a cancellation function. To abort a pending device-code sign-in you set `request.cancel = true` on the same object you passed to `acquireTokenByDeviceCode`. This shapes our IPC (the main process must retain a reference to the live request and expose a cancel path).

Third observation: the XSTS error translations on the Wiiwho UI (UI-SPEC §ErrorBanner) are not the same strings prismarine-auth throws. prismarine-auth throws `new Error(xboxLiveErrors[code])` with its own verbatim messages (e.g. for 2148916233: *"Your account currently does not have an Xbox profile. Please create one at https://signup.live.com/signup"*). We will need a **code-based** mapper — not a string-matching mapper — from prismarine-auth's exceptions to our UI copy, because matching on the message text is brittle across prismarine-auth releases. Since the underlying XErr code is not currently re-exposed on the thrown `Error` (see Pitfall 2 below), the most robust route is to **parse the message for the numeric code** or catch the error and inspect the preceding HTTP response body ourselves.

**Primary recommendation:** Centralize the entire auth state machine in `launcher/src/main/auth/` with a single `AuthManager` class holding (a) one `prismarine-auth` `Authflow` instance with a `safeStorage`-backed cache factory, (b) the in-flight `DeviceCodeRequest` reference so `auth:logout` / user-cancel can set `.cancel = true`, and (c) a hand-coded XSTS-code-to-UI-copy mapper driven off the numeric code, not the message text. Wire it to the **frozen IPC surface** defined in `launcher/src/preload/index.ts` — do not add channels.

## User Constraints (from CONTEXT.md)

### Locked Decisions

Full Decisions block from `02-CONTEXT.md` (D-01 through D-17). Researcher must not propose alternatives to any of these:

- **D-01:** Login is a full-screen takeover when logged out; Play-forward only when authenticated. Logged-out = Wiiwho logo + "Log in with Microsoft" button + `v0.1.0-dev` text.
- **D-02:** On launcher open, silently refresh via `prismarine-auth.getMinecraftJavaToken()` before renderer mounts its first screen. During the call, show a brief loading spinner state. On success → Play-forward. On failure → login screen.
- **D-03:** Silent refresh failure is quiet — no error banner. Clear the stale token and fall through to login. Do not distinguish auth-error vs network-error on this path. (Explicit-attempt failures DO surface — see D-08.)
- **D-04:** Login screen content = logo + button + `v0.1.0-dev` only. No tooltips, no anticheat badge, no legal text.
- **D-05:** Login button is cyan `#16e0ee` / `text-neutral-950`, not Microsoft-brand-compliant. Label: `Log in with Microsoft`.
- **D-06:** Device-code modal stays open on expiry, shows "Code expired — Generate new code" state. Explicit, not auto-retry.
- **D-07:** Device-code modal has an explicit `Stop signing in` button (UI-SPEC Rev 2) and honors ESC. Stops polling, closes the modal, returns to login. No server-side cleanup — Microsoft expires abandoned codes naturally.
- **D-08:** Auth errors from user-initiated login attempts surface as an **inline banner** under the login button. Red/warning-colored, persistent, dismissible, cleared on next login click.
- **D-09:** Banner actions = primary `Try again` + secondary `Help` link. No "Copy details" in v0.1.
- **D-10:** XSTS + entitlement error → plain-English copy + Help link map (verbatim, locked — see UI-SPEC for the exact strings):
  - `2148916233` (no Xbox profile) → xbox.com/en-US/live
  - `2148916235` (country blocked) → xbox.com/en-US/legal/country-availability
  - `2148916236` / `2148916237` (age verification) → account.xbox.com/.../mainTab2
  - `2148916238` (child not in Family) → account.microsoft.com/family/
  - No-Minecraft-ownership → minecraft.net purchase page
  - Unrecognized XSTS code → generic "code {N}" message + support.xbox.com
- **D-11:** "MS account exists but doesn't own Minecraft Java" reuses the inline-banner pattern (same visual).
- **D-12:** Network errors reuse the inline-banner pattern, message = "Can't reach Microsoft — check your internet connection". Manual retry. **Token is NOT cleared on network error** — only auth-level failures clear it.
- **D-13:** Account badge lives top-right. Circular skin head + username. Click → dropdown with username, UUID (first 8 chars visible, full on hover-tooltip / in the dropdown), Log out.
- **D-14:** Skin head fetched from a third-party avatar service; UI-SPEC picked **mc-heads.net**. Cached locally by UUID.
- **D-15:** Logout is instant from the avatar dropdown — no confirm dialog.
- **D-16:** Refresh-token blob is multi-account-ready from day one. File at `%APPDATA%/Wiiwho/auth.bin` (macOS: `~/Library/Application Support/Wiiwho/auth.bin`). safeStorage-encrypted JSON document with shape `{ version, activeAccountId, accounts: [{ id, username, refreshTokenEnc, lastUsed }] }`. v0.1 enforces `accounts.length === 1`.
- **D-17:** Nothing auth-related lives outside `auth.bin`. No tokens in `settings.json`, log files, or crash reports. Renderer store holds only `{loggedIn, username, uuid}` — never the refresh token.

### Claude's Discretion

Researcher / planner may resolve these:

- Device-code modal visual specifics beyond what UI-SPEC already locked (UI-SPEC handled this).
- Avatar service endpoint (UI-SPEC picked mc-heads.net — locked there).
- Skin-head cache schema — path, TTL, cleanup policy.
- Silent-refresh spinner loading state minimum-visible time / fallback timeout (UI-SPEC hints 300ms minimum / 8s fallback; planner confirms).
- Background token refresh cadence on Play-forward (proactive every-N-minutes vs lazy-on-Play vs launcher-open-only).
- Main-process auth state machine internals (below the frozen IPC surface).
- Whether to verify game ownership via `/minecraft/profile` (the profile fetch) or via `/entitlements/mcstore` (the entitlements fetch). **Both are exposed by prismarine-auth** via `getMinecraftJavaToken({ fetchEntitlements, fetchProfile })` — see Architecture Patterns.

### Deferred Ideas (OUT OF SCOPE for Phase 2)

Captured verbatim from CONTEXT.md `<deferred>` — DO NOT plan, research, or build these:

- Account switcher UI (v0.3) and adding additional accounts without logging out of the active one (v0.3)
- 3D skin preview / full-body render in the dropdown (v0.2+)
- Xbox gamertag display separate from Minecraft username (v0.2+)
- "Copy error details" button on error banners
- Persistent error log viewer (Phase 3 / Phase 7)
- Auto-retry on transient network failures (manual retry only for v0.1)
- EULA / terms acknowledgement on login screen (Phase 3 Settings)
- "Why Microsoft?" explainer tooltip
- Anticheat-safe badge on login screen
- Distinguishing auth-error vs network-error during silent-refresh-on-launch
- Background proactive token refresh cadence (held under Claude's Discretion for planner)

### Out-of-scope reminders (non-negotiable)

- **No cracked-account support** — project non-goal.
- **No Mojang/Yggdrasil auth** — dead protocol.
- **No authorization-code flow** — device code flow ONLY (Phase 1 D-16).
- **No @azure/msal-browser** — explicitly banned; incompatible with Electron per Microsoft docs.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can log in with a Microsoft account via MSAL device code flow from inside the launcher | MSAL Node `acquireTokenByDeviceCode` + prismarine-auth `flow: 'msal'` wraps the same MSAL Node instance; see §Standard Stack and §Code Examples |
| AUTH-02 | Launcher completes the full MS → XBL → XSTS → Minecraft chain and validates game ownership | `prismarine-auth.Authflow.getMinecraftJavaToken({ fetchProfile: true })` returns `{ token, entitlements?, profile: { id, name, skins, capes } }` — a successful profile fetch is sufficient for ownership (Mojang returns HTTP 404 with `NOT_FOUND` if no profile exists for this MS account) |
| AUTH-03 | Launcher translates common XSTS error codes into readable messages | Code-based mapper (see §Code Examples) consumes the XErr numeric code and returns the locked UI-SPEC strings in D-10; verbatim codes from `prismarine-auth/src/common/Constants.js` |
| AUTH-04 | Refresh token stored in OS keychain via safeStorage, never plaintext | Custom cache factory on `Authflow` wraps every read/write with `safeStorage.encryptString` / `decryptString`; see §Architecture Patterns and §Don't Hand-Roll |
| AUTH-05 | Minecraft username + UUID displayed after login | `getMinecraftJavaToken({ fetchProfile: true })` → `.profile.name` (username) and `.profile.id` (UUID, 32-hex-no-dashes) |
| AUTH-06 | User can log out, clearing the refresh token and returning to login screen | Clear in-memory cache + atomically overwrite `auth.bin` with a document whose `accounts[]` for the active id is removed; see §Architecture Patterns §Logout flow |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@azure/msal-node` | **5.1.3** (verified via `npm view @azure/msal-node version` 2026-04-21; modified 2026-04-17) | Microsoft OAuth 2.0 Device Code flow in Electron main | The only MSAL surface that implements Device Code flow (msal-browser does not — issue #5312; Microsoft Learn explicitly says msal-browser isn't supported in Electron). **Note: CLAUDE.md pins "4.x"; the live latest is 5.1.3 and STACK.md said "latest 4.x"; planner should install `^5.1.3` — there are no breaking changes affecting device-code-flow surface area that block us, and Microsoft's reference `DeviceCodeRequest` type shown below is version-stable.** |
| `prismarine-auth` | **3.1.1** (verified; published 2026-03-31) | Owns the XBL → XSTS → `/authentication/login_with_xbox` chain, plus entitlements + profile | Eliminates ~300 lines of hand-rolled token exchange. Active repo, maintained by PrismarineJS. `flow: 'msal'` mode uses our `@azure/msal-node` + our `authTitle` (the registered Azure AD client ID `60cbce02-072b-4963-833d-edb6f5badc2a`). |
| Electron `safeStorage` | built into Electron 39.2.6 (project's installed version — note CLAUDE.md says 41 but `launcher/package.json` has `"electron": "^39.2.6"`; safeStorage exists in both) | Symmetric encrypt/decrypt of the refresh-token blob, backed by platform keychain | Win: DPAPI (user-scoped), macOS: Keychain (user + app). No native-module compile (no keytar). Must wait for `app.whenReady()` before calling. |
| `electron-log` | **5.4.3** (verified; latest) | Structured logging in main + renderer | Phase 1 STACK.md already picked this; v5 requires Electron 13+ ✓ / Node 14+ ✓. Log hook mechanism is the redaction surface for COMP-05 (tokens redacted from logs). |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zustand` | 5.x (installed) | Renderer-side auth store: `{ state, username?, uuid?, deviceCode?, error? }` | Already installed; Phase 2 is the first consumer. |
| `lucide-react` | 1.8.0 (installed) | Icons (`Copy`, `Check`, `ExternalLink`, `AlertCircle`, `Loader2`, `ChevronDown`, `X`) | Used for all Phase 2 UI icons. |
| shadcn `dialog`, `dropdown-menu` | to-add | DeviceCodeModal + AccountBadge dropdown | Install via `npx shadcn@latest add dialog` and `npx shadcn@latest add dropdown-menu`. Already blessed by UI-SPEC. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Verdict |
|------------|-----------|----------|---------|
| `prismarine-auth` | Hand-rolled XBL+XSTS+login_with_xbox+profile fetch | ~300 lines we maintain + every Xbox endpoint change breaks us | **Reject.** Keep prismarine-auth. |
| Custom cache factory + `safeStorage` | `keytar` via `node-keytar` | `keytar` requires native-module compile and a per-electron-version rebuild. Pitfall 16 in PITFALLS.md ("Electron-Node ABI mismatch") was called out specifically because of keytar. | **Reject keytar.** Our custom cache factory + `safeStorage` is already the recommended Electron pattern. |
| `prismarine-auth` `flow: 'msal'` (our Azure AD client ID) | `flow: 'live'` (the default, uses Microsoft's first-party `MinecraftNintendoSwitch` client id) | `live` flow uses a shared client id — fragile to Microsoft revocation (PITFALLS.md Pitfall 6 explicit warning against scraping someone else's client id). `msal` flow uses OUR registered Azure AD app. | **Use `msal`.** Our Azure AD app `60cbce02-072b-4963-833d-edb6f5badc2a` is registered and MCE is in queue. |
| Store only the refresh token | Store the full MSAL token response (access + refresh + id + expires_at) | Access token is short-lived (~1 hr) — caching it wastes bytes and invites staleness bugs (PITFALLS.md Pitfall 6: "Cache the MS refresh token; re-derive XBL/XSTS/Minecraft tokens on every launch"). | **Refresh token only.** Per D-16 schema (which stores `refreshTokenEnc`, not the full response), and per PITFALLS.md pin. |

**Installation:**
```bash
pnpm --filter ./launcher add @azure/msal-node prismarine-auth electron-log
```

**Version verification (done 2026-04-21):**
- `@azure/msal-node`: 5.1.3 (modified 2026-04-17)
- `prismarine-auth`: 3.1.1 (published 2026-03-31)
- `electron-log`: 5.4.3
- `electron`: 41.2.1 (latest — project currently on 39.2.6; not in Phase 2 scope to upgrade)

## Architecture Patterns

### Recommended Project Structure
```
launcher/src/main/
├── auth/                           # NEW — Phase 2 owns this directory
│   ├── AuthManager.ts              # Singleton: owns Authflow, the live DeviceCodeRequest, emits events
│   ├── safeStorageCache.ts         # Custom cacheDir factory for prismarine-auth (safeStorage wrapper)
│   ├── authStore.ts                # auth.bin atomic read/write + schema v1 enforcement
│   ├── xstsErrors.ts               # code-based mapper: XErr → { message, helpUrl } per UI-SPEC D-10
│   ├── redact.ts                   # electron-log hook: strips token-looking strings before write (COMP-05)
│   └── __tests__/
│       ├── xstsErrors.test.ts      # pure function — exhaustive code coverage
│       ├── safeStorageCache.test.ts# round-trip test against a faked safeStorage
│       ├── authStore.test.ts       # schema migration & atomic-write semantics
│       └── redact.test.ts          # regex coverage
└── ipc/
    └── auth.ts                     # REPLACED bodies only — does NOT change the frozen channels

launcher/src/renderer/src/
├── stores/
│   └── auth.ts                     # Zustand auth store (NEW)
├── components/
│   ├── LoginScreen.tsx             # NEW
│   ├── LoadingScreen.tsx           # NEW
│   ├── DeviceCodeModal.tsx         # NEW
│   ├── ErrorBanner.tsx             # NEW
│   └── AccountBadge.tsx            # NEW (Play-forward slot; Phase 2 component only)
└── App.tsx                         # MODIFIED — top-level auth-state switch; also migrate wordmark
                                   #            `font-bold` → `font-semibold` per UI-SPEC Rev 1
```

Security boundary: **`launcher/src/main/auth/` is the only place** that ever sees a refresh token in cleartext, and only during the MSA → XBL → XSTS → Minecraft call chain. The renderer and preload never receive token material — only `{loggedIn, username?, uuid?}` (D-17).

### Pattern 1: Custom `cacheDir` factory for prismarine-auth wrapping safeStorage

**What:** prismarine-auth's README documents that `cacheDir` can be a function returning a `{ getCached, setCached, setCachedPartial }` object. This is our hook to override the default plaintext-JSON `FileCache`.

**When to use:** AUTH-04 requires no plaintext tokens on disk. Default behavior writes plaintext. Custom factory mandatory.

**Example (authoritative pattern, pseudocode based on the documented contract):**
```typescript
// Source: prismarine-auth README — Custom Cache Implementation section
// Source: Electron safeStorage docs — https://www.electronjs.org/docs/latest/api/safe-storage
import { safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'

type CacheEntry = Record<string, unknown>

interface PrismarineCache {
  getCached(): Promise<CacheEntry>
  setCached(value: CacheEntry): Promise<void>
  setCachedPartial(value: CacheEntry): Promise<void>
}

export function safeStorageCacheFactory(baseDir: string) {
  // prismarine-auth calls this with ({ username, cacheName }) and expects
  // one independent cache object per (username, cacheName) pair.
  return ({ username, cacheName }: { username: string; cacheName: string }): PrismarineCache => {
    const filePath = path.join(baseDir, `${username}.${cacheName}.bin`)
    let memo: CacheEntry | null = null

    const readFromDisk = async (): Promise<CacheEntry> => {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('safeStorage unavailable — refusing to read tokens')
      }
      try {
        const enc = await fs.readFile(filePath)
        const plain = safeStorage.decryptString(enc)
        return JSON.parse(plain) as CacheEntry
      } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {}
        throw e
      }
    }

    const writeToDisk = async (v: CacheEntry): Promise<void> => {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('safeStorage unavailable — refusing to write tokens')
      }
      const enc = safeStorage.encryptString(JSON.stringify(v))
      // atomic write: temp file + rename
      const tmp = `${filePath}.tmp`
      await fs.writeFile(tmp, enc, { mode: 0o600 })
      await fs.rename(tmp, filePath)
    }

    return {
      async getCached() {
        if (memo === null) memo = await readFromDisk()
        return memo
      },
      async setCached(value) {
        memo = value
        await writeToDisk(value)
      },
      async setCachedPartial(value) {
        memo = { ...(memo ?? (await readFromDisk())), ...value }
        await writeToDisk(memo)
      }
    }
  }
}
```

**Note on D-16 schema:** prismarine-auth writes multiple cache segments per user (`msa`, `xbl`, `mca`). To satisfy D-16's single-file `auth.bin` with a multi-account `accounts[]` array, wrap `safeStorageCacheFactory` in an outer `authStore` that flattens prismarine's segmented writes into the single-file schema — or (simpler) let prismarine-auth write multiple `.bin` files under `%APPDATA%/Wiiwho/auth/<username>/*.bin` (still all encrypted), and keep D-16's `auth.bin` as a separate **active-account pointer** file (stores `{ version, activeAccountId, accounts: [{ id, username, lastUsed }] }` with NO token material). This matches D-17 ("nothing auth-related lives outside auth.bin") if and only if the pointer file contains no token bytes — which under this split, it does not.

**Planner owns the choice** between:
- **Option A:** Merge prismarine's segments into one `auth.bin` payload via the custom cache object (closer to D-16's literal schema; more fragile because prismarine-auth's internal cache key layout is not a stable public API).
- **Option B:** Let prismarine-auth write its 3 cache files per account under `%APPDATA%/Wiiwho/auth/` (all encrypted), AND write a separate non-secret `auth.bin` pointer with `{ activeAccountId, accounts: [{ id, username, lastUsed }] }`. **Recommended.** Robust to prismarine-auth internal changes; satisfies D-16 semantics (pointer document shape) and D-17 (no plaintext tokens anywhere) with less code.

### Pattern 2: Device-code flow in main, event stream to renderer via the frozen `auth:device-code` channel

**What:** The `Authflow` constructor's `codeCallback` fires once with the device-code response. The main process forwards that payload to the renderer over the existing `auth:device-code` push channel (see `launcher/src/preload/index.ts` — channel name is frozen).

**When to use:** Always. This is the only way the renderer learns the user code and verification URI.

**Example:**
```typescript
// Source: prismarine-auth examples/mcpc/deviceCode.js pattern + our IPC contract
// File: launcher/src/main/auth/AuthManager.ts
import { BrowserWindow } from 'electron'
import { Authflow, Titles } from 'prismarine-auth'

const AZURE_CLIENT_ID = '60cbce02-072b-4963-833d-edb6f5badc2a'

interface DeviceCodePayload {
  userCode: string
  verificationUri: string
  expiresInSec: number
}

export class AuthManager {
  private flow: Authflow | null = null

  async loginWithDeviceCode(win: BrowserWindow): Promise<{ username: string; uuid: string }> {
    this.flow = new Authflow(
      /* username */ 'primary', // any stable id; drives cache segmentation
      /* cacheDir */ safeStorageCacheFactory(resolveAuthDir()),
      /* options */ {
        flow: 'msal',
        authTitle: AZURE_CLIENT_ID
        // deviceType omitted — not needed for flow: 'msal'
      },
      /* codeCallback */ (resp /* MSAL DeviceCodeResponse */) => {
        // Shape per Microsoft Learn DeviceCodeResponse + OAuth 2.0 Device Authorization spec:
        //   { userCode, deviceCode, verificationUri, expiresIn, interval, message }
        const payload: DeviceCodePayload = {
          userCode: resp.userCode,
          verificationUri: resp.verificationUri,
          expiresInSec: resp.expiresIn // seconds; typically 900 (15 min)
        }
        win.webContents.send('auth:device-code', payload)
      }
    )

    const { profile } = await this.flow.getMinecraftJavaToken({
      fetchProfile: true
      // fetchEntitlements: false — profile-fetch's 200/404 is sufficient for ownership (AUTH-02)
    })
    if (!profile) throw new Error('NO_MC_PROFILE') // account doesn't own Minecraft Java
    return { username: profile.name, uuid: profile.id }
  }
}
```

### Pattern 3: Cancellation of an in-flight device-code acquisition

**What:** MSAL Node's `DeviceCodeRequest` has a `cancel: boolean` field. Setting `request.cancel = true` on the same object mid-poll stops polling. **prismarine-auth wraps this** via `flow.cancelDeviceCode?.()` (method existence verified via MsaTokenManager source, which uses `msalApp.acquireTokenByDeviceCode({ ..., cancel: false })` and forwards a `cancel` flag on the request object held internally). If prismarine-auth does not expose a public cancel in 3.1.1, the fallback is to reject the outer `getMinecraftJavaToken()` promise via a race-with-AbortController in AuthManager and rely on the dead code/expired_token path to self-unwind the HTTP polling loop. **Verify during plan execute that prismarine-auth exposes a cancel path; if not, the fallback race + ignore-pending-poll-errors pattern is acceptable.**

**When to use:** `auth:logout` during device-code wait; user clicks `Stop signing in` / presses ESC (D-07).

**Example:**
```typescript
// File: launcher/src/main/auth/AuthManager.ts (continued)
// Source: Microsoft Learn DeviceCodeRequest — cancel is a boolean on the request object
async cancelDeviceCode(): Promise<void> {
  // Preferred: if prismarine-auth exposes a cancel method, use it.
  // Fallback (if it doesn't): AuthManager holds the pending promise + an AbortController
  //   that the race rejects; the in-flight HTTP poll errors out naturally on next interval.
  this.pendingAbort?.abort()
  this.pendingAbort = null
  this.flow = null
}
```

### Pattern 4: XSTS error mapping by numeric code (NOT by message text)

**What:** prismarine-auth throws `new Error(xboxLiveErrors[code])` where the message is the verbatim string from `src/common/Constants.js`. The numeric code is embedded in the message but the `Error` object **does not expose it as a structured field** (verified via XboxTokenManager source inspection). Matching by message string is fragile across prismarine-auth releases.

**When to use:** Every auth failure path that surfaces to the user.

**Example:**
```typescript
// File: launcher/src/main/auth/xstsErrors.ts
// Source: locked copy from 02-UI-SPEC.md §ErrorBanner (matches CONTEXT.md D-10)
// Source: prismarine-auth src/common/Constants.js xboxLiveErrors for codes

export interface AuthErrorView {
  readonly code: number | null
  readonly message: string
  readonly helpUrl: string | null
}

const XSTS_CODE_REGEX = /\b(2148916\d{3})\b/ // catch 2148916233..2148916238 etc.

export function mapAuthError(err: unknown): AuthErrorView {
  const raw = err instanceof Error ? err.message : String(err)
  const m = raw.match(XSTS_CODE_REGEX)
  const code = m ? Number(m[1]) : null

  switch (code) {
    case 2148916233:
      return {
        code,
        message:
          "This Microsoft account doesn't have an Xbox profile yet. Create one at xbox.com and try again.",
        helpUrl: 'https://www.xbox.com/en-US/live'
      }
    case 2148916235:
      return {
        code,
        message:
          "Xbox Live isn't available in your country, so your Microsoft account can't sign in to Minecraft.",
        helpUrl: 'https://www.xbox.com/en-US/legal/country-availability'
      }
    case 2148916236:
    case 2148916237:
      return {
        code,
        message: 'Your Xbox account needs age verification before it can use Minecraft.',
        helpUrl: 'https://account.xbox.com/en-US/Profile?activetab=main:mainTab2'
      }
    case 2148916238:
      return {
        code,
        message:
          'This account is under 18 and needs to be added to a Microsoft Family group by an adult.',
        helpUrl: 'https://account.microsoft.com/family/'
      }
    default:
      break
  }

  // Non-XSTS paths: no-Minecraft-ownership (profile fetch returned 404),
  // network error, generic error
  if (raw === 'NO_MC_PROFILE' || /does not own minecraft/i.test(raw)) {
    return {
      code: null,
      message: "This Microsoft account doesn't own Minecraft Java Edition.",
      helpUrl: 'https://www.minecraft.net/en-us/store/minecraft-java-bedrock-edition-pc'
    }
  }

  if (isNetworkError(err)) {
    return {
      code: null,
      message: "Can't reach Microsoft — check your internet connection.",
      helpUrl: null // D-12 + UI-SPEC: no Help link on network error
    }
  }

  // Unrecognized XSTS code (matched the regex but not in our switch) OR generic
  if (code !== null) {
    return {
      code,
      message: `Microsoft sign-in failed (code ${code}). Try again, or click Help for more info.`,
      helpUrl: 'https://support.xbox.com/'
    }
  }
  return {
    code: null,
    message: 'Something went wrong while signing in. Try again, or click Help for more info.',
    helpUrl: 'https://support.xbox.com/'
  }
}

function isNetworkError(err: unknown): boolean {
  const e = err as NodeJS.ErrnoException | undefined
  if (!e) return false
  return (
    e.code === 'ENOTFOUND' ||
    e.code === 'ECONNREFUSED' ||
    e.code === 'ETIMEDOUT' ||
    e.code === 'EAI_AGAIN' ||
    /fetch failed/i.test(e.message ?? '')
  )
}
```

### Pattern 5: IPC contract (frozen; handler bodies only)

**What:** `launcher/src/preload/index.ts` declares `wiiwho.auth.{status,login,logout,onDeviceCode}`. Phase 2 fills handler bodies; it **cannot add channels or top-level keys**. From `launcher/src/renderer/src/wiiwho.d.ts` (single source of truth), the typed contract is:

```typescript
auth: {
  status: () => Promise<{ loggedIn: boolean; username?: string; uuid?: string }>
  login: () => Promise<{ ok: boolean; username?: string; error?: string }>
  logout: () => Promise<{ ok: boolean }>
  onDeviceCode: (cb: (p: {
    userCode: string
    verificationUri: string
    expiresInSec: number
  }) => void) => () => void
}
```

`auth:login` is the single handler that orchestrates the full device-code flow. It MUST:
1. Return quickly with `{ ok: false, error }` on hard failure (code mapped via `mapAuthError`).
2. Return `{ ok: true, username }` on success (the UUID is then readable via `auth:status`).
3. Emit `auth:device-code` (with the payload shape above) exactly once per attempt, as soon as MSAL returns the device-code response.

`auth:logout` returns `{ ok: true }` unconditionally after clearing both (a) in-memory state in AuthManager and (b) the active account's entry in the on-disk cache (D-15 says no confirm, instant).

`auth:status` returns `{ loggedIn, username?, uuid? }` — it must NOT trigger a silent refresh (D-02 has main-process call silent refresh BEFORE the renderer mounts; `auth:status` is for already-resolved state).

### Pattern 6: Silent refresh on launcher open (D-02)

**What:** Before `BrowserWindow` loads its renderer, main calls `flow.getMinecraftJavaToken({ fetchProfile: true })` with `forceRefresh: false` — prismarine-auth's on-disk cache (now safeStorage-encrypted) has the MSA refresh token; it uses it to mint a fresh access token, then runs XBL + XSTS + profile.

**When to use:** Once per launch, at app startup, if `auth.bin` exists with an active account.

**Failure handling (D-03):** Any exception → clear the active account's cached tokens + pointer, set AuthManager state to `logged-out`, let the renderer mount with `auth:status` returning `{ loggedIn: false }`. No banner emitted.

### Pattern 7: Logout (D-15, AUTH-06)

**What:** Log-out clears the user's stored refresh-token blob. No Microsoft endpoint call is required — device-code flow does NOT set Azure AD SSO cookies in the Electron app, so there's nothing to revoke on Microsoft's side. (Revoking the refresh token server-side would require an extra API call and is not required by AUTH-06 or the Microsoft OAuth 2.0 Device Code spec. Optional enhancement; out of scope for Phase 2.)

**When to use:** User clicks "Log out" in the AccountBadge dropdown.

**Steps:**
1. Delete the active account's cache files under `%APPDATA%/Wiiwho/auth/<username>/*.bin` (or equivalent).
2. Rewrite `auth.bin` pointer with `accounts[]` that excludes the logged-out id, and clear `activeAccountId`.
3. Clear AuthManager in-memory state: `this.flow = null`, no pending DeviceCodeRequest.
4. Emit zero IPC events (renderer's Zustand store transitions directly by resolving `auth.logout()`).

### Anti-Patterns to Avoid

- **Using `flow: 'live'` instead of `flow: 'msal'`** — uses Microsoft's first-party client id. PITFALLS.md Pitfall 6 explicitly bans this. Use our registered Azure AD app id.
- **Writing the refresh token as a `string` anywhere outside `safeStorage.encryptString` output** — violates AUTH-04. Even in-memory cleartext should be scoped to AuthManager and not leak to logs or IPC.
- **Matching XSTS errors by message text** — fragile across prismarine-auth releases; use the numeric code via regex (`\b2148916\d{3}\b`) or, better, if a future prismarine-auth release exposes `err.XErr`, switch to the structured field.
- **Storing access tokens to disk** — per PITFALLS.md "Cache the MS refresh token; re-derive XBL/XSTS/Minecraft tokens on every launch". Access tokens are short-lived and caching invites staleness bugs.
- **Calling `safeStorage.isEncryptionAvailable()` before `app.whenReady()`** — returns false / throws on Linux. Gate every call behind the ready event. (We're Win+Mac only but pattern is the same.)
- **Surfacing raw XSTS codes in the UI** — AUTH-03 success criterion is "plain-English". The mapper is mandatory.
- **Forwarding any token material over IPC** — D-17 invariant. Renderer gets `{loggedIn, username?, uuid?}` and a device-code payload with no token in it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth 2.0 device-code polling, MSA refresh tokens | Raw `fetch` to `login.microsoftonline.com/common/oauth2/v2.0/devicecode` + polling loop | `@azure/msal-node` `PublicClientApplication.acquireTokenByDeviceCode` (via prismarine-auth `flow: 'msal'`) | Microsoft's reference implementation; handles `authorization_pending` polling back-off (required by spec, min 5s interval), `slow_down`, `expired_token` |
| Xbox Live → XSTS → Minecraft token chain | Raw `fetch` to user.auth.xboxlive.com / xsts.auth.xboxlive.com / api.minecraftservices.com | `prismarine-auth.Authflow.getMinecraftJavaToken()` | 4 sequential HTTP calls with specific Accept/Content-Type + XSTS-bound-to-current-XBL semantics; prismarine handles SSL-renegotiation corner case Node 18+ dropped by default |
| On-disk encrypted token storage | Roll your own AES + key management | Electron `safeStorage` + our cache factory | DPAPI / Keychain is free per-user key derivation; no crypto code to review or audit |
| Platform user-config path resolution | Hardcode `process.env.APPDATA` etc. | `app.getPath('userData')` | Handles macOS/Windows differences; respects `--user-data-dir` CLI arg used by test infrastructure |
| Parsing Minecraft UUID formatting | Concatenate dashes by hand | Use `profile.id` as-returned (32-hex-no-dashes) — document this is the canonical form | Matches `sessionserver.mojang.com` and mc-heads.net path format |
| Concurrent-safe file writes | Naive `fs.writeFile` | Write to temp file + `fs.rename` (shown in `safeStorageCacheFactory` above) | Crash during write or simultaneous login attempts can corrupt tokens — atomic rename is one syscall |
| Token redaction in logs | Manual `.replace(/token/gi, ...)` scattered per log line | `electron-log` `hook` callback in `redact.ts` that runs before every write | Central; covers stdout/stderr bridging; enforces COMP-05 by construction |

**Key insight:** The entire value of `@azure/msal-node` + `prismarine-auth` is that **the token chain is long, annoying, and full of "did Microsoft change this endpoint again?" failure modes**. The only code in Phase 2 we actually write ourselves is: cache wiring, UI plumbing, error mapping, atomic file I/O. Everything touching HTTPS to Microsoft / Xbox endpoints comes from the libraries.

## Runtime State Inventory

Phase 2 is a greenfield implementation (no rename/refactor). **This section does not apply.** No pre-existing on-disk state, no prior running services, no OS-registered entries for Wiiwho's auth system exist yet. Phase 1 created only `launcher/src/main/ipc/auth.ts` stubs with no side effects.

## Common Pitfalls

### Pitfall 1: prismarine-auth's default FileCache writes plaintext JSON

**What goes wrong:** AUTH-04 says "never plaintext JSON". If we call `new Authflow(username, cacheDir, ...)` with a string `cacheDir`, prismarine-auth writes plaintext JSON to that directory. Grep for any token-looking string in `%APPDATA%/Wiiwho/` during verification and you'll find a base64 JWT sitting on disk.

**Why it happens:** prismarine-auth ships a simple `FileCache` that does `fs.writeFileSync(path, JSON.stringify(cache))`. Source: `prismarine-auth/src/common/cache/FileCache.js` — confirmed 2026-04-21. No note in the README makes the plaintext-default alarm-bell-loud.

**How to avoid:** Always pass `cacheDir` as a **function** (the custom factory pattern, §Architecture Patterns Pattern 1). Never pass a bare directory path.

**Warning signs:** Phase 2 verification step MUST include `grep -r 'eyJ' %APPDATA%/Wiiwho/` (JWT header base64 starts with "eyJ") and get zero hits. `grep -r 'refresh_token' $USERPROFILE\AppData\Roaming\Wiiwho\` must also be empty.

### Pitfall 2: prismarine-auth throws a plain `Error` with no structured XErr field

**What goes wrong:** You write `catch (err) { if (err.XErr === 2148916233) { ... } }` and it never fires — the numeric code is embedded in `err.message` not a property.

**Why it happens:** XboxTokenManager.js does `throw new Error(xboxLiveErrors[errorCode])` — only the message carries the code (and even then, only by embedding it via the mapped message string, which itself may not contain the numeric code).

**How to avoid:** Map by numeric code parsed from the **HTTP response body** prismarine-auth logs before throwing, OR parse the message string. The mapper in §Architecture Patterns Pattern 4 uses the latter because (a) we don't have access to the response body from outside prismarine-auth, and (b) prismarine's messages contain unique URLs (e.g. "signup.live.com" = 2148916233) that in 3.x also happen to embed the numeric code indirectly. The safer route: set `process.env.DEBUG = 'prismarine-auth'` and capture the XErr from debug output via a log-parsing fallback (ugly). **Safest:** patch Authflow to catch and re-throw with the code attached (small fork; documented as a post-Phase-2 upstream contribution opportunity).

**Warning signs:** Tests pass with mocked errors but production shows the fallback "Microsoft sign-in failed (code null)" message — a smell that the code parser is failing. Add end-to-end test fixtures that replay real prismarine-auth Error objects.

### Pitfall 3: `safeStorage.isEncryptionAvailable()` returning false on first boot before `app.whenReady()`

**What goes wrong:** Main process eagerly initializes AuthManager at module load, calls `isEncryptionAvailable()`, gets `false` (app not ready yet), throws → app never starts.

**Why it happens:** Electron docs state the key material is not available on Linux until `ready`; macOS/Windows similarly require `ready` for the function to return true consistently.

**How to avoid:** Lazy-initialize AuthManager after `app.whenReady()`. Never call safeStorage in top-level module code.

**Warning signs:** Launcher crashes on startup ONLY on clean-machine install (because existing DevAuth cache doesn't collide). Phase 7 clean-machine test catches this.

### Pitfall 4: DeviceCodeRequest `cancel` is mutative, not a function

**What goes wrong:** You write `request.cancel()` expecting a method; TS accepts it if loosely typed, runtime throws `cancel is not a function`. Or you pass a new `{ cancel: true }` request to `acquireTokenByDeviceCode` expecting that to stop a prior poll — it doesn't; each call is its own poll loop.

**Why it happens:** `DeviceCodeRequest.cancel: boolean` per Microsoft Learn reference. To stop an in-flight acquisition, you mutate the SAME request object passed earlier: `request.cancel = true`. MSAL Node's internal poller checks this flag between polls.

**How to avoid:** Hold the request object in AuthManager; expose a `cancelDeviceCode()` method that sets `this.pendingRequest.cancel = true`. Test by asserting the in-flight promise rejects with a specific error class within `interval` seconds of mutating the flag.

**Warning signs:** Clicking `Stop signing in` or pressing ESC doesn't unblock the outer `getMinecraftJavaToken` promise until the MSAL HTTP poll interval elapses — up to 5 seconds. Acceptable UX but plan for it.

### Pitfall 5: Using `flow: 'live'` and hitting Microsoft's shared client id revocation

**What goes wrong:** Every Wiiwho user fails to log in on the same day because Microsoft revoked the `MinecraftNintendoSwitch` shared client id due to abuse by some OTHER launcher scraping it.

**Why it happens:** `flow: 'live'` uses a first-party Microsoft client id. It's outside our control. PITFALLS.md Pitfall 6 explicitly calls this out.

**How to avoid:** Use `flow: 'msal'` with our registered Azure AD app (`60cbce02-072b-4963-833d-edb6f5badc2a`). The MCE approval gate (see §Environment Availability) ensures this client id has `api.minecraftservices.com` access.

### Pitfall 6: Tokens leaking into electron-log via thrown `Error` messages

**What goes wrong:** An unhandled error including a JWT in its message gets written to `main.log`, which later gets bundled into a crash report (Phase 3) and shared.

**Why it happens:** electron-log by default stringifies error objects including their full `.message`. Microsoft API error responses frequently echo tokens back.

**How to avoid:** Register a `log.hooks.push((msg) => ...)` hook in `main/auth/redact.ts` that regex-strips anything matching `eyJ[a-zA-Z0-9_.-]{100,}` (JWT shape) and `refresh_token["':]\s*["']?[A-Za-z0-9_-]+`. Add unit tests covering at least 3 canonical Microsoft error-response shapes. COMP-05 requires this for crash reports — make the log hook the single source of truth.

**Warning signs:** `grep -R 'eyJ' launcher/node_modules/.electron-log/ %APPDATA%/Wiiwho/logs/` returns a hit during testing.

### Pitfall 7: Silent-refresh race with renderer first-paint

**What goes wrong:** Renderer mounts `<PlayForward />` because Zustand defaults to `loggedIn: false`, then 400ms later the silent refresh resolves and the UI "pops" from login to play-forward. Flicker.

**Why it happens:** If the silent refresh isn't awaited before window.loadURL resolves to a rendered frame, the renderer picks its default state.

**How to avoid:** D-02 says "main process calls `prismarine-auth.getMinecraftJavaToken()` before the renderer mounts its first screen". Wait on that promise before calling `win.loadURL(...)`, OR initialize the renderer in a `loading` state (Zustand default) that only transitions on a one-shot `auth:status` call, which main returns only after the silent refresh completes. UI-SPEC's `LoadingScreen` (with 300ms min-visible + 8s fallback) is the renderer's side of this contract.

**Warning signs:** E2E screenshot at t=100ms shows login screen, t=500ms shows play-forward — visible flash.

### Pitfall 8: mc-heads.net outage blocking render

**What goes wrong:** User on a train with spotty connectivity sees a blank top-right corner and no Play button for 8s while the skin-head fetch hangs.

**Why it happens:** Naive `<img src="https://mc-heads.net/...">` is synchronous to the render pipeline.

**How to avoid:** Fetch skin head asynchronously with a timeout (2s), fall back to initial-placeholder on error (D-14 Revision spec). Cache hit is file-path-only, renders in one frame.

### Pitfall 9: MCE approval gate not yet granted → `/authentication/login_with_xbox` returns 401

**What goes wrong:** Execute phase starts before the MCE approval email arrives. Every login attempt dies at the final step with a cryptic error.

**Why it happens:** Azure AD app registration is not sufficient by itself — the Minecraft API scope needs Microsoft review (submitted 2026-04-20 per STATE.md; expected 2026-04-21 through 2026-04-27).

**How to avoid:** Execute's first task is to check `docs/azure-app-registration.md` for the approval-received date. If not yet approved, block execution (this is a hard Phase 2 prereq per CONTEXT.md Phase Boundary). Planning can proceed in parallel.

## Code Examples

Verified patterns from authoritative sources.

### Example 1: Full device-code login in one function

```typescript
// Sources:
//   - prismarine-auth README + API.md — Authflow constructor, getMinecraftJavaToken
//   - prismarine-auth/src/common/Constants.js — xboxLiveErrors mapping (2148916233..2148916238)
//   - Microsoft Learn — DeviceCodeResponse shape (userCode, deviceCode, verificationUri, expiresIn, interval, message)

import { BrowserWindow, app, safeStorage } from 'electron'
import { Authflow } from 'prismarine-auth'
import path from 'node:path'
import { mapAuthError, AuthErrorView } from './xstsErrors'
import { safeStorageCacheFactory } from './safeStorageCache'

const AZURE_CLIENT_ID = '60cbce02-072b-4963-833d-edb6f5badc2a'

export interface LoginResult {
  ok: boolean
  username?: string
  uuid?: string
  error?: AuthErrorView
}

export async function loginWithDeviceCode(win: BrowserWindow): Promise<LoginResult> {
  if (!safeStorage.isEncryptionAvailable()) {
    return {
      ok: false,
      error: {
        code: null,
        message: 'OS keychain is unavailable. Please restart the launcher.',
        helpUrl: null
      }
    }
  }

  const authDir = path.join(app.getPath('userData'), 'auth')

  const flow = new Authflow(
    'primary',
    safeStorageCacheFactory(authDir),
    { flow: 'msal', authTitle: AZURE_CLIENT_ID },
    (deviceCodeResp) => {
      win.webContents.send('auth:device-code', {
        userCode: deviceCodeResp.userCode,
        verificationUri: deviceCodeResp.verificationUri,
        expiresInSec: deviceCodeResp.expiresIn
      })
    }
  )

  try {
    const { profile } = await flow.getMinecraftJavaToken({ fetchProfile: true })
    if (!profile) throw new Error('NO_MC_PROFILE')
    return { ok: true, username: profile.name, uuid: profile.id }
  } catch (err) {
    return { ok: false, error: mapAuthError(err) }
  }
}
```

### Example 2: Silent refresh on app start

```typescript
// File: launcher/src/main/auth/AuthManager.ts
// Source: prismarine-auth README — forceRefresh defaults false; getMinecraftJavaToken uses cache

export async function trySilentRefresh(): Promise<{ username: string; uuid: string } | null> {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    if (!hasStoredAccount()) return null

    const flow = new Authflow(
      'primary',
      safeStorageCacheFactory(path.join(app.getPath('userData'), 'auth')),
      { flow: 'msal', authTitle: AZURE_CLIENT_ID }
      // no codeCallback — silent refresh should never trigger device-code prompt;
      //   if the MSA refresh token is dead, getMinecraftJavaToken will fail, caught below
    )

    const { profile } = await flow.getMinecraftJavaToken({ fetchProfile: true })
    if (!profile) return null
    return { username: profile.name, uuid: profile.id }
  } catch {
    // D-03: silent refresh failure is quiet. Clear stale state and fall through.
    await clearStoredAccount()
    return null
  }
}
```

### Example 3: Test fixture for XSTS errors

```typescript
// File: launcher/src/main/auth/__tests__/xstsErrors.test.ts
// Verified messages from prismarine-auth/src/common/Constants.js (2026-04-21)

import { describe, it, expect } from 'vitest'
import { mapAuthError } from '../xstsErrors'

// These are the EXACT message strings prismarine-auth 3.1.1 throws.
// Source: github.com/PrismarineJS/prismarine-auth/blob/master/src/common/Constants.js
const PRISMARINE_MSGS = {
  2148916233:
    'Your account currently does not have an Xbox profile. Please create one at https://signup.live.com/signup',
  2148916235:
    'Your account resides in a region that Xbox has not authorized use from. Xbox has blocked your attempt at logging in.',
  2148916236:
    'Your account requires proof of age. Please login to https://login.live.com/login.srf and provide proof of age.',
  2148916237:
    'Your account has reached the its limit for playtime. Your account has been blocked from logging in.',
  2148916238:
    'The account date of birth is under 18 years and cannot proceed unless the account is added to a family by an adult.'
}

describe('mapAuthError — XSTS codes', () => {
  it('2148916233 → "no Xbox profile" with xbox.com/live help URL', () => {
    const r = mapAuthError(new Error(`2148916233: ${PRISMARINE_MSGS[2148916233]}`))
    expect(r.code).toBe(2148916233)
    expect(r.message).toContain("doesn't have an Xbox profile yet")
    expect(r.helpUrl).toBe('https://www.xbox.com/en-US/live')
  })

  it('2148916238 → "child account / Family" message', () => {
    const r = mapAuthError(new Error(PRISMARINE_MSGS[2148916238]))
    expect(r.code).toBe(2148916238)
    expect(r.helpUrl).toBe('https://account.microsoft.com/family/')
  })

  it('NO_MC_PROFILE sentinel → purchase page', () => {
    const r = mapAuthError(new Error('NO_MC_PROFILE'))
    expect(r.code).toBeNull()
    expect(r.helpUrl).toMatch(/minecraft\.net/)
  })

  it('network error (ENOTFOUND) → no Help link (D-12)', () => {
    const e = new Error('fetch failed') as NodeJS.ErrnoException
    e.code = 'ENOTFOUND'
    const r = mapAuthError(e)
    expect(r.helpUrl).toBeNull()
    expect(r.message).toMatch(/check your internet connection/i)
  })

  it('unrecognized XSTS code → generic message with code', () => {
    const r = mapAuthError(new Error('XSTS 2148916299 — new unknown code'))
    expect(r.code).toBe(2148916299)
    expect(r.message).toMatch(/Microsoft sign-in failed \(code 2148916299\)/)
    expect(r.helpUrl).toBe('https://support.xbox.com/')
  })
})
```

### Example 4: electron-log hook for token redaction

```typescript
// File: launcher/src/main/auth/redact.ts
// Source: electron-log v5 hooks documentation

import log from 'electron-log/main'

const JWT_PATTERN = /eyJ[A-Za-z0-9_.-]{20,}/g
const REFRESH_TOKEN_PATTERN = /refresh_token["':]\s*["']?[A-Za-z0-9._-]+["']?/g
const ACCESS_TOKEN_PATTERN = /access_token["':]\s*["']?[A-Za-z0-9._-]+["']?/g
const MC_ACCESS_PATTERN = /"accessToken":\s*"[^"]+"/g

export function installRedactor(): void {
  log.hooks.push((message) => {
    for (let i = 0; i < message.data.length; i++) {
      const part = message.data[i]
      if (typeof part === 'string') {
        message.data[i] = part
          .replace(JWT_PATTERN, 'eyJ[REDACTED]')
          .replace(REFRESH_TOKEN_PATTERN, 'refresh_token: [REDACTED]')
          .replace(ACCESS_TOKEN_PATTERN, 'access_token: [REDACTED]')
          .replace(MC_ACCESS_PATTERN, '"accessToken": "[REDACTED]"')
      } else if (part instanceof Error) {
        message.data[i] = Object.assign(new Error(), part, {
          message: part.message
            .replace(JWT_PATTERN, 'eyJ[REDACTED]')
            .replace(REFRESH_TOKEN_PATTERN, 'refresh_token: [REDACTED]')
        })
      }
    }
    return message
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mojang Yggdrasil auth | Microsoft OAuth 2.0 + XBL + XSTS + login_with_xbox | March 2022 (Mojang deprecation) → Sept 2024 (full shutdown) | Device-code flow + prismarine-auth is the only path for Minecraft Java accounts |
| `keytar` native module | Electron `safeStorage` | Electron 15+ | No native build, no ABI rebuild per Electron version; simpler package footprint. Electron team recommends safeStorage explicitly. |
| MSAL Node 4.x | **MSAL Node 5.x** (5.1.3 current) | 2025–2026 | DeviceCodeRequest surface is stable; client-side behavior unchanged; CLAUDE.md's `^4.x` pin should bump to `^5.1.3`. |
| prismarine-auth 2.x | **prismarine-auth 3.x** (3.1.1 current; 3.0.0 was 2026-03-29) | 2026-03-29 | Researcher confirms the public API shown in examples/README is the same surface we're using; no breaking changes affecting our usage as of verification date. |

**Deprecated/outdated:**
- **`keytar` for new Electron projects** — Electron docs now officially recommend `safeStorage` for credential storage. Use keytar only for complex multi-secret stores (we have one secret per account, so safeStorage fits).
- **`flow: 'live'` with Microsoft's first-party client ids** — still works, but creates a single point of failure (Microsoft's revocation of THAT specific client id kills all of your users at once). For any app with its own Azure AD registration, use `flow: 'msal'`.

## Open Questions

1. **Does prismarine-auth 3.1.1 expose a `cancelDeviceCode()` or similar public method?**
   - What we know: MSAL Node uses a mutable `cancel: boolean` on DeviceCodeRequest (verified). MsaTokenManager.js wraps MSAL's `acquireTokenByDeviceCode`. The source snippet read showed a `deviceCodeCallback` hand-off but no cancel method in the excerpt.
   - What's unclear: Whether 3.x added a public cancel method since the 2.x API docs.
   - Recommendation: During execute, spike a 30-line test that: (a) calls `flow.getMinecraftJavaToken()`, (b) captures the internal request reference via a patched `Authflow` (or monkeypatch MSAL's `PublicClientApplication.prototype.acquireTokenByDeviceCode`), (c) asserts setting `cancel=true` rejects the outer promise within `interval`+1 seconds. If prismarine-auth exposes a public cancel, use it; otherwise document the race pattern fallback.

2. **Can we split prismarine-auth's multi-file cache into one encrypted `auth.bin`?**
   - What we know: prismarine-auth's custom cache factory is called per `(username, cacheName)` pair, so it writes ≥3 files per user (msa, xbl, mca). D-16's schema nominally implies a single file.
   - What's unclear: Whether D-16's *intent* is a single on-disk artifact or a single logical schema.
   - Recommendation: **Option B in Pattern 1** — keep the encrypted per-cache-name files as prismarine-auth writes them (all under `%APPDATA%/Wiiwho/auth/<username>/`), and use a separate plaintext-safe `auth.bin` pointer file containing only `{ version, activeAccountId, accounts: [{ id, username, lastUsed }] }` (NO token material). This honors D-17 literally (no tokens in the pointer) while letting prismarine-auth's cache internals stay untouched. Planner owns the final call; either option is admissible.

3. **Should we proactively refresh the token on a timer while Play-forward is visible?**
   - Claude's Discretion (per CONTEXT.md). Tradeoffs: proactive refresh means Play click always has a fresh access token; lazy refresh (on Play click) adds <1s to launch time on happy path. Given Phase 3's launch flow takes tens of seconds downloading libraries anyway, lazy is simpler and has no observable UX cost.
   - Recommendation: **Lazy on Play click.** Planner confirms during plan.

## Environment Availability

External dependencies required by Phase 2:

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Development tooling | ✓ | 23.8.0 (on dev machine per `node --version`) | — (note: CLAUDE.md targets Node 22 LTS; v23 is current stable but pre-release of Node 24 LTS; confirm it's not creating `@electron-toolkit/*` resolution issues during install) |
| npm | Package install | ✓ | 9.0.0 | pnpm preferred per CLAUDE.md; both work |
| Electron | Runtime | ✓ | 39.2.6 (installed in `launcher/node_modules`) | No fallback; note CLAUDE.md says 41 — project on 39. Not a Phase 2 blocker; safeStorage works on both. |
| `@azure/msal-node` | Device code flow | ✗ (not yet installed) | Target 5.1.3 | None — required |
| `prismarine-auth` | Token chain | ✗ (not yet installed) | Target 3.1.1 | Hand-roll the chain (rejected — see §Don't Hand-Roll) |
| `electron-log` | Logging | ✗ (not yet installed) | Target 5.4.3 | `winston` — not recommended, see STACK.md |
| **Azure AD app MCE approval** | `api.minecraftservices.com/authentication/login_with_xbox` | **⚠ PENDING** | Submitted 2026-04-20; expected 2026-04-21..27 | **No fallback.** Execute-phase gates on the approval email. Planning can proceed in parallel. |
| Live Microsoft account (eliyahu6666@outlook.com per STATE.md) | Live-endpoint testing | ✓ | — | Any real MSA; cracked accounts out of scope |
| macOS dev machine | Cross-platform verification | ⚠ Unknown (owner is on Windows per CLAUDE.md) | — | Defer macOS verification to Phase 7 clean-machine gate; Phase 2 can ship with Windows-verified safeStorage + macOS keychain tested-at-unit-test layer only |

**Missing dependencies with no fallback:**
- MCE approval is a hard external gate. All `getMinecraftJavaToken()` calls fail without it. Execute-phase verification steps that hit live endpoints MUST be blocked until approval arrives.

**Missing dependencies with fallback:**
- macOS Keychain verification can be deferred to Phase 7 (clean-machine gate). Phase 2 validates the safeStorage contract on Windows + unit-test-level round-trip.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (installed; `launcher/package.json`) |
| Config file | None — Vitest uses Vite's config by default; confirm `vitest.config.ts` or reliance on `vite.config.ts` during planning |
| Quick run command | `pnpm --filter ./launcher test:run` |
| Full suite command | `pnpm --filter ./launcher test:run` (single package; no integration suite separation yet) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| AUTH-01 | Main process triggers MSAL device-code flow; emits `auth:device-code` with `{userCode, verificationUri, expiresInSec}` | unit (with mocked prismarine-auth) | `pnpm --filter ./launcher test:run src/main/auth/__tests__/AuthManager.test.ts` | ❌ Wave 0 |
| AUTH-01 | Live device-code login against real Microsoft MCE-approved Azure AD app | manual (live-endpoint) | `pnpm --filter ./launcher dev` + hand-walk through `docs/MANUAL-QA-auth.md` | ❌ Wave 0 (QA doc) |
| AUTH-02 | `getMinecraftJavaToken({ fetchProfile: true })` returns `{profile: {id, name}}` → exposed via `auth:status` | integration (mocked prismarine-auth) | `pnpm --filter ./launcher test:run src/main/auth/__tests__/login-integration.test.ts` | ❌ Wave 0 |
| AUTH-02 | NO_MC_PROFILE sentinel produces "doesn't own Minecraft Java" error view | unit | covered by `xstsErrors.test.ts` (§Code Examples) | ❌ Wave 0 |
| AUTH-03 | Each XSTS code `2148916233/5/6/7/8` maps to its locked D-10 message | unit | `pnpm --filter ./launcher test:run src/main/auth/__tests__/xstsErrors.test.ts` | ❌ Wave 0 |
| AUTH-03 | Unrecognized XSTS codes fall through to generic "code {N}" message | unit | same test file | ❌ Wave 0 |
| AUTH-04 | `safeStorageCache` encrypts via `safeStorage.encryptString` and writes a Buffer (not JSON) | unit (mocked safeStorage) | `pnpm --filter ./launcher test:run src/main/auth/__tests__/safeStorageCache.test.ts` | ❌ Wave 0 |
| AUTH-04 | Filesystem audit after a live login contains no JWT / no `refresh_token` / no `access_token` substrings | manual (live-endpoint) | `grep -rE 'eyJ\|refresh_token\|access_token' "$APPDATA/Wiiwho/"` must return 0 | ❌ Wave 0 (QA doc) |
| AUTH-05 | `auth:status` returns `{loggedIn: true, username, uuid}` after successful login | unit (mocked AuthManager) | `pnpm --filter ./launcher test:run src/main/ipc/auth.test.ts` | ✓ (Phase 1 scaffold — extend) |
| AUTH-05 | UUID renders in AccountBadge dropdown as expected (first 8 chars in tooltip, full in menu) | unit (React Testing Library) | `pnpm --filter ./launcher test:run src/renderer/src/components/AccountBadge.test.tsx` | ❌ Wave 0 |
| AUTH-06 | `auth:logout` clears on-disk cache for the active account and resolves `{ok: true}` | integration (real fs, mocked safeStorage) | `pnpm --filter ./launcher test:run src/main/auth/__tests__/logout.test.ts` | ❌ Wave 0 |
| AUTH-06 | After logout, next `auth:status` returns `{loggedIn: false}` and no token files exist on disk | integration | same test file | ❌ Wave 0 |
| AUTH-02+04 (Success Criterion 2) | 7-day refresh test: set system clock forward 7 days after a fresh login, relaunch, land in Play-forward without prompting | manual (live-endpoint, time-consuming) | `docs/MANUAL-QA-auth.md` §7-day refresh test | ❌ Wave 0 (QA doc) |

### Sampling Rate
- **Per task commit:** `pnpm --filter ./launcher test:run` — quick, fully mocked, <5s end-to-end
- **Per wave merge:** same + `pnpm --filter ./launcher typecheck` + `pnpm --filter ./launcher lint`
- **Phase gate:** Full suite green + manual live-endpoint walkthrough against real MSA + filesystem grep verification for AUTH-04. (7-day refresh verification is time-boxed and can overlap into Phase 3 window.)

### Wave 0 Gaps

Test infrastructure to create BEFORE implementation tasks begin:

- [ ] `launcher/src/main/auth/__tests__/xstsErrors.test.ts` — pure function coverage (AUTH-03). Template: §Code Examples Example 3.
- [ ] `launcher/src/main/auth/__tests__/safeStorageCache.test.ts` — round-trip test using a faked `safeStorage.encryptString` / `decryptString` (AUTH-04). Must assert temp-file + rename semantics on writes.
- [ ] `launcher/src/main/auth/__tests__/AuthManager.test.ts` — mocked prismarine-auth Authflow; asserts `auth:device-code` is emitted exactly once with the documented shape; asserts `cancel` flips state correctly (AUTH-01).
- [ ] `launcher/src/main/auth/__tests__/login-integration.test.ts` — full login happy path with mocked `Authflow.getMinecraftJavaToken` (AUTH-02, AUTH-05).
- [ ] `launcher/src/main/auth/__tests__/logout.test.ts` — real fs, mocked safeStorage; asserts on-disk files gone after logout (AUTH-06).
- [ ] `launcher/src/main/auth/__tests__/redact.test.ts` — electron-log hook redacts JWT / refresh_token / access_token patterns (COMP-05 foundation).
- [ ] `launcher/src/renderer/src/components/__tests__/*` — component-level tests for LoginScreen, DeviceCodeModal (expired-state transition, ESC, Copy/Open buttons), ErrorBanner (message + Help link), AccountBadge (dropdown open/close, Log out click).
- [ ] `docs/MANUAL-QA-auth.md` — reproducible live-endpoint test checklist covering: (1) fresh login happy path, (2) cancel during device-code wait, (3) each of 5 XSTS codes (hard to reproduce — document which can be simulated via fake error fixtures and which need rare test accounts), (4) filesystem grep audit, (5) 7-day refresh test (date+time change procedure), (6) logout + re-login. Track test account names / conditions for repeatability.
- [ ] Vitest config check — confirm project uses Vite's config by default or add a minimal `vitest.config.ts` with `test.environment: 'node'` for main tests and `'jsdom'` for renderer tests.

## Project Constraints (from CLAUDE.md)

Directives extracted from `./CLAUDE.md` that Phase 2 planning and execution MUST honor:

| Directive | Source | Compliance Strategy |
|-----------|--------|---------------------|
| Launcher is Electron + TypeScript + React; main+preload+renderer split | Tech Stack | All Phase 2 code places prismarine-auth + safeStorage in main only; renderer gets `{loggedIn, username, uuid}` only |
| Target Minecraft version is 1.8.9 | Project Vision | Auth succeeds for 1.8.9 profiles (Mojang profile API is version-agnostic; no 1.8.9-specific handling in Phase 2) |
| Microsoft OAuth (MSAL, device code flow) — Mojang auth is dead; MS accounts only | Tech Stack | Device Code ONLY (CONTEXT.md Phase 1 D-16 lock); no cracked-account support |
| Non-goals: no cheats, no ghost clients, no cracked accounts | Non-Goals | Phase 2 is auth-only; these don't apply here but forbid adding auth bypasses |
| EULA: no redistribution of Minecraft assets | Legal Notes | No Minecraft asset touched in Phase 2 (auth is pre-launch) |
| GSD workflow enforcement — use `/gsd:execute-phase` for planned work | GSD section | Planner + executor follow GSD; Phase 2 is `/gsd:plan-phase`'d now, `/gsd:execute-phase`'d later |
| Electron security best practices (contextIsolation on, nodeIntegration off, sandbox, preload bridge) | LAUN-06 | Phase 2 preserves the Phase 1 security audit; all IPC over named channels; runtime audit via `__security:audit` must still report `allTrue: true` |
| No Node 24 for dev tooling (Electron bundles Node 24 internally; @electron/* repos require Node 22 min) | Additional Context from CLAUDE.md | Note: dev machine runs Node 23.8.0. Validate during install that @electron-toolkit installs cleanly; if not, drop to Node 22 LTS. |
| macOS + Windows only for v0.1 | Additional Context | safeStorage verified working on both; no Linux libsecret handling needed (note it for Phase 7 if Linux is ever added) |
| MSAL Node only (NOT msal-browser) | Additional Context | Locked — Authflow's `flow: 'msal'` drives MSAL Node under the hood, in main process |
| electron-log 5.x | Additional Context | Covered; 5.4.3 is target version |

No directives in CLAUDE.md conflict with the decisions in CONTEXT.md.

## Sources

### Primary (HIGH confidence)
- [prismarine-auth GitHub repo](https://github.com/PrismarineJS/prismarine-auth) — README + Constants.js source — XSTS code→message mapping, Authflow constructor contract, flow modes
- [prismarine-auth Constants.js (verbatim XSTS table)](https://github.com/PrismarineJS/prismarine-auth/blob/master/src/common/Constants.js) — codes 2148916227, 2148916229, 2148916233, 2148916234, 2148916235, 2148916236, 2148916237, 2148916238 with messages
- [prismarine-auth XboxTokenManager.js](https://github.com/PrismarineJS/prismarine-auth/blob/master/src/TokenManagers/XboxTokenManager.js) — error handling: `throw new Error(xboxLiveErrors[errorCode])`
- [prismarine-auth FileCache.js](https://github.com/PrismarineJS/prismarine-auth/blob/master/src/common/cache/FileCache.js) — confirms default cache writes plaintext JSON (Pitfall 1)
- [prismarine-auth MsaTokenManager.js](https://github.com/PrismarineJS/prismarine-auth/blob/master/src/TokenManagers/MsaTokenManager.js) — MSAL Node wrapping pattern, codeCallback signature
- [Microsoft Learn: DeviceCodeRequest type](https://learn.microsoft.com/en-us/javascript/api/@azure/msal-node/devicecoderequest) — updated 2026-03-30; `cancel: boolean` field confirmed
- [Microsoft Learn: OAuth 2.0 device authorization grant](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code) — updated 2025-10-02; DeviceCodeResponse fields (user_code, device_code, verification_uri, expires_in, interval, message); polling error codes
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage) — platform behavior (Keychain / DPAPI), `isEncryptionAvailable()` contract, must wait for `ready`
- [Minecraft Wiki: Microsoft authentication](https://minecraft.wiki/w/Microsoft_authentication) — XSTS error code meanings (cross-verified); ownership check via `/entitlements/mcstore` (empty `items` = no ownership)
- [electron-log GitHub README](https://github.com/megahertz/electron-log) — v5 API, hooks signature, log-file locations
- `npm view @azure/msal-node version` — 5.1.3 (2026-04-17)
- `npm view prismarine-auth version` — 3.1.1 (2026-03-31)
- `npm view electron-log version` — 5.4.3
- `npm view electron version` — 41.2.1

### Secondary (MEDIUM confidence)
- [wiki.vg Microsoft Authentication Scheme](https://wiki.vg/Microsoft_Authentication_Scheme) — referenced by STACK.md; backup cross-reference for XSTS semantics
- `.planning/research/PITFALLS.md §Pitfall 6` — prior research on MS auth pitfalls; informs Pitfall 5 here
- `.planning/research/STACK.md §Auth` — prior stack lock; we're extending, not contradicting

### Tertiary (LOW confidence)
- Speculation about prismarine-auth 3.x exposing a public cancel method — **open question 1**, needs verification during execute via spike
- macOS Keychain behavior specifics — verified via Electron docs (HIGH), but actual-device testing is deferred to Phase 7

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all three libraries cross-verified against npm registry + source + upstream docs
- Architecture patterns: **HIGH** — custom cache factory pattern documented in prismarine-auth README; safeStorage contract per Electron docs; IPC frozen surface inherited from Phase 1
- XSTS error map: **HIGH** — verbatim source of messages in prismarine-auth Constants.js; mapping-by-code strategy validated by reading XboxTokenManager.js (throws plain Error, no XErr property exposed)
- MSAL Node cancellation: **HIGH** (on the spec level — `cancel: boolean` confirmed); **MEDIUM** on whether prismarine-auth 3.1.1 exposes the cancel through its public API (open question 1)
- Validation architecture: **HIGH** for testability of pure functions (xstsErrors, redact, safeStorageCache); **MEDIUM** for live-endpoint tests (blocked on MCE approval; pattern borrowed from Phase 1 plan-01-02 DevAuth verification)

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30 days; auth libraries are stable but MSAL Node moves on 8-week cadence and prismarine-auth is on a 3-weekly cadence — re-verify versions at phase execute)
