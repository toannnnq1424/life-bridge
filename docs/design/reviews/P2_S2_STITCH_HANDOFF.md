# P2-S2 Stitch Handoff — Household, Invitation, and Care-Recipient Context

## Control

- Screens: `LB-008`–`LB-010`
- Status: **Frozen**
- Design source: official Google Stitch MCP, bounded synthetic generation
- Reference aliases: `P2S2-LB-008`, `P2S2-LB-009`, `P2S2-LB-010`
- Private project/screen locators: intentionally omitted
- Generated source imported: **No**
- Production authority: repository contracts, the P2-S2 threat model, this
  reviewed handoff, and automated tests

## Provenance and review boundary

The official Stitch MCP was used with the single existing LifeBridge project
and its existing design system. The post-reload `list_screens` preflight was
read-only. One bounded synthetic generation request was made for each planned
screen after the uncertain earlier LB-008 attempt was confirmed absent. No
project was created, deleted, exposed, or duplicated. No generated source,
download URL, signed URL, remote identifier, credential, real identity, care
record, or production data was copied into the repository.

Stitch output is untrusted reference input. The independent product,
accessibility, privacy, and security review below overrides generated wording
and behaviors where they differ from repository contracts.

## Frozen screen aliases

| Alias         | Screen                         | Route concept                                 | Frozen purpose                                                                                  |
| ------------- | ------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `P2S2-LB-008` | Household creation             | `/households/new`                             | Atomic household creation; creator becomes active organizer with only frozen slice capabilities |
| `P2S2-LB-009` | Invitation and decision        | `/households/:id/invitations`, `/invitations` | One bounded caregiver/member invitation and generic verified-account accept/decline             |
| `P2S2-LB-010` | Minimum care-recipient context | `/households/:id/recipient-context`           | Safe display and relationship labels only; organizer edits and active members view              |

## Permission and consent contract

An authenticated account has no household access by itself. Household creation
atomically grants the creator an active organizer membership. Only an organizer
can create, resend, or revoke an invitation and establish recipient context.
Caregiver and member roles can view the household and confirmed minimum
recipient context; neither role can manage invitations, membership, household
authority, or recipient context. Organizer wording never implies legal
ownership, guardianship, medical authority, or consent authority.

Invitation creation accepts only `caregiver` or `member`. The organizer sees the
same generic pending projection whether the fictional login maps to an active
account or a decoy lifecycle. No account preflight, existence check, avatar,
contact echo, permission checkbox, organizer role option, member removal, or
role-change action is permitted. The raw invitation token never appears in
headings, live regions, URL, history, browser storage, logs, screenshots, or
retained browser artifacts.

LB-010 contains only a safe display label, a neutral relationship label, and a
version. It is orientation context, not a medical record, care recommendation,
legal authority, or consent grant. Diagnoses, symptoms, medications, inferred
needs or relationships, clinical notes, emergency data, address, contact data,
files, and consent controls are prohibited. Consent mutation remains P2-S3.

## State and recovery matrices

| Screen | Required states                                                                                                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LB-008 | loading/session check, empty form, validation, conflict/rate/service failure, generic denied/not-found, offline blocked, busy, confirmed                                                   |
| LB-009 | loading, pending, accepted, declined, expired, revoked, resend throttled, stale-version conflict, generic denied/not-found, offline blocked, uncertain transport with refresh-before-retry |
| LB-010 | loading, no context, confirmed view, organizer edit, validation, stale-version conflict, generic denied/not-found, service failure, offline blocked, confirmed save                        |

All mutations are atomic. Offline fields may remain in current component memory,
but the UI says the action was not sent and never queues or submits on
reconnect. “Partial save,” draft persistence, background sync, and automatic
retry are rejected. When a transport result is uncertain, the UI distinguishes
confirmed from not confirmed and requires refresh before an explicit retry.
Conflicts reload the current version; values are never silently merged.

Invitation terminal states are distinct. Resend and revoke use the displayed
expected version, disable stale controls, and recover by loading current state.
Accept/decline begins as a generic review shell and discloses no household,
inviter, membership, or recipient detail before the intended signed-in account
submits a valid token in the request body. Protected absent and inaccessible
resources share the same response structure and recovery.

## VI/EN and accessibility contract

Vietnamese and English have meaning parity. Account, household, organizer,
caregiver, member, invitation, and care-recipient context remain distinct;
“organizer” is never translated as legal owner or guardian. Generic denial,
not-found, and account-existence-safe results use matching structure, severity,
focus, and recovery in both locales. Dictionary key parity is automated.

Each route has a skip link, named `main`, one focusable `h1`, native
label/input/select/radio/button controls, visible required indicators, and a
logical keyboard order. Role consequences are adjacent to and announced with
the role choice. Field errors use `aria-describedby`; invalid submit focuses a
linked summary. Async status is persistent and polite; actionable errors use
one restrained alert. Busy controls expose disabled and `aria-busy`. Focus
returns to the triggering action or a safe successor after state changes.
Terminal state never relies only on color, icon, or toast.

Automated evidence must cover keyboard operation, visible focus, axe, 320 CSS
pixel and 400% reflow without two-dimensional scrolling, long Vietnamese,
reduced motion, forced colors, and offline no-request/no-auto-submit behavior.
Manual NVDA/Narrator, text-spacing, and physical-device observation remain
honestly unexecuted unless separately recorded.

## Explicit Stitch corrections

- LB-008: reject partial save, queued offline creation, reconnect auto-submit,
  and any legal ownership or consent implication.
- LB-009: reject account-existence validation, identity/contact echo, organizer
  role choice, member removal or role management, raw-token display,
  partial-save wording, and offline queueing.
- LB-010: reject all clinical, inferred, legal, emergency, contact, upload, and
  consent-mutation content. Replace generated “partial save” wording with
  atomic confirmed/not-confirmed recovery.
- All screens: generated HTML/source and private remote locators are not
  implementation inputs.

## Review decision

- Product: **Approved** for the minimum P2-S2 slice with the corrections above.
- Accessibility: **Approved for native implementation**, subject to automated
  and disclosed manual evidence.
- Privacy/security: **Approved** with synthetic-only provenance, generic
  anti-enumeration behavior, token containment, and minimum context.
- Architecture/data: **Approved** against the existing Identity & Consent
  PostgreSQL ownership boundary; no new service, datastore, or ADR.
- Implementation: **Frozen for native project implementation**.

The design-reference portion of `MCP-DEBT-2026-003` is resolved by this Frozen
handoff. Native LB-008–LB-010 implementation and the one local Level C campaign
now pass; the debt closes only after exact-head CI, merge-commit promotion and
post-merge `dev` CI also pass.
