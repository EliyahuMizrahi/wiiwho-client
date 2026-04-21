import { describe, it, expect } from 'vitest'
import { mapAuthError } from '../xstsErrors'

// Verbatim prismarine-auth 3.1.1 messages, from src/common/Constants.js
// (https://github.com/PrismarineJS/prismarine-auth/blob/master/src/common/Constants.js)
const PRISMARINE_MSGS: Record<number, string> = {
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

describe('mapAuthError', () => {
  describe('XSTS codes (D-10 locked copy)', () => {
    it('2148916233 → no Xbox profile message + xbox.com/live', () => {
      const r = mapAuthError(new Error(`2148916233: ${PRISMARINE_MSGS[2148916233]}`))
      expect(r.code).toBe(2148916233)
      expect(r.message).toBe(
        "This Microsoft account doesn't have an Xbox profile yet. Create one at xbox.com and try again."
      )
      expect(r.helpUrl).toBe('https://www.xbox.com/en-US/live')
    })

    it('2148916235 → country-blocked message + country-availability', () => {
      const r = mapAuthError(new Error(`2148916235: ${PRISMARINE_MSGS[2148916235]}`))
      expect(r.code).toBe(2148916235)
      expect(r.message).toMatch(/country/i)
      expect(r.helpUrl).toBe(
        'https://www.xbox.com/en-US/legal/country-availability'
      )
    })

    it('2148916236 → age-verification message + xbox.com profile', () => {
      const r = mapAuthError(new Error(`2148916236: ${PRISMARINE_MSGS[2148916236]}`))
      expect(r.code).toBe(2148916236)
      expect(r.message).toBe(
        'Your Xbox account needs age verification before it can use Minecraft.'
      )
      expect(r.helpUrl).toBe(
        'https://account.xbox.com/en-US/Profile?activetab=main:mainTab2'
      )
    })

    it('2148916237 → same age-verification message as 236', () => {
      const r = mapAuthError(new Error(`2148916237: ${PRISMARINE_MSGS[2148916237]}`))
      expect(r.code).toBe(2148916237)
      expect(r.message).toBe(
        'Your Xbox account needs age verification before it can use Minecraft.'
      )
      expect(r.helpUrl).toBe(
        'https://account.xbox.com/en-US/Profile?activetab=main:mainTab2'
      )
    })

    it('2148916238 → Family group message + account.microsoft.com/family', () => {
      const r = mapAuthError(new Error(`2148916238: ${PRISMARINE_MSGS[2148916238]}`))
      expect(r.code).toBe(2148916238)
      expect(r.message).toMatch(/Microsoft Family/)
      expect(r.helpUrl).toBe('https://account.microsoft.com/family/')
    })

    it('unrecognized 21489162XX → generic code message + support.xbox.com', () => {
      const r = mapAuthError(new Error('XSTS 2148916299 — new unknown code'))
      expect(r.code).toBe(2148916299)
      expect(r.message).toBe(
        'Microsoft sign-in failed (code 2148916299). Try again, or click Help for more info.'
      )
      expect(r.helpUrl).toBe('https://support.xbox.com/')
    })
  })

  describe('entitlement + network fallbacks', () => {
    it('NO_MC_PROFILE → purchase page helpUrl', () => {
      const r = mapAuthError(new Error('NO_MC_PROFILE'))
      expect(r.code).toBeNull()
      expect(r.message).toBe(
        "This Microsoft account doesn't own Minecraft Java Edition."
      )
      expect(r.helpUrl).toBe(
        'https://www.minecraft.net/en-us/store/minecraft-java-bedrock-edition-pc'
      )
    })

    it('message "does not own minecraft" → purchase page (case-insensitive)', () => {
      const r = mapAuthError(new Error('Account does not own minecraft java.'))
      expect(r.helpUrl).toMatch(/minecraft\.net/)
    })

    const networkCodes = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN']
    networkCodes.forEach((code) => {
      it(`${code} → network error view with null helpUrl`, () => {
        const e = new Error('fetch failed') as NodeJS.ErrnoException
        e.code = code
        const r = mapAuthError(e)
        expect(r.helpUrl).toBeNull()
        expect(r.message).toBe(
          "Can't reach Microsoft — check your internet connection."
        )
      })
    })

    it('bare "fetch failed" message (no code) → network error view', () => {
      const r = mapAuthError(new Error('fetch failed'))
      expect(r.message).toMatch(/check your internet connection/i)
      expect(r.helpUrl).toBeNull()
    })

    it('generic Error → generic fallback + support.xbox.com', () => {
      const r = mapAuthError(new Error('something unexpected blew up'))
      expect(r.code).toBeNull()
      expect(r.message).toBe(
        'Something went wrong while signing in. Try again, or click Help for more info.'
      )
      expect(r.helpUrl).toBe('https://support.xbox.com/')
    })

    it('non-Error input (bare string) → generic fallback, no crash', () => {
      const r = mapAuthError('bare string not an Error')
      expect(r.code).toBeNull()
      expect(r.helpUrl).toBe('https://support.xbox.com/')
    })

    it('undefined input → generic fallback, no crash', () => {
      const r = mapAuthError(undefined)
      expect(r.code).toBeNull()
      expect(r.helpUrl).toBe('https://support.xbox.com/')
    })
  })
})
