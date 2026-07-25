# Assumption Register / Sổ giả định

## Rules

An assumption is not a fact or public claim. Give it a stable ID, risk, owner,
validation method, target slice, and state. When evidence changes an assumption,
link the source and update Change Control if scope/order/acceptance changes.

Allowed states:

- `Proposed`
- `Unvalidated`
- `Partially supported`
- `Validated for scope`
- `Rejected`
- `Superseded`

## Current assumptions

| ID        | Assumption                                                          | Evidence state                     | Risk                   | Validation method                                              | Target              | Status      |
| --------- | ------------------------------------------------------------------- | ---------------------------------- | ---------------------- | -------------------------------------------------------------- | ------------------- | ----------- |
| `ASM-001` | Families will coordinate care in a shared digital household/circle  | Public background only             | Product adoption       | Vietnamese caregiver interviews and P1 prototype tasks         | P1/P2               | Unvalidated |
| `ASM-002` | A responsive web/PWA surface can serve critical older-user flows    | No local device evidence           | Accessibility/adoption | Device-based usability with older and disabled users           | P1 then P6          | Unvalidated |
| `ASM-003` | Organizations need caseload tooling in the same product boundary    | No stakeholder evidence            | Scope/architecture     | Organization interviews and authorization model review         | Post-P5 change gate | Unvalidated |
| `ASM-004` | Volunteer matching is useful and safe in the Vietnam context        | Foreign/commercial benchmarks only | Safety/privacy         | Community-organization research, safeguarding and legal review | P5                  | Unvalidated |
| `ASM-005` | Offline Today/emergency access is a high-priority need              | Plausible network/context gap      | Safety/security        | Context interviews, threat model, and P6 prototype tests       | P4/P6               | Unvalidated |
| `ASM-006` | Vietnamese and English are sufficient for the first intended market | Owner intent only                  | Inclusion/market       | Market definition and participant-language research            | P2/release          | Unvalidated |

## Validation record template

```md
### ASM-XXX — YYYY-MM-DD

- Phase/slice:
- Question:
- Evidence/source IDs:
- Method/participants:
- Finding and limitation:
- Decision:
- New state:
- Acceptance/tests affected:
- Change ID, if any:
- Next review trigger:
```
