# Wiiwho Client — Azure AD Application Registration

**Registered:** 2026-04-20 (Phase 1, Plan 04)
**MCE review form submitted:** 2026-04-20 via https://aka.ms/mce-reviewappid
**Expected Microsoft approval window:** 2026-04-21 to 2026-04-27 (1-7 day SLA, per RESEARCH.md)

## Application Identity

| Field | Value |
|-------|-------|
| **Name (display)** | `Wiiwho Client` |
| **Application (client) ID** | `60cbce02-072b-4963-833d-edb6f5badc2a` |
| **Tenant ID (as shown in Azure portal)** | `91755ebc-8602-4281-970c-7be9bdfc35d7` |
| **Tenant** | consumers (Personal Microsoft accounts only — D-15) |
| **Owning account** | Project owner's personal Microsoft account (D-14) |
| **Owner contact email** | `eliyahu6666@outlook.com` |
| **Associated website** | `https://github.com/EliyahuMizrahi/wiiwho-client` |

> **Important — IDs are NOT secrets.** Both the Application (client) ID (`60cbce02-072b-4963-833d-edb6f5badc2a`) and the Tenant ID (`91755ebc-8602-4281-970c-7be9bdfc35d7`) are safe to commit to source. This is a **public client** running the **device code flow** (per D-18) — there is no client secret for this app type. Lunar Client, Prism, Helios, and prismarine-auth all ship their client IDs in source for the same reason.

## Status

| Item | State | Date | Notes |
|------|-------|------|-------|
| Application (client) ID | Issued | 2026-04-20 | `60cbce02-072b-4963-833d-edb6f5badc2a` |
| Tenant ID | Recorded | 2026-04-20 | `91755ebc-8602-4281-970c-7be9bdfc35d7` (as shown; Phase 2 uses `/consumers` authority string) |
| Azure AD app registered | Done | 2026-04-20 | `Wiiwho Client` under owner's personal MS account |
| Redirect URI configured | Done | 2026-04-20 | `https://login.microsoftonline.com/common/oauth2/nativeclient` |
| Public client flows | Enabled | 2026-04-20 | Required for device code flow |
| MCE review form | Submitted | 2026-04-20 | https://aka.ms/mce-reviewappid — confirmation screen received ("Thank you for contacting Mojang Studios") |
| MCE approval received | **Pending** | — | Email to `eliyahu6666@outlook.com`; expected 2026-04-21 → 2026-04-27 |
| Phase 2 auth flow unblocked | **Pending** | — | Blocks on MCE approval email |

## Why these specific values

| Choice | Decision | Rationale |
|--------|----------|-----------|
| Personal Microsoft account ownership | D-14 | Matches the personal / small-group distribution model; Mojang's Minecraft accounts are personal MS accounts. |
| "Personal Microsoft accounts only" audience | D-15 | Only valid config for a Minecraft launcher — MC accounts are on the consumers tenant. |
| Redirect URI `https://login.microsoftonline.com/common/oauth2/nativeclient` | D-16 (resolved) | Canonical public-client native redirect per Microsoft MSAL.NET docs. This is the URI MSAL Node's device-code flow expects; `prismarine-auth` (the library Phase 2 uses) also expects this. |
| Allow public client flows = Yes | MSAL / device-code requirement | Without this toggle, `/devicecode` endpoint returns an error. Confirmed via Microsoft Learn and MSAL.NET docs. |
| Client ID treated as non-secret | D-18 | Device code flow is a public client flow — there is no client secret. Committing the GUID to source is normal for this flow type. Every comparable OSS Minecraft launcher does the same. |
| `User.Read` only in portal; `XboxLive.signin` requested at runtime | Microsoft Q&A verified behavior | `XboxLive.signin` is NOT exposed in the Azure portal's "Request API permissions" UI. It is requested via OAuth scope at runtime, and consent happens during the device code flow. This is NOT a misconfiguration — do not add it in the portal. |

## What's configured in the Azure portal

### 1. Registration
- Display name: `Wiiwho Client`
- Supported account types: **Personal Microsoft accounts only** (consumers)
- Owning tenant: project owner's personal MS account (`eliyahu6666@outlook.com`)

### 2. Authentication
- Platform: Mobile and desktop applications
- Redirect URI: `https://login.microsoftonline.com/common/oauth2/nativeclient`
- Advanced settings → **Allow public client flows: Yes**

### 3. API permissions
- `User.Read` (default, delegated) — not modified
- `XboxLive.signin` is **NOT** listed in the portal — this is correct. It is requested via OAuth scope at runtime, not granted via Azure AD consent.

## Microsoft Review Queue (MCE form)

Submitted 2026-04-20 via https://aka.ms/mce-reviewappid. The owner received the Microsoft Forms confirmation screen ("Thank you for contacting Mojang Studios") after submission.

This form requests Microsoft's permission for our app to call `api.minecraftservices.com/authentication/login_with_xbox`. Without approval, that endpoint returns **403** regardless of how correct the MSAL / XBL / XSTS handshake is (RESEARCH.md §Pitfall 4 — "Azure app registered but Minecraft API form not submitted" — the canonical trap).

