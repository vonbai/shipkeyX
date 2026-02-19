function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pageLayout({ title, body, appName, authenticated = false, active = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} - ${escapeHtml(appName)}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <header class="topbar">
    <h1>${escapeHtml(appName)}</h1>
    ${authenticated ? `<nav>
      <a href="/runbooks" ${active === "runbooks" ? 'class="active"' : ""}>Runbooks</a>
      <a href="/secret-refs" ${active === "secret-refs" ? 'class="active"' : ""}>SecretRefs</a>
      <form method="post" action="/logout"><button type="submit">Logout</button></form>
    </nav>` : ""}
  </header>
  <main>${body}</main>
</body>
</html>`;
}

function flashHtml(message) {
  if (!message) {
    return "";
  }
  return `<p class="flash">${escapeHtml(message)}</p>`;
}

export function loginPage({ appName, error = "" }) {
  const body = `
  <section class="panel narrow">
    <h2>Portal Login</h2>
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
    <form method="post" action="/login">
      <label>Password
        <input type="password" name="password" required />
      </label>
      <button type="submit">Login</button>
    </form>
  </section>`;

  return pageLayout({ title: "Login", body, appName });
}

export function runbooksListPage({ appName, items, flash }) {
  const rows = items
    .map(
      (item) => `<tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.host)}${item.port ? `:${item.port}` : ""}</td>
      <td>${escapeHtml(item.tags)}</td>
      <td><a href="/runbooks/${item.id}/edit">Edit</a></td>
    </tr>`
    )
    .join("");

  const body = `
    ${flashHtml(flash)}
    <section class="panel">
      <div class="panel-head">
        <h2>Runbooks / Connections</h2>
        <a class="button" href="/runbooks/new">New Runbook</a>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Host</th><th>Tags</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">No runbooks yet.</td></tr>'}</tbody>
      </table>
    </section>`;

  return pageLayout({
    title: "Runbooks",
    body,
    appName,
    authenticated: true,
    active: "runbooks"
  });
}

export function runbookFormPage({ appName, item = {}, action, submitLabel, flash }) {
  const body = `
    ${flashHtml(flash)}
    <section class="panel">
      <h2>${escapeHtml(submitLabel)} Runbook</h2>
      <form method="post" action="${escapeHtml(action)}" class="form-grid">
        <label>Name
          <input name="name" required value="${escapeHtml(item.name)}" />
        </label>
        <label>Description
          <textarea name="description">${escapeHtml(item.description)}</textarea>
        </label>
        <label>Tags (comma-separated)
          <input name="tags" value="${escapeHtml(item.tags)}" />
        </label>
        <label>Host
          <input name="host" value="${escapeHtml(item.host)}" />
        </label>
        <label>Port
          <input type="number" name="port" min="1" max="65535" value="${escapeHtml(item.port)}" />
        </label>
        <label>URLs (one per line)
          <textarea name="urls">${escapeHtml(item.urls)}</textarea>
        </label>
        <label>Commands (one per line)
          <textarea name="commands">${escapeHtml(item.commands)}</textarea>
        </label>
        <label>Notes
          <textarea name="notes">${escapeHtml(item.notes)}</textarea>
        </label>
        <button type="submit">${escapeHtml(submitLabel)}</button>
      </form>
    </section>`;

  return pageLayout({
    title: `${submitLabel} Runbook`,
    body,
    appName,
    authenticated: true,
    active: "runbooks"
  });
}

export function secretRefsListPage({ appName, items, flash }) {
  const rows = items
    .map(
      (item) => `<tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.kind)}</td>
      <td>${escapeHtml(item.reference_uri)}</td>
      <td>${escapeHtml(item.scope)}</td>
      <td><a href="/secret-refs/${item.id}/edit">Edit</a></td>
    </tr>`
    )
    .join("");

  const body = `
    ${flashHtml(flash)}
    <section class="panel">
      <div class="panel-head">
        <h2>SecretRefs</h2>
        <a class="button" href="/secret-refs/new">New SecretRef</a>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Kind</th><th>Reference URI</th><th>Scope</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">No secret references yet.</td></tr>'}</tbody>
      </table>
    </section>`;

  return pageLayout({
    title: "SecretRefs",
    body,
    appName,
    authenticated: true,
    active: "secret-refs"
  });
}

export function secretRefFormPage({ appName, item = {}, action, submitLabel, flash }) {
  const options = ["pat", "ssh", "db", "kubeconfig", "other"]
    .map((kind) => `<option value="${kind}" ${item.kind === kind ? "selected" : ""}>${kind}</option>`)
    .join("");

  const body = `
    ${flashHtml(flash)}
    <section class="panel">
      <h2>${escapeHtml(submitLabel)} SecretRef</h2>
      <form method="post" action="${escapeHtml(action)}" class="form-grid">
        <label>Name
          <input name="name" required value="${escapeHtml(item.name)}" />
        </label>
        <label>Kind
          <select name="kind">${options}</select>
        </label>
        <label>Reference URI
          <input name="referenceUri" required value="${escapeHtml(item.reference_uri)}" placeholder="op://vault/item/field" />
        </label>
        <label>Masked Preview
          <input name="maskedPreview" required value="${escapeHtml(item.masked_preview)}" placeholder="••••abcd" />
        </label>
        <label>Tags (comma-separated)
          <input name="tags" value="${escapeHtml(item.tags)}" />
        </label>
        <label>Scope (project/env)
          <input name="scope" value="${escapeHtml(item.scope)}" placeholder="payments/prod" />
        </label>
        <button type="submit">${escapeHtml(submitLabel)}</button>
      </form>
    </section>`;

  return pageLayout({
    title: `${submitLabel} SecretRef`,
    body,
    appName,
    authenticated: true,
    active: "secret-refs"
  });
}
