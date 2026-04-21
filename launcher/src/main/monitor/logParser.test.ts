// @vitest-environment node
/**
 * Tests for logParser.ts.
 *
 * Pin points:
 *   - D-16: Main-menu sentinel detection via stdout pattern match, fires exactly once.
 *   - D-11: Log ring buffer retains last 500 lines; failure tail is last 30.
 *   - RESEARCH §Main-Menu Detection fallback safety valve: 30s timer fires onMainMenu
 *     anyway so the launcher never hangs on an undetected boot.
 *
 * Fixture: __fixtures__/1.8.9-boot-log.txt — verbatim 1.8.9 Forge boot log; the
 * `Sound engine started` sentinel appears exactly once at line 11.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  LogParser,
  LogRingBuffer,
  MAIN_MENU_PATTERN,
  MAIN_MENU_TIMEOUT_MS
} from './logParser'

const FIXTURE_PATH = path.join(__dirname, '__fixtures__', '1.8.9-boot-log.txt')
const FIXTURE = readFileSync(FIXTURE_PATH, 'utf8')
const FIXTURE_LINES = FIXTURE.split(/\r?\n/).filter((l) => l.length > 0)

describe('logParser — constants', () => {
  it('MAIN_MENU_TIMEOUT_MS is 30_000 (30s fallback per RESEARCH §Main-Menu Detection)', () => {
    expect(MAIN_MENU_TIMEOUT_MS).toBe(30_000)
  })

  it('MAIN_MENU_PATTERN matches the exact fixture sentinel line (D-16)', () => {
    const sentinel = '[12:35:00] [Sound Library Loader/INFO]: Sound engine started'
    expect(MAIN_MENU_PATTERN.test(sentinel)).toBe(true)
  })

  it('MAIN_MENU_PATTERN does NOT match an arbitrary unrelated INFO line', () => {
    const other = '[12:34:57] [Client thread/INFO]: Setting user: Wiiwho'
    expect(MAIN_MENU_PATTERN.test(other)).toBe(false)
  })

  it('MAIN_MENU_PATTERN does NOT match the "OpenAL initialized." line that precedes the sentinel', () => {
    const openAl = '[12:35:00] [Thread-8/INFO]: OpenAL initialized.'
    expect(MAIN_MENU_PATTERN.test(openAl)).toBe(false)
  })
})

describe('logParser — LogRingBuffer', () => {
  it('caps entries at 500 — push 1000, only last 500 retained', () => {
    const buf = new LogRingBuffer()
    for (let i = 0; i < 1000; i++) buf.push({ line: `line-${i}`, stream: 'out' })
    const all = buf.tail(1000)
    expect(all.length).toBe(500)
    expect(all[0].line).toBe('line-500') // oldest retained is index 500
    expect(all[499].line).toBe('line-999')
  })

  it('.tail(30) returns the last 30 entries', () => {
    const buf = new LogRingBuffer()
    for (let i = 0; i < 100; i++) buf.push({ line: `l-${i}`, stream: 'out' })
    const tail = buf.tail(30)
    expect(tail.length).toBe(30)
    expect(tail[0].line).toBe('l-70')
    expect(tail[29].line).toBe('l-99')
  })

  it('.tail(n) returns all entries when fewer than n present', () => {
    const buf = new LogRingBuffer()
    buf.push({ line: 'a', stream: 'out' })
    buf.push({ line: 'b', stream: 'err' })
    const tail = buf.tail(30)
    expect(tail.length).toBe(2)
    expect(tail[0]).toEqual({ line: 'a', stream: 'out' })
    expect(tail[1]).toEqual({ line: 'b', stream: 'err' })
  })

  it('entries preserve {line, stream: "out"|"err"} shape', () => {
    const buf = new LogRingBuffer()
    buf.push({ line: 'hello', stream: 'out' })
    buf.push({ line: 'uh oh', stream: 'err' })
    const tail = buf.tail(2)
    expect(tail[0].stream).toBe('out')
    expect(tail[1].stream).toBe('err')
  })
})

describe('logParser — LogParser sentinel + ingest', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ingesting the fixture boot log fires onMainMenu exactly ONCE', () => {
    const onMainMenu = vi.fn()
    const onLine = vi.fn()
    const parser = new LogParser({ onMainMenu, onLine })
    for (const line of FIXTURE_LINES) parser.ingest(line, 'out')
    expect(onMainMenu).toHaveBeenCalledTimes(1)
    expect(onMainMenu).toHaveBeenCalledWith({ reason: 'sentinel' })
    parser.stop()
  })

  it('onLine fires for every non-blank ingested line', () => {
    const onLine = vi.fn()
    const parser = new LogParser({ onLine })
    for (const line of FIXTURE_LINES) parser.ingest(line, 'out')
    expect(onLine).toHaveBeenCalledTimes(FIXTURE_LINES.length)
    parser.stop()
  })

  it('sentinel does NOT fire on "OpenAL initialized." — only on "Sound engine started"', () => {
    const onMainMenu = vi.fn()
    const parser = new LogParser({ onMainMenu })
    parser.ingest('[12:35:00] [Thread-8/INFO]: OpenAL initialized.', 'out')
    expect(onMainMenu).not.toHaveBeenCalled()
    parser.ingest('[12:35:00] [Sound Library Loader/INFO]: Sound engine started', 'out')
    expect(onMainMenu).toHaveBeenCalledTimes(1)
    parser.stop()
  })

  it('ingesting the sentinel line twice calls onMainMenu only once (one-shot per launch)', () => {
    const onMainMenu = vi.fn()
    const parser = new LogParser({ onMainMenu })
    parser.ingest('[12:35:00] [Sound Library Loader/INFO]: Sound engine started', 'out')
    parser.ingest('[12:35:00] [Sound Library Loader/INFO]: Sound engine started', 'out')
    expect(onMainMenu).toHaveBeenCalledTimes(1)
    parser.stop()
  })

  it('ingested lines land in ringBuffer for fail-path tail', () => {
    const parser = new LogParser({})
    parser.ingest('line A', 'out')
    parser.ingest('line B', 'err')
    const tail = parser.ringBuffer.tail(5)
    expect(tail).toEqual([
      { line: 'line A', stream: 'out' },
      { line: 'line B', stream: 'err' }
    ])
    parser.stop()
  })
})

describe('logParser — LogParser fallback timer (RESEARCH safety valve)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires onMainMenu with reason="timeout" after mainMenuTimeoutMs if sentinel never seen', () => {
    const onMainMenu = vi.fn()
    const parser = new LogParser({ onMainMenu, mainMenuTimeoutMs: 100 })
    parser.ingest('[12:34:57] [Client thread/INFO]: Loading textures', 'out')
    expect(onMainMenu).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(onMainMenu).toHaveBeenCalledTimes(1)
    expect(onMainMenu).toHaveBeenCalledWith({ reason: 'timeout' })
    parser.stop()
  })

  it('an earlier sentinel cancels the fallback timer — onMainMenu fires once total with reason="sentinel"', () => {
    const onMainMenu = vi.fn()
    const parser = new LogParser({ onMainMenu, mainMenuTimeoutMs: 100 })
    parser.ingest('[12:35:00] [Sound Library Loader/INFO]: Sound engine started', 'out')
    expect(onMainMenu).toHaveBeenCalledTimes(1)
    expect(onMainMenu).toHaveBeenCalledWith({ reason: 'sentinel' })
    // Advance past the original deadline — timer should be cancelled, no second call.
    vi.advanceTimersByTime(1000)
    expect(onMainMenu).toHaveBeenCalledTimes(1)
    parser.stop()
  })

  it('stop() cancels the fallback timer and ignores further ingests', () => {
    const onMainMenu = vi.fn()
    const onLine = vi.fn()
    const parser = new LogParser({ onMainMenu, onLine, mainMenuTimeoutMs: 100 })
    parser.stop()
    // After stop: further ingests are ignored.
    parser.ingest('[12:35:00] [Sound Library Loader/INFO]: Sound engine started', 'out')
    expect(onLine).not.toHaveBeenCalled()
    expect(onMainMenu).not.toHaveBeenCalled()
    // And the timer never fires.
    vi.advanceTimersByTime(1000)
    expect(onMainMenu).not.toHaveBeenCalled()
  })

  it('defaults to MAIN_MENU_TIMEOUT_MS when mainMenuTimeoutMs is omitted', () => {
    const onMainMenu = vi.fn()
    const parser = new LogParser({ onMainMenu })
    // Just under the default: should NOT fire.
    vi.advanceTimersByTime(MAIN_MENU_TIMEOUT_MS - 1)
    expect(onMainMenu).not.toHaveBeenCalled()
    // Cross the default threshold: should fire.
    vi.advanceTimersByTime(1)
    expect(onMainMenu).toHaveBeenCalledTimes(1)
    expect(onMainMenu).toHaveBeenCalledWith({ reason: 'timeout' })
    parser.stop()
  })
})
