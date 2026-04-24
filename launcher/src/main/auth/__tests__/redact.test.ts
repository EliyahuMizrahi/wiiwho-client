// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

type HookFn = (m: { data: unknown[] }) => { data: unknown[] }

// Capture the pushed hook so we can drive it with synthetic messages.
const pushedHooks: HookFn[] = []

vi.mock('electron-log/main', () => ({
  default: {
    hooks: {
      push: (h: HookFn) => {
        pushedHooks.push(h)
      }
    }
  }
}))

// Dynamic import so each `beforeEach` below can reset the module-level `installed`
// flag in redact.ts via vi.resetModules(). The static top-level import would cache
// the module and make idempotency + re-registration tests impossible to isolate.
async function loadRedact(): Promise<typeof import('../redact')> {
  return await import('../redact')
}

// Eager-load once so `scrub` is available to the pure-function describe block
// without triggering any hook registration yet (scrub is synchronous + stateless).
const mod = await import('../redact')
const { scrub } = mod.__test__
const { sanitizeCrashReport } = mod

describe('scrub (pure regex pipeline)', () => {
  it('redacts a real-looking JWT', () => {
    const input = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc-123_DEF'
    expect(scrub(input)).toBe('Bearer eyJ[REDACTED]')
  })

  it('redacts refresh_token field pattern (colon form)', () => {
    const input = 'refresh_token: abc.def-ghi_123'
    expect(scrub(input)).toBe('refresh_token: [REDACTED]')
  })

  it('redacts refresh_token field pattern (JSON-style quoted)', () => {
    const input = '"refresh_token":"abc.def-ghi_123"'
    expect(scrub(input)).toContain('refresh_token: [REDACTED]')
    expect(scrub(input)).not.toContain('abc.def-ghi_123')
  })

  it('redacts access_token field pattern', () => {
    const input = 'access_token: mytokenvalue123'
    expect(scrub(input)).toBe('access_token: [REDACTED]')
  })

  it('redacts Mojang accessToken JSON shape', () => {
    const input = '{"accessToken": "eyJreal.token.bytes_DEFXYZ"}'
    expect(scrub(input)).toBe('{"accessToken": "[REDACTED]"}')
  })

  it('leaves non-token strings untouched', () => {
    const input = 'User clicked the Play button at 10:42am — nothing sensitive here'
    expect(scrub(input)).toBe(input)
  })

  it('redacts multiple tokens in the same string', () => {
    const input = 'Got eyJabcdefghijklmnopqrst.sig and access_token: secretValue42'
    const out = scrub(input)
    expect(out).toContain('eyJ[REDACTED]')
    expect(out).toContain('access_token: [REDACTED]')
    expect(out).not.toContain('eyJabcdefghijklmnopqrst.sig')
    expect(out).not.toContain('secretValue42')
  })
})

describe('installRedactor', () => {
  let installRedactor: typeof mod.installRedactor

  beforeEach(async () => {
    // Reset module state so each test observes a fresh `installed = false` flag.
    pushedHooks.length = 0
    vi.resetModules()
    const fresh = await loadRedact()
    installRedactor = fresh.installRedactor
  })

  it('registers exactly one hook on electron-log.hooks', () => {
    installRedactor()
    expect(pushedHooks).toHaveLength(1)
  })

  it('is idempotent — second call does not re-register', () => {
    installRedactor()
    installRedactor()
    installRedactor()
    expect(pushedHooks).toHaveLength(1)
  })

  it('hook redacts string data entries', () => {
    installRedactor()
    const msg = { data: ['keep me', 'eyJabcdefghijklmnopqrst.more'] }
    const out = pushedHooks[0](msg)
    expect(out.data[0]).toBe('keep me')
    expect(out.data[1]).toBe('eyJ[REDACTED]')
  })

  it('hook redacts Error.message and preserves name', () => {
    installRedactor()
    const e = new Error('XSTS failed with refresh_token: leaked.value.here')
    e.name = 'XstsError'
    const msg = { data: [e] }
    const out = pushedHooks[0](msg)
    const scrubbed = out.data[0] as Error
    expect(scrubbed.message).toContain('[REDACTED]')
    expect(scrubbed.message).not.toContain('leaked.value.here')
    expect(scrubbed.name).toBe('XstsError')
  })

  it('hook redacts Error.stack when present', () => {
    installRedactor()
    const e = new Error('wrapper')
    e.stack = 'Error: wrapper\n  at foo (eyJabcdefghijklmnopqrstuv.sig)'
    const msg = { data: [e] }
    const out = pushedHooks[0](msg)
    const scrubbed = out.data[0] as Error
    expect(scrubbed.stack).toContain('eyJ[REDACTED]')
    expect(scrubbed.stack).not.toContain('eyJabcdefghijklmnopqrstuv.sig')
  })

  it('hook passes through non-string/non-Error entries unchanged', () => {
    installRedactor()
    const msg = { data: [42, { some: 'object' }, true, null] }
    const out = pushedHooks[0](msg)
    expect(out.data[0]).toBe(42)
    expect(out.data[1]).toEqual({ some: 'object' })
    expect(out.data[2]).toBe(true)
    expect(out.data[3]).toBeNull()
  })

  it('hook returns the same message object (mutation, not copy)', () => {
    installRedactor()
    const msg = { data: ['eyJabcdefghijklmnopqrst.sig'] }
    const out = pushedHooks[0](msg)
    expect(out).toBe(msg)
  })
})

