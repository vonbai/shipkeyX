import express from "express";
import session from "express-session";
import { getConfig } from "./config.js";
import { initDb } from "./db.js";
import { ensurePasswordConfigured, requireAuth, verifyPassword } from "./auth.js";
import {
  loginPage,
  runbookFormPage,
  runbooksListPage,
  secretRefFormPage,
  secretRefsListPage
} from "./views.js";
import { SecretProviderClient } from "./op-client.js";

const config = getConfig();
const app = express();
const secretProvider = new SecretProviderClient();

app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 8 * 60 * 60 * 1000
    }
  })
);

function takeFlash(req) {
  const flash = req.session?.flash || "";
  if (req.session) {
    req.session.flash = "";
  }
  return flash;
}

function setFlash(req, message) {
  if (req.session) {
    req.session.flash = message;
  }
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function parsePort(value) {
  const trimmed = cleanText(value);
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return { error: "Port must be an integer between 1 and 65535." };
  }
  return parsed;
}

function normalizeRunbook(body) {
  const name = cleanText(body.name);
  if (!name) {
    return { error: "Runbook name is required." };
  }

  const parsedPort = parsePort(body.port);
  if (typeof parsedPort === "object" && parsedPort?.error) {
    return { error: parsedPort.error };
  }

  return {
    value: {
      name,
      description: cleanText(body.description),
      tags: cleanText(body.tags),
      host: cleanText(body.host),
      port: parsedPort,
      urls: cleanText(body.urls),
      commands: cleanText(body.commands),
      notes: cleanText(body.notes)
    }
  };
}

function normalizeSecretRef(body) {
  const kinds = new Set(["pat", "ssh", "db", "kubeconfig", "other"]);

  const name = cleanText(body.name);
  if (!name) {
    return { error: "SecretRef name is required." };
  }

  const kind = cleanText(body.kind);
  if (!kinds.has(kind)) {
    return { error: "Invalid SecretRef kind." };
  }

  const referenceUri = cleanText(body.referenceUri);
  if (!referenceUri) {
    return { error: "Reference URI is required." };
  }

  const maskedPreview = cleanText(body.maskedPreview);
  if (!maskedPreview) {
    return { error: "Masked preview is required." };
  }

  return {
    value: {
      name,
      kind,
      referenceUri,
      maskedPreview,
      tags: cleanText(body.tags),
      scope: cleanText(body.scope)
    }
  };
}

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (req, res) => {
  if (!req.session?.isAuthenticated) {
    return res.redirect("/login");
  }
  return res.redirect("/runbooks");
});

app.get("/login", (req, res) => {
  if (req.session?.isAuthenticated) {
    return res.redirect("/runbooks");
  }
  return res.send(loginPage({ appName: config.appName, error: "" }));
});

