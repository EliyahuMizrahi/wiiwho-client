/**
 * @vitest-environment jsdom
 *
 * Plan 04-00 Wave 0 scaffold — antiBloat integration guardrails.
 *
 * Plan 04-07 (integration + docs) fills this in with the real
 * dependency-allowlist + bundle-size + banned-import assertions.
 */

import { describe, it, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

describe('antiBloat — Wave 0 scaffold', () => {
  afterEach(cleanup)
  it.todo('Plan 04-07 will implement real tests here (dependency allowlist + bundle size)')
})
