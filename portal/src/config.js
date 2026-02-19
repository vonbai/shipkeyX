import path from "node:path";

const defaultDbPath = path.resolve("/data/portal.db");

export function getConfig() {
  return {
    appName: process.env.APP_NAME || "ShipkeyX Portal",
    port: Number(process.env.PORT || 8080),
    dbPath: process.env.SQLITE_PATH || defaultDbPath,
    repoRoot: process.env.REPO_ROOT || "/repo",
    sessionSecret: process.env.SESSION_SECRET || "dev-insecure-change-me",
    passwordHash: process.env.PORTAL_PASSWORD_HASH || "",
    passwordBootstrap: process.env.PORTAL_PASSWORD || "",
    passwordReset: process.env.PORTAL_PASSWORD_RESET === "true"
  };
}
