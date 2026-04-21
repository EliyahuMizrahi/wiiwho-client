/**
 * XSTS + entitlement error mapper.
 *
 * prismarine-auth throws `new Error(xboxLiveErrors[code])` with verbatim Microsoft
 * messages; the numeric XErr code is not exposed as a structured field (Pitfall 2).
 * We parse the code from err.message via regex and map to the UI-SPEC D-10 locked
 * copy. Unrecognized codes fall through to a generic message carrying the code.
 *
 * Source of truth for copy: .planning/phases/02-microsoft-authentication/02-UI-SPEC.md §ErrorBanner
 */

export interface AuthErrorView {
  readonly code: number | null
  readonly message: string
  readonly helpUrl: string | null
}

const XSTS_CODE_REGEX = /\b(2148916\d{3})\b/

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
        message:
          'Your Xbox account needs age verification before it can use Minecraft.',
        helpUrl:
          'https://account.xbox.com/en-US/Profile?activetab=main:mainTab2'
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

  // NO_MC_PROFILE sentinel — raised by AuthManager when getMinecraftJavaToken's
  // profile fetch returns null (account doesn't own Minecraft Java Edition).
  if (raw === 'NO_MC_PROFILE' || /does not own minecraft/i.test(raw)) {
    return {
      code: null,
      message:
        "This Microsoft account doesn't own Minecraft Java Edition.",
      helpUrl:
        'https://www.minecraft.net/en-us/store/minecraft-java-bedrock-edition-pc'
    }
  }

  // Mojang rejects login_with_xbox with 403 + "Invalid app registration" while
  // the Azure client ID is awaiting MCE (Minecraft API) approval. The body
  // Mojang emits always includes the canonical `aka.ms/AppRegInfo` link.
  // Happens pre-approval even when the upstream XBL/XSTS chain succeeds — so
  // mapping must live AFTER the XSTS switch and the NO_MC_PROFILE branch.
  if (/invalid app registration/i.test(raw) || /aka\.ms\/AppRegInfo/i.test(raw)) {
    return {
      code: null,
      message:
        'Waiting on Microsoft approval for Minecraft access. Try again after the approval email arrives.',
      helpUrl: 'https://aka.ms/AppRegInfo'
    }
  }

  if (isNetworkError(err)) {
    return {
      code: null,
      message:
        "Can't reach Microsoft — check your internet connection.",
      helpUrl: null
    }
  }

  if (code !== null) {
    return {
      code,
      message: `Microsoft sign-in failed (code ${code}). Try again, or click Help for more info.`,
      helpUrl: 'https://support.xbox.com/'
    }
  }

  return {
    code: null,
    message:
      'Something went wrong while signing in. Try again, or click Help for more info.',
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
