# Risk Register

| ID    | Risk                                                                | Likelihood |   Impact | Mitigation                                                                        | Owner/status         |
| ----- | ------------------------------------------------------------------- | ---------: | -------: | --------------------------------------------------------------------------------- | -------------------- |
| R-001 | Sensitive household/care data is over-collected or disclosed        |     Medium | Critical | minimum fields, consent, service ownership, redacted logs, synthetic tests        | Architecture; active |
| R-002 | Microservice/database count creates operational failure before MVP  |     Medium |     High | default PostgreSQL, engine ADR gate, vertical slices, defer unused services       | Architecture; active |
| R-003 | Stitch credential or prompt leaks data                              |     Medium | Critical | disabled config, runtime secret, synthetic prompts, prompt approval, canary       | Security; blocked    |
| R-004 | 35-screen backlog expands MVP                                       |       High |     High | three screens for Slice 1, change-control gate                                    | Product; active      |
| R-005 | `data`, `dev`, and `test` branches drift                            |     Medium |     High | one-way promotion, no direct commits, exact-commit validation                     | Integration; active  |
| R-006 | Recent public data lacks redistribution rights or Vietnam relevance |     Medium |     High | provenance/license matrix, fixture use classification, no raw commit              | Research; active     |
| R-007 | Docker/PowerShell environment prevents reproducible Windows setup   |     Medium |   Medium | `.cmd` shims, offline doctor, no policy/system change, classified optional checks | Tooling; active      |
| R-008 | Plan changes remain only in chat                                    |     Medium |     High | mandatory CHANGE_CONTROL/PLAN/BOARD/INTEGRATION/SESSION updates                   | Orchestrator; active |
