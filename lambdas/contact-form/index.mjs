import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.AWS_REGION ?? "eu-west-3" });

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim());
const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL;
const SENDER_EMAIL    = process.env.SENDER_EMAIL;

export const handler = async (event) => {
  const origin  = event.headers?.origin ?? event.headers?.Origin ?? "";
  const headers = corsHeaders(origin);

  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  let body;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return respond(400, { error: "Invalid JSON" }, headers);
  }

  const { name, email, message } = body;
  const errors = validate({ name, email, message });
  if (errors.length > 0) {
    return respond(422, { errors }, headers);
  }

  try {
    await ses.send(new SendEmailCommand({
      Source: SENDER_EMAIL,
      Destination: { ToAddresses: [RECIPIENT_EMAIL] },
      ReplyToAddresses: [email],
      Message: {
        Subject: {
          Data: `[Portfolio] Message de ${sanitize(name)}`,
          Charset: "UTF-8",
        },
        Body: {
          Html: { Data: buildHtml(name, email, message), Charset: "UTF-8" },
          Text: { Data: buildText(name, email, message), Charset: "UTF-8" },
        },
      },
    }));

    console.log(`Contact form sent from ${email}`);
    return respond(200, { success: true }, headers);

  } catch (err) {
    console.error("SES error:", err.message);
    return respond(500, { error: "Failed to send message" }, headers);
  }
};

function validate({ name, email, message }) {
  const errors = [];
  if (!name    || name.trim().length < 2)    errors.push("name: minimum 2 caractères");
  if (!email   || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("email: format invalide");
  if (!message || message.trim().length < 10) errors.push("message: minimum 10 caractères");
  if (message  && message.length > 2000)      errors.push("message: maximum 2000 caractères");
  return errors;
}

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] ?? "";
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function respond(statusCode, body, headers) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function sanitize(str) {
  return String(str ?? "").replace(/[<>&"]/g, "");
}

function buildHtml(name, email, message) {
  const safeMsg = sanitize(message).replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;max-width:600px;margin:32px auto">
  <div style="background:#1e3a5f;padding:24px 32px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;color:white;font-size:18px">Nouveau message — Portfolio</h1>
  </div>
  <div style="padding:24px 32px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>
        <td style="padding:8px 0;color:#6b7280;width:100px;font-size:13px">Nom</td>
        <td style="padding:8px 0;font-weight:600">${sanitize(name)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;font-size:13px">Email</td>
        <td style="padding:8px 0"><a href="mailto:${sanitize(email)}" style="color:#3b82f6">${sanitize(email)}</a></td>
      </tr>
    </table>
    <div style="background:white;border-radius:6px;padding:16px;border:1px solid #e5e7eb;font-size:14px;line-height:1.6">
      ${safeMsg}
    </div>
    <p style="margin-top:20px;font-size:12px;color:#9ca3af">
      Répondre directement à cet email pour contacter ${sanitize(name)}.
    </p>
  </div>
</body>
</html>`;
}

function buildText(name, email, message) {
  return [
    `Nouveau message via le formulaire de contact du portfolio`,
    ``,
    `Nom    : ${name}`,
    `Email  : ${email}`,
    ``,
    `Message :`,
    message,
    ``,
    `---`,
    `Répondre directement à cet email pour contacter ${name}.`,
  ].join("\n");
}
