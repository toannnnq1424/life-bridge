# Research Protocol / Giao thức nghiên cứu

## Purpose / Mục đích

This protocol turns research into bounded engineering decisions. It applies
before every future phase and vertical slice, but it does not require browsing
when the question is purely technical and existing verified evidence remains
applicable.

Nghiên cứu phải dẫn tới requirement, acceptance, test, non-goal, assumption,
hoặc quyết định không làm. Không nghiên cứu vô hạn và không biến feature của đối
thủ thành roadmap.

## Gate states

| State                   | Meaning                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `PASS`                  | Applicable evidence is sufficient for the scoped decision                                         |
| `PASS WITH ASSUMPTIONS` | Prototype work may proceed with named, bounded assumptions                                        |
| `BLOCKED`               | A missing high-risk source, owner decision, counsel, specialist, or user study prevents safe work |
| `NOT APPLICABLE`        | No product/market/safety evidence question exists; rationale is recorded                          |

## Source order

1. Applicable law and official government material.
2. International standards and official product/tool documentation.
3. Original research or reports with a clear method.
4. Official public-health or safety education.
5. National statistics.
6. Commercial/product benchmarks.
7. Blogs, reviews, and forums only to discover questions or primary sources.

## Evidence levels

| Level | Evidence                                                        | May create a requirement?                      |
| ----- | --------------------------------------------------------------- | ---------------------------------------------- |
| A     | Applicable law, standard, official guidance, national statistic | Yes, after applicability and limitation review |
| B     | Original/reputable research with method                         | Yes, with limitations and local context        |
| C     | Official product documentation or competitor evidence           | Benchmark only                                 |
| D     | Secondary article, review, forum                                | Research question only                         |
| E     | Unknown source/date/method                                      | No                                             |

A Level A source is a minimum input, not legal or clinical approval. High-risk
work can still require conflicting-source review, counsel, a subject-matter
expert, or direct user research.

## Source card

Every active source records:

- stable source ID;
- title and publisher;
- primary URL;
- access date and publication/update/reference dates;
- geography and population/sample/method, or `N/A`;
- evidence level;
- license/reuse terms;
- finding and limitation;
- privacy/sensitivity and fixture/background class;
- product decision;
- acceptance/test affected;
- `last_verified_at`;
- review trigger or `next_review_at`;
- outcome: `USE`, `PARTIAL`, `REJECT`, or `NEEDS FOLLOW-UP`.

Dataset records remain in `DATA_SOURCE_REGISTER.md`. Tool/integration evidence
belongs in the relevant operational document, not the dataset register.

## Phase research gate

Before opening the first slice:

- define no more than ten phase-level questions;
- review current official sources assigned to the phase;
- include Vietnamese evidence or state the gap when local market/privacy/service
  decisions are affected;
- list unvalidated assumptions and planned interviews;
- identify legal/safety/accessibility review;
- state fixture scenarios and Stitch screens;
- record validation impact and the gate state;
- use a Change ID before altering phase/slice order.

## Slice research micro-cycle

1. Write up to five questions that can change the slice.
2. Inspect the current source/assumption register.
3. Re-check only sources whose trigger fired.
4. Add the minimum primary evidence; benchmark at most three competitors.
5. Record no more than ten findings that directly change or confirm action.
6. Link each finding to acceptance, test, non-goal, assumption, or decision.
7. Declare the gate state.
8. Stop research when additional evidence no longer changes a decision.

## User-research safeguards

Before recruiting or recording a participant, define:

- purpose, participant group, inclusion/exclusion, and consent;
- synthetic scenario and minimum necessary data;
- recording policy, storage, access, retention, deletion, and withdrawal;
- compensation and contact handling;
- support/escalation if a session causes distress;
- Vietnamese language and accessible participation options.

Do not request a diagnosis, medication detail, or real care record merely to test
usability. Internal persona rehearsal is not completed user research.

Candidate groups include family caregivers in urban/rural contexts, older adults
with different living arrangements, keyboard/screen-reader/low-vision users,
professional caregivers, volunteers, and organization staff. Use only the groups
relevant to the active slice.

## Competitor safeguards

- use commercial products to learn interaction patterns and vocabulary;
- record applicability to Vietnam and patterns to avoid;
- never copy proprietary workflows, visual identity, claims, or feature lists;
- never infer market demand from one competitor.

## Re-check triggers

| Trigger                       | Evidence to re-check                                   |
| ----------------------------- | ------------------------------------------------------ |
| Start of a phase              | Official sources assigned to that phase                |
| Stitch activation/change      | Current official Google Stitch MCP documentation       |
| Codex workflow change         | Current official OpenAI Codex documentation            |
| Public privacy copy or pilot  | Applicable Vietnam law plus qualified review           |
| Accessibility claim           | Current standard and real test evidence                |
| Security/release gate         | Current OWASP/NIST or selected standards               |
| Public demographic claim      | Latest registered Vietnam source                       |
| Emergency or medication slice | Current local/official safety evidence and disclaimers |
| New market                    | Applicable market law and service context              |

CI validates schema and provenance offline. It must not scrape live sources to
manufacture freshness evidence.

## Research summary template

```md
## RESEARCH SUMMARY — [PHASE/SLICE]

- Gate: PASS | PASS WITH ASSUMPTIONS | BLOCKED | NOT APPLICABLE
- Questions:
- Sources and evidence levels:
- Findings and limitations:
- Vietnam applicability/evidence gap:
- Competitor benchmark:
- Decisions/non-goals:
- Acceptance/tests changed:
- Assumptions:
- Re-check trigger:
- Exact next action:
```
