import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import Ajv2020 from "ajv/dist/2020.js";

const execFileAsync = promisify(execFile);

function mappingPaths(repoRoot) {
  const opsDir = path.join(repoRoot, "ops");
  return {
    opsDir,
    mappingPath: path.join(opsDir, "mapping.json"),
    schemaPath: path.join(opsDir, "mapping.schema.json")
  };
}

export async function readMapping(repoRoot) {
  const { mappingPath } = mappingPaths(repoRoot);
  return fs.readFile(mappingPath, "utf8");
}

export async function validateMappingJson(repoRoot, jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${error.message}` };
  }

  const { schemaPath } = mappingPaths(repoRoot);
  const rawSchema = await fs.readFile(schemaPath, "utf8");
  const schema = JSON.parse(rawSchema);

  // Create a fresh AJV instance per validation to avoid duplicate $id collisions.
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  const valid = validate(parsed);
  if (!valid) {
    const issues = (validate.errors || [])
      .slice(0, 6)
      .map((item) => {
        const where = item.instancePath || "/";
        return `${where} ${item.message}`;
      })
      .join("; ");
    return { ok: false, error: `Schema validation failed: ${issues}` };
  }

  return { ok: true, value: parsed };
}

export async function writeMapping(repoRoot, value) {
  const { mappingPath } = mappingPaths(repoRoot);
  const text = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(mappingPath, text, "utf8");
  return text;
}

export async function commitMappingUpdate(repoRoot) {
  // We intentionally do not push.
  // Set user.name/email inline so git can commit even if global config is missing.
  const git = (args) =>
    execFileAsync("git", ["-c", "user.name=shipkeyx-portal", "-c", "user.email=shipkeyx-portal@local", ...args]);

  try {
    await git(["-C", repoRoot, "add", "--", "ops/mapping.json"]);
    await git([
      "-C",
      repoRoot,
      "commit",
      "-m",
      "chore(mapping): update via portal"
    ]);
    return { ok: true };
  } catch (error) {
    const stderr = String(error.stderr || "").trim();
    const stdout = String(error.stdout || "").trim();
    const detail = stderr || stdout || error.message;
    return { ok: false, error: detail };
  }
}
