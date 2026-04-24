// @vitest-environment node
/**
 * Platform-branched tests for paths.ts.
 *
 * These tests pin JRE-03 (bundled JRE, never system PATH), Pitfall 7
 * (javaw.exe, not java.exe, on Windows to avoid a phantom console window),
 * and D-24 / D-25 / D-17 game-dir layout + JRE subdir convention.
 *
 * Each test defines process.platform + process.arch via Object.defineProperty
 * then dynamically imports './paths' so per-test platform state is observed
 * by the module. vi.resetModules() in afterEach keeps tests isolated.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getAppPath: (): string => '/fake/app',
    getPath: (key: string): string => {
      if (key === 'userData') return '/fake/userData/Wiiwho'
      throw new Error(`unexpected app.getPath(${key})`)
    }
  }
}))

// Default: dev mode. Individual tests can re-mock '@electron-toolkit/utils'
// via vi.doMock + vi.resetModules to flip to packaged.
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))

describe('paths.ts', () => {
  const originalPlatform = process.platform
  const originalArch = process.arch
  const originalResourcesPath = (process as unknown as { resourcesPath?: string })
    .resourcesPath

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true
    })
    Object.defineProperty(process, 'arch', {
      value: originalArch,
      configurable: true
    })
    if (originalResourcesPath === undefined) {
      delete (process as unknown as { resourcesPath?: string }).resourcesPath
    } else {
      Object.defineProperty(process, 'resourcesPath', {
        value: originalResourcesPath,
        configurable: true
      })
    }
    vi.resetModules()
    vi.doUnmock('@electron-toolkit/utils')
    vi.doMock('@electron-toolkit/utils', () => ({ is: { dev: true } }))
  })

  it('resolveJavaBinary returns javaw.exe on win32 (NOT java.exe — Pitfall 7)', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    Object.defineProperty(process, 'arch', { value: 'x64', configurable: true })
    const { resolveJavaBinary } = await import('./paths')
    const p = resolveJavaBinary()
    expect(p).toMatch(/javaw\.exe$/)
    // explicitly NOT java.exe — Pitfall 7: java.exe spawns a phantom console window
    expect(p).not.toMatch(/[\\/]java\.exe$/)
    // JRE-03 invariant: path lives under resources/jre, never a system PATH java
    expect(p.replace(/\\/g, '/')).toContain('resources/jre/')
    expect(p.replace(/\\/g, '/')).toContain('win-x64')
  })

  it('resolveJavaBinary returns Contents/Home/bin/java on darwin', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    Object.defineProperty(process, 'arch', { value: 'x64', configurable: true })
    const { resolveJavaBinary } = await import('./paths')
    const p = resolveJavaBinary().replace(/\\/g, '/')
    expect(p).toContain('Contents/Home/bin/java')
    expect(p).toMatch(/\/java$/)
    // JRE-03 invariant
    expect(p).toContain('resources/jre/')
    expect(p).toContain('mac-x64')
  })

  it('resolveJavaBinary throws on linux / unsupported platforms', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    Object.defineProperty(process, 'arch', { value: 'x64', configurable: true })
    const { resolveJavaBinary } = await import('./paths')
    expect(() => resolveJavaBinary()).toThrow(/Unsupported platform/)
  })

  it('resolveJreDir produces mac-arm64 subdir on darwin+arm64', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    Object.defineProperty(process, 'arch', { value: 'arm64', configurable: true })
    const { resolveJreDir } = await import('./paths')
    expect(resolveJreDir().replace(/\\/g, '/')).toContain('jre/mac-arm64')
  })

  it('resolveJreDir produces win-x64 subdir on win32+x64', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    Object.defineProperty(process, 'arch', { value: 'x64', configurable: true })
    const { resolveJreDir } = await import('./paths')
    expect(resolveJreDir().replace(/\\/g, '/')).toContain('jre/win-x64')
  })

  it('resolveGameDir === <resolveDataRoot>/game (D-24)', async () => {
    const { resolveGameDir, resolveDataRoot } = await import('./paths')
    const root = resolveDataRoot()
    const game = resolveGameDir().replace(/\\/g, '/')
    expect(game).toBe(root.replace(/\\/g, '/') + '/game')
  })

  it('resolveSettingsFile === <resolveDataRoot>/settings.json', async () => {
    const { resolveSettingsFile, resolveDataRoot } = await import('./paths')
    const root = resolveDataRoot()
    const f = resolveSettingsFile().replace(/\\/g, '/')
    expect(f).toBe(root.replace(/\\/g, '/') + '/settings.json')
  })

  it('resolveCrashReportsDir === <resolveGameDir>/crash-reports (D-17)', async () => {
    const { resolveCrashReportsDir, resolveGameDir } = await import('./paths')
    const game = resolveGameDir()
    const crashes = resolveCrashReportsDir().replace(/\\/g, '/')
    expect(crashes).toBe(game.replace(/\\/g, '/') + '/crash-reports')
  })

  it('resolveModJar ends with /mod/wiiwho-0.1.0.jar in dev mode', async () => {
    // is.dev stays true from the default top-level vi.mock
    const { resolveModJar } = await import('./paths')
    const p = resolveModJar().replace(/\\/g, '/')
    expect(p).toMatch(/\/mod\/wiiwho-0\.1\.0\.jar$/)
    // in dev, base comes from app.getAppPath() — our fake returns '/fake/app'
    expect(p.startsWith('/fake/app/resources/mod/')).toBe(true)
  })

  it('resolveModJar uses process.resourcesPath when packaged (is.dev=false)', async () => {
    Object.defineProperty(process, 'resourcesPath', {
      value: '/packaged/resources',
      configurable: true
    })
    vi.resetModules()
    vi.doMock('@electron-toolkit/utils', () => ({ is: { dev: false } }))
    const { resolveModJar } = await import('./paths')
    const p = resolveModJar().replace(/\\/g, '/')
    expect(p).toBe('/packaged/resources/mod/wiiwho-0.1.0.jar')
  })

  it('resolveJavaBinary returned path begins with resources/jre/ (JRE-03 — bundled, never system PATH)', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    Object.defineProperty(process, 'arch', { value: 'x64', configurable: true })
    const { resolveJavaBinary } = await import('./paths')
    const p = resolveJavaBinary().replace(/\\/g, '/')
    // Must traverse resources/jre — this is the JRE-03 guardrail.
    expect(p).toContain('/resources/jre/')
  })
})
