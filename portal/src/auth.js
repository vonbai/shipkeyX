import bcrypt from "bcryptjs";
import { getSetting, setSetting } from "./db.js";

const PASSWORD_HASH_KEY = "portal_password_hash";

export async function ensurePasswordConfigured(db, config) {
  const existingHash = await getSetting(db, PASSWORD_HASH_KEY);

  if (config.passwordHash) {
    if (!config.passwordHash.startsWith("$2")) {
      throw new Error("PORTAL_PASSWORD_HASH must be a bcrypt hash.");
    }
    await setSetting(db, PASSWORD_HASH_KEY, config.passwordHash);
    return;
  }

  if (existingHash && !config.passwordReset) {
    return;
  }

  if (!config.passwordBootstrap) {
    throw new Error(
      "Portal password is not initialized. Set PORTAL_PASSWORD (or PORTAL_PASSWORD_HASH) and restart."
    );
  }

  const hash = await bcrypt.hash(config.passwordBootstrap, 12);
  await setSetting(db, PASSWORD_HASH_KEY, hash);
}

export async function verifyPassword(db, password) {
  const hash = await getSetting(db, PASSWORD_HASH_KEY);
  if (!hash) {
    return false;
  }
  return bcrypt.compare(password, hash);
}

export function requireAuth(req, res, next) {
  if (!req.session?.isAuthenticated) {
    return res.redirect("/login");
  }
  return next();
}
