import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.AWS_REGION ?? "eu-west-3" });

export const handler = async () => {
  const apiBase    = process.env.API_BASE_URL;
  const sender     = process.env.SENDER_EMAIL;
  const recipient  = process.env.RECIPIENT_EMAIL;

  const projects = await fetchProjects(apiBase);
  const active   = projects.filter((p) => p.status === "ACTIVE");
  const featured = projects.filter((p) => p.featured);
  const archived = projects.filter((p) => p.status !== "ACTIVE");

  await ses.send(new SendEmailCommand({
    Source: sender,
    Destination: { ToAddresses: [recipient] },
    Message: {
      Subject: {
        Data: `Rapport Portfolio — ${formatDate(new Date())}`,
        Charset: "UTF-8",
      },
      Body: {
        Html: { Data: buildHtml(active, featured, archived), Charset: "UTF-8" },
        Text: { Data: buildText(active, featured, archived), Charset: "UTF-8" },
      },
    },
  }));

  console.log(`Rapport envoyé à ${recipient} — ${active.length} projets actifs`);
  return { statusCode: 200 };
};

async function fetchProjects(apiBase) {
  const url = `${apiBase}/api/v1/projects?page=0&size=100`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const body = await res.json();
  return body.content ?? [];
}

function formatDate(date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function buildHtml(active, featured, archived) {
  const featuredRows = featured
    .map((p) => `
      <tr>
        <td style="padding:10px 0; border-bottom:1px solid #f3f4f6">
          <strong style="color:#1f2937">${escHtml(p.title)}</strong>
          ${p.summary ? `<br><span style="color:#6b7280;font-size:13px">${escHtml(p.summary)}</span>` : ""}
        </td>
      </tr>`)
    .join("");

  const activeRows = active
    .filter((p) => !p.featured)
    .map((p) => `<li style="margin:4px 0;color:#374151">${escHtml(p.title)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">

    <div style="background:#1e3a5f;padding:28px 32px">
      <h1 style="margin:0;color:white;font-size:20px;font-weight:700">
        Rapport Portfolio
      </h1>
      <p style="margin:6px 0 0;color:#93c5fd;font-size:14px">${formatDate(new Date())}</p>
    </div>

    <div style="padding:28px 32px">

      <h2 style="margin:0 0 16px;color:#1f2937;font-size:16px;font-weight:600">Vue d'ensemble</h2>
      <div style="display:flex;gap:12px;margin-bottom:28px">
        ${stat(active.length, "Projets actifs", "#3b82f6")}
        ${stat(featured.length, "En vedette", "#f59e0b")}
        ${stat(archived.length, "Archivés", "#6b7280")}
      </div>

      ${featured.length > 0 ? `
      <h2 style="margin:0 0 12px;color:#1f2937;font-size:16px;font-weight:600">⭐ Projets en vedette</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        ${featuredRows}
      </table>` : ""}

      ${active.filter((p) => !p.featured).length > 0 ? `
      <h2 style="margin:0 0 12px;color:#1f2937;font-size:16px;font-weight:600">Autres projets actifs</h2>
      <ul style="margin:0 0 24px;padding-left:20px">${activeRows}</ul>` : ""}

      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0">
      <p style="margin:0;font-size:12px;color:#9ca3af">
        Généré automatiquement par <strong>AWS Lambda</strong> + <strong>EventBridge Scheduler</strong>
        · Tous les lundis à 8h00 UTC
      </p>
    </div>
  </div>
</body>
</html>`;
}

function stat(value, label, color) {
  return `<div style="flex:1;background:#f9fafb;border-radius:8px;padding:16px;text-align:center;border:1px solid #f3f4f6">
    <div style="font-size:28px;font-weight:700;color:${color}">${value}</div>
    <div style="font-size:12px;color:#6b7280;margin-top:4px">${label}</div>
  </div>`;
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildText(active, featured, archived) {
  const lines = [
    `Rapport Portfolio — ${formatDate(new Date())}`,
    ``,
    `Vue d'ensemble`,
    `  Projets actifs : ${active.length}`,
    `  En vedette     : ${featured.length}`,
    `  Archivés       : ${archived.length}`,
  ];

  if (featured.length > 0) {
    lines.push(``, `Projets en vedette :`);
    featured.forEach((p) => lines.push(`  • ${p.title}`));
  }

  const others = active.filter((p) => !p.featured);
  if (others.length > 0) {
    lines.push(``, `Autres projets actifs :`);
    others.forEach((p) => lines.push(`  • ${p.title}`));
  }

  lines.push(``, `---`, `Généré par AWS Lambda + EventBridge Scheduler (tous les lundis 8h00 UTC)`);
  return lines.join("\n");
}
