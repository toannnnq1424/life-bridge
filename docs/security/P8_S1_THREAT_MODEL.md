# P8-S1 threat and data-flow model

Status: engineering threat model; not legal advice or certification
Reviewed: 2026-08-02

## Evidence

| Source                                             | Accessed   | Engineering use                                                         | Limitation                                             |
| -------------------------------------------------- | ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| OWASP API Security Top 10 2023, API1 BOLA          | 2026-08-02 | object authorization on every identifier-bearing function               | awareness guidance, not certification                  |
| OWASP API Security Top 10 2023, API5 BFLA          | 2026-08-02 | deny-by-default route/function matrix                                   | awareness guidance                                     |
| OWASP ASVS authorization controls                  | 2026-08-02 | centralized policy and negative testing                                 | verification guidance                                  |
| NIST SP 800-53 Rev. 5, AC-3/AC-6/AU controls       | 2026-08-02 | least privilege, separation and attributable audit                      | technology-neutral guidance                            |
| NIST SP 800-63 Rev. 4                              | 2026-08-02 | session/authentication lifecycle context                                | does not define LifeBridge household policy            |
| Vietnam Government, Decree 13/2023/ND-CP full text | 2026-08-02 | purpose limitation, minimum necessary handling, withdrawal-aware design | applicability and compliance require qualified counsel |

Primary URLs are recorded in `contracts/authorization/p8-s1-policy.json`.
Legal material informs conservative engineering controls only. This slice makes
no claim that LifeBridge is deployed in Vietnam or legally compliant.

## Assets and trust boundaries

Assets are account/session state; household membership and invitations;
recipient context; consent grants and privacy versions; Care tasks, timeline,
appointments, plans, reminders, emergency and document records; Notification
delivery evidence; Community protected requests/matches/moderation; redacted
audit, outbox/inbox and recovery evidence.

```text
browser (untrusted ids/body)
  -> Gateway (session, origin/CSRF, route policy)
     -> Identity (membership + consent authority)
        -> Identity-owned PostgreSQL
     -> Care / Notification / Community (service identity + bound decision)
        -> owner-only PostgreSQL
recovery operator -> exact recovery scope -> owner replay/reconcile only
```

The attacker may be anonymous, an authenticated member of another household,
a revoked or stale member, a client changing object/owner fields, a replaying
caller, a compromised service credential with the wrong audience/scope, or an
operator attempting an ordinary user path. Fixture/debug identity is an
attacker-controlled input outside local/test mode.

## Abuse cases and required invariants

- Guessing a household/object/cursor must reveal no existence, count, ID,
  metadata or relationship. Collection and object predicates both include the
  accepted household/resource context.
- Unknown role/resource/operation/service combinations deny. Client-supplied
  owner, actor or household fields never establish authority.
- A grant, privacy or membership version superseded before the protected use
  cannot win. Duplicate/out-of-order state cannot lower the current epoch.
- Identity outage, malformed/expired/tampered decisions and mixed-version
  missing fields fail closed. Confirmed owner data is not rolled back or
  corrupted by authorization failure.
- Human, Gateway, event producer and recovery operator identities remain
  distinct. Service assertions bind declared key, caller, audience and exact
  scope. Datastore roles cannot access peer-owned schemas or migration powers.
- Audit records decision/result/reason and pseudonymous references without
  protected payloads, contacts, titles, tokens or raw enumeration targets.