// -----------------------------------------------------------------------------
// Phase 3 D-20 extension: 6 additional redaction patterns + sanitizeCrashReport
// -----------------------------------------------------------------------------
//
// D-20 targets: MC --accessToken CLI form, Windows user path, macOS user path,
// %USERNAME%, $USER, $HOME. D-21 contract: sanitizeCrashReport is the SAME
// scrub() function the electron-log hook uses — one code path drives both
// display and clipboard.
//
// Fixture is defined inline (rather than read from __fixtures__/) so this test
// remains self-contained and parallel-execution-safe (Plan 03-00 creates the
// real fixture file; tests run green with or without it).

const FAKE_CRASH_REPORT = `---- Minecraft Crash Report ----
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
    Launched command: javaw -Xmx2048M -Xms2048M -XX:+UseG1GC -cp "C:\\Users\\Alice\\AppData\\Roaming\\Wiiwho\\game\\libraries\\...;C:\\Users\\Alice\\AppData\\Roaming\\Wiiwho\\game\\versions\\1.8.9\\1.8.9.jar" net.minecraft.client.main.Main --username Wiiwho --accessToken ey.fakeTokenBody123.secretsig --userType msa
    Game files at: /Users/bob/Library/Application Support/Wiiwho/game
    User home: %USERNAME% and also $USER and $HOME references
`

describe('D-20 extended patterns (Phase 3)', () => {
  it('redacts --accessToken CLI form (MC_TOKEN_CLI_PATTERN)', () => {
    const input = 'foo --accessToken ey.fakeTokenBody123.secretsig bar'
    expect(scrub(input)).toBe('foo --accessToken [REDACTED] bar')
  })

  it('redacts Windows user path with backslash separator', () => {
    const input = 'at file C:\\Users\\Alice\\foo\\bar.jar'
    expect(scrub(input)).toContain('C:\\Users\\<USER>')
    expect(scrub(input)).not.toContain('Alice')
  })

  it('redacts Windows user path with forward-slash separator', () => {
    const input = 'at file C:/Users/Alice/foo/bar.jar'
    expect(scrub(input)).toContain('C:/Users/<USER>')
    expect(scrub(input)).not.toContain('Alice')
  })

  it('redacts macOS user path', () => {
    const input = 'at file /Users/bob/Library/foo'
    expect(scrub(input)).toBe('at file /Users/<USER>/Library/foo')
    expect(scrub(input)).not.toContain('bob')
  })

  it('redacts %USERNAME% literal', () => {
    expect(scrub('home dir: %USERNAME% expanded')).toBe('home dir: <USER> expanded')
  })

  it('redacts $USER (word-bounded — does not eat $USERNAME)', () => {
    expect(scrub('shell: $USER here')).toBe('shell: <USER> here')
    // Must NOT replace `$USERNAME` as a partial — \b guards this
    expect(scrub('shell: $USERNAME here')).toBe('shell: $USERNAME here')
  })

  it('redacts $HOME (word-bounded — does not eat $HOMEPAGE)', () => {
    expect(scrub('env: $HOME/.config')).toBe('env: <HOME>/.config')
    expect(scrub('env: $HOMEPAGE')).toBe('env: $HOMEPAGE')
  })

  it('sanitizeCrashReport is exported and strips all D-20 targets from fixture', () => {
    const out = sanitizeCrashReport(FAKE_CRASH_REPORT)
    // Targets removed:
    expect(out).not.toContain('ey.fakeTokenBody123')
    expect(out).not.toContain('Alice')
    expect(out).not.toContain('bob')
    expect(out).not.toMatch(/%USERNAME%/)
    // $USER and $HOME as standalone tokens must be gone; substring `USER` still
    // appears inside `<USER>` replacement — we assert the *literal* $-prefixed form is gone.
    expect(out).not.toMatch(/\$USER\b/)
    expect(out).not.toMatch(/\$HOME\b/)
    // Replacements present:
    expect(out).toContain('[REDACTED]')
    expect(out).toContain('<USER>')
    expect(out).toContain('<HOME>')
  })

  it('scrub is idempotent — scrub(scrub(x)) === scrub(x)', () => {
    const once = scrub(FAKE_CRASH_REPORT)
    const twice = scrub(once)
    expect(twice).toBe(once)
  })

  it('Phase 2 regression guard — JWT redaction still works unchanged', () => {
    const input = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc-123_DEF'
    expect(scrub(input)).toBe('Bearer eyJ[REDACTED]')
  })

  it('sanitizeCrashReport uses the same scrub pipeline (D-21 single-source)', () => {
    // Anything scrub does, sanitizeCrashReport must do identically.
    const samples = [
      'foo eyJlongJwtBodyWithEnoughChars12345.sig',
      '"accessToken": "opaque"',
      '--accessToken abc.def',
      'C:\\Users\\Eve\\docs',
      '/Users/carol/Movies',
      '%USERNAME%',
      '$USER',
      '$HOME'
    ]
    for (const s of samples) {
      expect(sanitizeCrashReport(s)).toBe(scrub(s))
    }
  })
})