**Review timeline:**
- Typical: 1-7 days (per community sources — no official Microsoft SLA is published)
- Worst-case observed: multiple weeks
- Approval notification: arrives at the owner's MS-account email address (`eliyahu6666@outlook.com`)
- Status check: there is no public self-service status URL; the only signal is the email or a successful `login_with_xbox` call

**Phase 2 dependency:** Phase 2's full auth flow (MSAL → XBL → XSTS → Minecraft) is blocked at the final step until MCE approval. Phase 2's planning / discuss / research phases can start beforehand; Phase 2's execute cannot complete end-to-end without approval.

**If approval is slow (> 10 days):**
1. Re-submit the MCE form (second submission is accepted; reference the original 2026-04-20 submission date + client ID `60cbce02-072b-4963-833d-edb6f5badc2a` in the description field).
2. Open a Microsoft Q&A thread referencing this GUID and tenant ID, asking about review status.
3. As a last resort, contact Microsoft support via the owning MS account's support channel.

**If approval is rejected:**
1. Read the rejection reason carefully — most common is insufficient app description.
2. Fix the stated issue (usually the purpose field needs more detail about who uses the app and why).
3. Re-submit using the existing GUID (do NOT re-register the app — re-use the same client ID).

## How Phase 2 uses the client ID

The client ID is a non-secret constant. Phase 2 stores it in the launcher source at:

```typescript
// launcher/src/main/auth/config.ts (created in Phase 2)
export const AZURE_CLIENT_ID = '60cbce02-072b-4963-833d-edb6f5badc2a';
export const AZURE_AUTHORITY = 'https://login.microsoftonline.com/consumers';
export const AZURE_SCOPES = ['XboxLive.signin', 'offline_access'];
```

`prismarine-auth`'s configuration reads these values via MSAL Node. No client secret exists for this flow — device code flow is a public-client OAuth pattern.

> **Tenant ID in config:** Phase 2 uses the literal authority string `https://login.microsoftonline.com/consumers` (D-15) rather than the numeric tenant GUID (`91755ebc-8602-4281-970c-7be9bdfc35d7`). The GUID is recorded here for audit / re-registration purposes; the `/consumers` authority is what MSAL actually needs for personal-account sign-in.

## Known ambiguity (reference — not blocking)

Microsoft's MSAL.NET docs claim `AADSTS90133: Device Code flow is not supported under /common or /consumers`. The minecraft.wiki documentation says `/consumers` is **REQUIRED** for `XboxLive.signin`. Empirically, `/consumers` **WORKS** (prismarine-auth, Lunar Client, Prism Launcher, Helios Launcher all use this exact config). Phase 2 re-verifies empirically during execution; Phase 1 trusts the ecosystem evidence per D-15.

## Pitfalls for future maintainers

1. **GUID and Tenant ID are NOT secrets.** Public client / device code flow has no client secret. Safe in repo, safe in logs, safe in bug reports. Do not try to "protect" them as credentials — you will waste effort and break contributors' setups.
2. **Do NOT add `XboxLive.signin` in the Azure portal.** It is not exposed in the standard "Request API permissions" UI. It is requested via OAuth scope at runtime. Adding it in the portal (if it were exposed) would not change the runtime behavior.
3. **Re-registering the app resets the review queue.** If you register a second app because you "lost" the first one, you start the 1-7 day MCE review from scratch. Look up the existing GUID (`60cbce02-072b-4963-833d-edb6f5badc2a`) in the Azure portal first.
4. **Tenant type "consumers" means Personal MS accounts only.** Do NOT switch to "accounts in any organizational directory or personal Microsoft accounts" (multi-tenant) — it will pass portal validation but the Minecraft API will reject tokens issued against it.
5. **The associated website on the MCE form should be something Microsoft can look at.** The form reviewer uses it to sanity-check the app. Our GitHub repo (`https://github.com/EliyahuMizrahi/wiiwho-client`) fits that purpose.

## References

- `.planning/phases/01-foundations/01-RESEARCH.md` §Azure AD App Registration Playbook — the 8-step portal walkthrough
- `.planning/phases/01-foundations/01-RESEARCH.md` §Known ambiguity — device code flow tenant
- `.planning/phases/01-foundations/01-RESEARCH.md` §Pitfall 4 — "Azure app registered but Minecraft API form not submitted"
- `.planning/phases/01-foundations/01-CONTEXT.md` D-14 through D-18 (Azure AD decisions)
- `.planning/STATE.md` — full recorded decision with IDs and timestamps
- [Microsoft Learn: Register an application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [Microsoft Learn: Device Code Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code)
- [minecraft.wiki: Microsoft authentication](https://minecraft.wiki/w/Microsoft_authentication)
- [wiki.vg: Microsoft Authentication Scheme](https://wiki.vg/Microsoft_Authentication_Scheme)

---
*Registered 2026-04-20 as part of Phase 1 Foundations (phase success criterion 2). Review queue running. Phase 2 unblocked on approval.*
