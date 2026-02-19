# ShipkeyX Ops Mapping

`ops/mapping.json` stores low-risk operational metadata used by the portal and deterministic scanning defaults.

## Rules

- Do not store plaintext secrets in this file.
- SecretRefs high-risk apply confirmation flow is intentionally not implemented in this change.
- Mapping edits through the portal only perform local git commits. They never push to remotes.

## Files

- `ops/mapping.schema.json`: JSON Schema used for validation.
- `ops/mapping.json`: Current mapping state.

## Portal Workflow

1. Open `GET /mapping` to view current mapping.
2. Open `GET /mapping/edit` to edit raw JSON.
3. Submit `POST /mapping/edit`.
4. The portal parses JSON and validates against `ops/mapping.schema.json` using AJV.
5. If valid, it writes `ops/mapping.json` and attempts local commit:
   - Commit message: `chore(mapping): update via portal`
   - If commit fails, mapping file remains updated and the portal shows a flash error.

## Deterministic Scan Controls

- `scan.deterministic`: boolean switch for deterministic scanning behavior.
- `scan.includePaths`: explicit include roots/patterns.
- `scan.excludePaths`: explicit excludes.
