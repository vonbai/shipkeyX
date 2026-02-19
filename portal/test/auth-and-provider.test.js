import test from "node:test";
import assert from "node:assert/strict";
import { initDb, getSetting } from "../src/db.js";
import { ensurePasswordConfigured, verifyPassword } from "../src/auth.js";
import { SecretProviderClient } from "../src/op-client.js";

test("password is stored as bcrypt hash and verifies", async () => {
  const db = await initDb(":memory:");

  await ensurePasswordConfigured(db, {
    passwordHash: "",
    passwordBootstrap: "super-secret-password",
    passwordReset: false
  });

  const stored = await getSetting(db, "portal_password_hash");
  assert.ok(stored);
  assert.match(stored, /^\$2/);
  assert.equal(await verifyPassword(db, "super-secret-password"), true);
  assert.equal(await verifyPassword(db, "wrong"), false);
});

test("secret provider stub validates op URI", async () => {
  const client = new SecretProviderClient();
  assert.equal((await client.validateReference("op://vault/item/field")).ok, true);
  assert.equal((await client.validateReference("https://example.com")).ok, false);
});
