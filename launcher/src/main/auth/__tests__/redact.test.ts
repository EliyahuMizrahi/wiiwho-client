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
