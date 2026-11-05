import "server-only";
import nodemailer from "nodemailer";
import { env } from "./env";

/**
 * Envoi via le compte Gmail theo@gouman.fr.
 * Deux modes (au choix, variables d'environnement) :
 *  - OAuth2 (application Google Cloud « Gmail API ») :
 *      GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
 *  - Mot de passe d'application Google :
 *      GMAIL_USER, GMAIL_APP_PASSWORD
 * En développement sans configuration, le code est affiché dans la console.
 */
function transport() {
  const user = env("GMAIL_USER") ?? "theo@gouman.fr";
  const GMAIL_CLIENT_ID = env("GMAIL_CLIENT_ID");
  const GMAIL_CLIENT_SECRET = env("GMAIL_CLIENT_SECRET");
  const GMAIL_REFRESH_TOKEN = env("GMAIL_REFRESH_TOKEN");
  // Google affiche le mot de passe d'application par groupes de 4 : on retire les espaces.
  const GMAIL_APP_PASSWORD = env("GMAIL_APP_PASSWORD")?.replace(/\s+/g, "");

  if (GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN) {
    return {
      user,
      t: nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user,
          clientId: GMAIL_CLIENT_ID,
          clientSecret: GMAIL_CLIENT_SECRET,
          refreshToken: GMAIL_REFRESH_TOKEN,
        },
      }),
    };
  }
  if (GMAIL_APP_PASSWORD) {
    return {
      user,
      t: nodemailer.createTransport({ service: "gmail", auth: { user, pass: GMAIL_APP_PASSWORD } }),
    };
  }
  return null;
}

export async function sendOtpEmail(to: string[], name: string, code: string) {
  const tr = transport();
  if (!tr) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Gmail n'est pas configuré (GMAIL_* manquants).");
    }
    console.info(`[otp] (dev, aucun Gmail configuré) code pour ${to.join(", ")} : ${code}`);
    return;
  }

  const digits = code
    .split("")
    .map(
      (d) =>
        `<td style="width:52px;height:60px;background:#EFEEEA;border-radius:14px;text-align:center;font:600 28px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111">${d}</td>`,
    )
    .join('<td style="width:8px"></td>');

  await tr.t.sendMail({
    from: { name: "SCI Pialgo", address: tr.user },
    to,
    subject: `${code} est votre code de vérification`,
    text: `Bonjour ${name},\n\nVotre code de connexion à l'espace SCI Pialgo : ${code}\n\nIl expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    html: `<!doctype html><html><body style="margin:0;background:#F6F5F2;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111">
<table role="presentation" align="center" style="max-width:440px;width:100%;background:#fff;border-radius:24px;padding:32px;box-shadow:0 1px 2px rgba(20,20,20,.06),0 8px 24px -6px rgba(20,20,20,.12)">
<tr><td>
<p style="margin:0 0 4px;font-size:13px;color:#8A877F;letter-spacing:.02em">SCI PIALGO</p>
<h1 style="margin:0 0 16px;font-size:22px;font-weight:600">Bonjour ${name},</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#3a3a44">Voici votre code de connexion :</p>
<table role="presentation" style="border-collapse:separate;margin:0 0 24px"><tr>${digits}</tr></table>
<p style="margin:0;font-size:13px;line-height:1.5;color:#8A877F">Il expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
</td></tr></table></body></html>`,
  });
}
