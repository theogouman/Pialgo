import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { isPersonId, type PersonId } from "@/lib/people";
import { authSecret } from "./secret";
import { store } from "./store";

export const OTP_LENGTH = 4;
export const OTP_TTL = 10 * 60; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN = 30; // secondes

function hashCode(challengeId: string, code: string) {
  return createHmac("sha256", authSecret()).update(`${challengeId}:${code}`).digest("hex");
}

export type IssueResult =
  | { ok: true; code: string; token: string }
  | { ok: false; reason: "cooldown" };

/**
 * Crée un défi OTP : code à 4 chiffres + jeton signé à poser en cookie httpOnly.
 * Le jeton porte l'empreinte HMAC du code (irréversible sans AUTH_SECRET) : la
 * vérification ne dépend donc pas de la mémoire du serveur. Sur Vercel, l'envoi et la
 * vérification peuvent tourner sur deux instances différentes.
 */
export async function issueChallenge(personId: PersonId): Promise<IssueResult> {
  const kv = store();
  const allowed = await kv.setNX(`otp-cooldown:${personId}`, "1", OTP_RESEND_COOLDOWN);
  if (!allowed) return { ok: false, reason: "cooldown" };

  const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
  const challengeId = randomBytes(16).toString("hex");
  const token = await new SignJWT({ cid: challengeId, pid: personId, h: hashCode(challengeId, code), typ: "otp" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${OTP_TTL}s`)
    .sign(authSecret());

  return { ok: true, code, token };
}

export async function cancelChallenge(personId: PersonId) {
  await store().del(`otp-cooldown:${personId}`);
}

export type VerifyResult =
  | { ok: true; personId: PersonId }
  | { ok: false; reason: "expired" | "invalid" | "locked"; remaining?: number };

export async function verifyChallenge(token: string | undefined, code: string): Promise<VerifyResult> {
  if (!token) return { ok: false, reason: "expired" };
  let cid: string, pid: PersonId, h: string;
  try {
    const { payload } = await jwtVerify(token, authSecret(), { algorithms: ["HS256"] });
    if (payload.typ !== "otp" || typeof payload.cid !== "string" || typeof payload.h !== "string" || !isPersonId(payload.pid)) {
      return { ok: false, reason: "expired" };
    }
    ({ cid, pid, h } = payload as { cid: string; pid: PersonId; h: string });
  } catch {
    return { ok: false, reason: "expired" }; // expiré (10 min) ou falsifié
  }

  const kv = store();
  // Usage unique : un code déjà accepté ne peut pas resservir.
  if (await kv.get(`otp-used:${cid}`)) return { ok: false, reason: "expired" };

  // Compteur incrémenté AVANT la comparaison : pas plus de OTP_MAX_ATTEMPTS essais,
  // même en parallèle (garanti avec Redis ; au mieux par instance sans Redis).
  const attempts = await kv.incr(`otp-attempts:${cid}`, OTP_TTL);
  if (attempts > OTP_MAX_ATTEMPTS) return { ok: false, reason: "locked" };

  const expected = Buffer.from(h, "hex");
  const actual = Buffer.from(hashCode(cid, code), "hex");
  if (/^\d{4}$/.test(code) && expected.length === actual.length && timingSafeEqual(expected, actual)) {
    await kv.set(`otp-used:${cid}`, "1", OTP_TTL);
    return { ok: true, personId: pid };
  }

  const remaining = OTP_MAX_ATTEMPTS - attempts;
  return remaining <= 0 ? { ok: false, reason: "locked" } : { ok: false, reason: "invalid", remaining };
}
