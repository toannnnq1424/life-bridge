# Dữ liệu LifeBridge / LifeBridge data

Thư mục này chỉ chứa artefact dữ liệu nhỏ, có thể tái tạo, đã được review và an toàn để version-control. Phase 0 chưa nhập dataset bên ngoài.

This directory contains only small, reproducible, reviewed data artifacts that are safe for version control. Phase 0 imports no external dataset.

## Trạng thái / Current status

- `fixtures/README.md` defines the deterministic synthetic-fixture contract.
- No personal, health, child, household, facility or emergency record is present.
- No raw/public-use microdata is present.
- No World Bank/WHO/ITU snapshot has been copied yet; that is a separate future vertical slice.

## Được phép / Allowed

- deterministic fictional fixture records;
- tiny attributed aggregate snapshots with an explicit open license;
- schemas, checksums and provenance manifests;
- derived, disclosure-checked aggregate parameters approved by the data owner;
- bilingual documentation.

## Bị cấm / Forbidden

- real or plausible personal identifiers;
- real household addresses or precise home coordinates;
- health/disability/care notes tied to a person;
- child-level, beneficiary-level or respondent-level data;
- copied microdata, even when called anonymized/public-use;
- scraped service or disaster data represented as current;
- live API payload dumps;
- secrets, tokens, cookies or `.env` content;
- provider logos/photos/report tables without explicit permission.

## Planned structure / Cấu trúc dự kiến

Only create a directory when a validated slice needs it:

```text
data/
  README.md
  fixtures/
    README.md
    manifest.json              # future
    scenarios/*.json           # future synthetic records
  reference/
    <source>/<snapshot>.json   # future tiny open aggregate only
    <source>/<snapshot>.sha256
```

`raw/`, `downloads/`, `exports/` and analyst workspaces do not belong in Git. If a research slice needs them, use a controlled external workspace and record deletion.

## Provenance minimum

Every non-synthetic artifact must declare:

```yaml
artifact_id:
source_id:
publisher:
source_url:
terms_url:
license:
indicator_or_dataset:
geography:
reference_period:
retrieved_at:
transformation:
generated_by:
schema_version:
checksum:
```

Synthetic artifacts declare `synthetic: true`, generator version/seed and which research sources inspired the **scenario design**, not a claim that records came from those sources.

## Data lifecycle / Vòng đời

1. Register and score the source in `docs/research/`.
2. Define the narrow vertical slice and acceptance criteria.
3. Verify terms and reference period at implementation time.
4. Generate or extract the smallest possible artifact.
5. Validate schema, provenance, determinism and disclosure risk.
6. Review the diff for identifiers, secrets and copied source material.
7. Update research, implementation and session documentation.
8. Commit the coherent slice.
9. Revalidate or retire the artifact when source/method changes.

## Change policy

Changing a fixture/source is a versioned contract change. Record the affected phase/slice, reason, schema/migration impact, tests, rollback and whether completed slices need revalidation. Never replace a historical snapshot silently.

## References

- Source registry: [`../docs/research/DATA_SOURCE_REGISTER.md`](../docs/research/DATA_SOURCE_REGISTER.md)
- Evaluation matrix: [`../docs/research/DATASET_EVALUATION_MATRIX.md`](../docs/research/DATASET_EVALUATION_MATRIX.md)
- Governance: [`../docs/research/DATA_GOVERNANCE.md`](../docs/research/DATA_GOVERNANCE.md)
- Fixture contract: [`fixtures/README.md`](fixtures/README.md)
