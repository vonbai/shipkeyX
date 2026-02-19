import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { validateMappingJson } from "../src/mapping.js";

async function createTempRepoWithSchema() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "shipkeyx-mapping-"));
  const opsDir = path.join(root, "ops");
  await fs.mkdir(opsDir, { recursive: true });

  const schemaSrc = path.resolve("..", "ops", "mapping.schema.json");
  const schemaDst = path.join(opsDir, "mapping.schema.json");
  await fs.copyFile(schemaSrc, schemaDst);

  return root;
}

test("validateMappingJson accepts valid mapping payload", async () => {
  const repoRoot = await createTempRepoWithSchema();
  const result = await validateMappingJson(
    repoRoot,
    JSON.stringify({
      version: 1,
      connections: [],
      scan: {
        deterministic: true,
        includePaths: ["src"],
        excludePaths: ["node_modules"]
      },
      future: {
        secretRefsApplyFlow: "stub_only"
      }
    })
  );

  assert.equal(result.ok, true);
});

test("validateMappingJson rejects invalid mapping payload", async () => {
  const repoRoot = await createTempRepoWithSchema();
  const result = await validateMappingJson(
    repoRoot,
    JSON.stringify({
      version: 1,
      connections: [],
      scan: {
        deterministic: "yes",
        includePaths: [],
        excludePaths: []
      }
    })
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /Schema validation failed/);
});
