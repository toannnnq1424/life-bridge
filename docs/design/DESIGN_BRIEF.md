# LifeBridge Design Brief

## Product

LifeBridge coordinates family care and community support for older adults, disabled people, and people needing assistance.

Primary outcomes:

- Make daily care responsibilities visible and accountable.
- Reduce missed or duplicated tasks, medication, appointments, emergency steps, and handoffs.
- Preserve care-recipient agency, consent, and privacy.
- Connect households with trusted volunteers and organizations.
- Keep critical information understandable during stress or unreliable connectivity.

## Users and roles

| Role | Primary need | Safety boundary |
|---|---|---|
| Care recipient | Understand plans, express preferences, request help, control consent | Own privacy and consent choices |
| Family caregiver | Coordinate care, schedules, medication, documents, and emergencies | Access only granted household data |
| Household organizer | Invite members, assign roles, configure plans | Cannot bypass recipient consent |
| Household member | Complete assigned work and communicate status | Minimum role-scoped access |
| Volunteer | Find and complete approved support requests | Minimum necessary personal data |
| Organization coordinator | Manage referrals, capacity, matching, and delivery | Scoped organization and household access |
| Moderator | Resolve community safety reports | Moderation data only |
| Administrator | Manage platform policy, access, and audits | Least privilege; all actions auditable |

## Design principles

1. **Dignity first.** Treat care recipients as people with agency, not passive records.
2. **Safety over speed.** Make urgent actions unmistakable and destructive actions confirmable.
3. **Clear accountability.** Each task has an owner, due state, urgency, and visible status.
4. **Shared context, bounded access.** Show only consented data required for the current role.
5. **Accessible by default.** Keyboard, screen reader, zoom, touch, motion, contrast, language, and cognitive-load needs are baseline behavior.
6. **Reliable state visibility.** Explain loading, empty, stale, offline, denied, error, success, and recovery states.
7. **Progressive disclosure.** Keep daily work simple; expose planning, audit, policy, and administration detail when needed.
8. **Responsive, not reduced.** Mobile retains critical capability; larger layouts improve coordination without changing behavior.
9. **User control.** Explain permissions and automation; avoid surveillance-oriented UX.

## Core journeys

1. Create a household, invite collaborators, add a care recipient, and configure preferences.
2. Review daily care, complete or escalate a task, and record a handoff.
3. Create a medication schedule and respond to reminders.
4. Prepare and use an emergency plan.
5. Request community help and follow a volunteer match.
6. Review consent, privacy settings, and access history.
7. Resolve organization, moderation, and access issues.

Detailed contracts belong in `USER_FLOWS.md`.

## Information architecture

```text
Public
├─ Landing
├─ Login / registration / recovery / MFA
└─ Community directory

Household
├─ Dashboard
├─ Care recipient
├─ Timeline, tasks, calendar, appointments
├─ Care plan, medication, notifications
├─ Emergency, documents, help requests
├─ Consent, privacy, audit history
└─ Settings

Organization
├─ Organization dashboard
└─ Volunteer matching

Administration
└─ Moderation
```

## Design lifecycle

```text
Product requirements
→ UX flows
→ Low-fidelity structure
→ Stitch design generation or local wireframes
→ Design review
→ Accessibility review
→ Design freeze
→ Component specification
→ Frontend implementation
→ Consolidated frontend testing
```

Production source of truth remains:

```text
Git repository
→ design system
→ component contracts
→ application source code
→ automated tests
```

## Constraints and non-goals

- Stitch output is design input, not production source.
- Do not use real care-recipient data, production credentials, tokens, signed URLs, or private links in prompts, screenshots, prototypes, or exports.
- Do not copy generated HTML, CSS, scripts, tracking, CDN dependencies, placeholder credentials, inaccessible markup, or business logic directly into production.
- Do not provide automated diagnosis, care advice, or emergency-dispatch decisions.
- Do not require pixel-perfect matching when accessibility, security, localization, resilience, or maintainability requires divergence.
- Do not freeze a design until product, accessibility, privacy, and implementation reviews are recorded.

## Implementation gate

A screen can move to implementation only when its handoff records:

- Product requirement and user journey.
- Target route.
- Required components and API dependencies.
- Permission and consent requirements.
- Mobile, tablet, and desktop behavior.
- Keyboard navigation, focus order, accessible names, and error announcements.
- Loading, empty, error, permission-denied, and applicable offline states.
- Frozen design-baseline reference.
- Product, accessibility, privacy, and implementation review status.
- Linked implementation task.

## Stitch policy

Use Stitch only for concepts, screen flows, responsive references, screenshots, HTML reference imports, and design comparison.

Record project references in `STITCH_PROJECTS.md` without credentials, tokens, signed URLs, or sensitive project identifiers. Normalize approved output into design tokens, semantic component contracts, localization keys, responsive rules, and tested application flows.