app.post("/login", async (req, res) => {
  const password = String(req.body.password || "");
  const ok = await verifyPassword(app.locals.db, password);
  if (!ok) {
    return res.status(401).send(loginPage({ appName: config.appName, error: "Invalid password." }));
  }

  req.session.isAuthenticated = true;
  return res.redirect("/runbooks");
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.get("/runbooks", requireAuth, async (req, res) => {
  const items = await app.locals.db.all("SELECT * FROM runbooks ORDER BY updated_at DESC, id DESC");
  res.send(runbooksListPage({ appName: config.appName, items, flash: takeFlash(req) }));
});

app.get("/runbooks/new", requireAuth, (req, res) => {
  res.send(
    runbookFormPage({
      appName: config.appName,
      item: {},
      action: "/runbooks/new",
      submitLabel: "Create",
      flash: takeFlash(req)
    })
  );
});

app.post("/runbooks/new", requireAuth, async (req, res) => {
  const normalized = normalizeRunbook(req.body);
  if (normalized.error) {
    return res.status(400).send(
      runbookFormPage({
        appName: config.appName,
        item: req.body,
        action: "/runbooks/new",
        submitLabel: "Create",
        flash: normalized.error
      })
    );
  }

  const { value } = normalized;
  await app.locals.db.run(
    `
    INSERT INTO runbooks (name, description, tags, host, port, urls, commands, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [value.name, value.description, value.tags, value.host, value.port, value.urls, value.commands, value.notes]
  );

  setFlash(req, "Runbook created.");
  return res.redirect("/runbooks");
});

app.get("/runbooks/:id/edit", requireAuth, async (req, res) => {
  const item = await app.locals.db.get("SELECT * FROM runbooks WHERE id = ?", [req.params.id]);
  if (!item) {
    setFlash(req, "Runbook not found.");
    return res.redirect("/runbooks");
  }

  return res.send(
    runbookFormPage({
      appName: config.appName,
      item,
      action: `/runbooks/${item.id}/edit`,
      submitLabel: "Update",
      flash: takeFlash(req)
    })
  );
});

app.post("/runbooks/:id/edit", requireAuth, async (req, res) => {
  const normalized = normalizeRunbook(req.body);
  if (normalized.error) {
    return res.status(400).send(
      runbookFormPage({
        appName: config.appName,
        item: { ...req.body, id: req.params.id },
        action: `/runbooks/${req.params.id}/edit`,
        submitLabel: "Update",
        flash: normalized.error
      })
    );
  }

  const { value } = normalized;
  const result = await app.locals.db.run(
    `
    UPDATE runbooks
    SET name = ?, description = ?, tags = ?, host = ?, port = ?, urls = ?, commands = ?, notes = ?
    WHERE id = ?
    `,
    [
      value.name,
      value.description,
      value.tags,
      value.host,
      value.port,
      value.urls,
      value.commands,
      value.notes,
      req.params.id
    ]
  );

  if (!result.changes) {
    setFlash(req, "Runbook not found.");
  } else {
    setFlash(req, "Runbook updated.");
  }
  return res.redirect("/runbooks");
});

app.get("/secret-refs", requireAuth, async (req, res) => {
  const items = await app.locals.db.all("SELECT * FROM secret_refs ORDER BY updated_at DESC, id DESC");
  res.send(secretRefsListPage({ appName: config.appName, items, flash: takeFlash(req) }));
});

app.get("/secret-refs/new", requireAuth, (req, res) => {
  res.send(
    secretRefFormPage({
      appName: config.appName,
      item: {},
      action: "/secret-refs/new",
      submitLabel: "Create",
      flash: takeFlash(req)
    })
  );
});

app.post("/secret-refs/new", requireAuth, async (req, res) => {
  const normalized = normalizeSecretRef(req.body);
  if (normalized.error) {
    return res.status(400).send(
      secretRefFormPage({
        appName: config.appName,
        item: req.body,
        action: "/secret-refs/new",
        submitLabel: "Create",
        flash: normalized.error
      })
    );
  }

  const validation = await secretProvider.validateReference(normalized.value.referenceUri);
  if (!validation.ok) {
    return res.status(400).send(
      secretRefFormPage({
        appName: config.appName,
        item: req.body,
        action: "/secret-refs/new",
        submitLabel: "Create",
        flash: validation.reason
      })
    );
  }

  const { value } = normalized;
  await app.locals.db.run(
    `
    INSERT INTO secret_refs (name, kind, reference_uri, masked_preview, tags, scope)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [value.name, value.kind, value.referenceUri, value.maskedPreview, value.tags, value.scope]
  );

  setFlash(req, "SecretRef created.");
  return res.redirect("/secret-refs");
});

app.get("/secret-refs/:id/edit", requireAuth, async (req, res) => {
  const item = await app.locals.db.get("SELECT * FROM secret_refs WHERE id = ?", [req.params.id]);
  if (!item) {
    setFlash(req, "SecretRef not found.");
    return res.redirect("/secret-refs");
  }

  return res.send(
    secretRefFormPage({
      appName: config.appName,
      item,
      action: `/secret-refs/${item.id}/edit`,
      submitLabel: "Update",
      flash: takeFlash(req)
    })
  );
});

app.post("/secret-refs/:id/edit", requireAuth, async (req, res) => {
  const normalized = normalizeSecretRef(req.body);
  if (normalized.error) {
    return res.status(400).send(
      secretRefFormPage({
        appName: config.appName,
        item: { ...req.body, id: req.params.id },
        action: `/secret-refs/${req.params.id}/edit`,
        submitLabel: "Update",
        flash: normalized.error
      })
    );
  }

  const validation = await secretProvider.validateReference(normalized.value.referenceUri);
  if (!validation.ok) {
    return res.status(400).send(
      secretRefFormPage({
        appName: config.appName,
        item: { ...req.body, id: req.params.id },
        action: `/secret-refs/${req.params.id}/edit`,
        submitLabel: "Update",
        flash: validation.reason
      })
    );
  }

  const { value } = normalized;
  const result = await app.locals.db.run(
    `
    UPDATE secret_refs
    SET name = ?, kind = ?, reference_uri = ?, masked_preview = ?, tags = ?, scope = ?
    WHERE id = ?
    `,
    [value.name, value.kind, value.referenceUri, value.maskedPreview, value.tags, value.scope, req.params.id]
  );

  if (!result.changes) {
    setFlash(req, "SecretRef not found.");
  } else {
    setFlash(req, "SecretRef updated.");
  }
  return res.redirect("/secret-refs");
});

async function start() {
  const db = await initDb(config.dbPath);
  await ensurePasswordConfigured(db, config);
  app.locals.db = db;

  app.listen(config.port, () => {
    console.log(`ShipkeyX Portal listening on http://0.0.0.0:${config.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start portal:", error);
  process.exit(1);
});
