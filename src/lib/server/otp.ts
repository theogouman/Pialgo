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

/** Crée un défi OTP : code à 4 chiffres + jeton signé à poser en cookie. */
export async function issueChallenge(personId: PersonId): Promise<IssueResult> {
  const kv = store();
  const allowed = await kv.setNX(`otp-cooldown:${personId}`, "1", OTP_RESEND_COOLDOWN);
  if (!allowed) return { ok: false, reason: "cooldown" };

  const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
  const challengeId = randomBytes(16).toString("hex");
  await kv.set(`otp:${challengeId}`, JSON.stringify({ pid: personId, h: hashCode(challengeId, code) }), OTP_TTL);

  const token = await new SignJWT({ cid: challengeId, pid: personId, typ: "otp" })
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
  let cid: string;
  try {
    const { payload } = await jwtVerify(token, authSecret(), { algorithms: ["HS256"] });
    if (payload.typ !== "otp" || typeof payload.cid !== "string" || !isPersonId(payload.pid)) {
      return { ok: false, reason: "expired" };
    }
    cid = payload.cid;
  } catch {
    return { ok: false, reason: "expired" };
  }

  const kv = store();
  const raw = await kv.get(`otp:${cid}`);
  if (!raw) return { ok: false, reason: "expired" };
  const record = JSON.parse(raw) as { pid: PersonId; h: string };

  // Le compteur est incrémenté AVANT la comparaison : impossible de tester
  // plus de OTP_MAX_ATTEMPTS codes, même en parallèle.
  const attempts = await kv.incr(`otp-attempts:${cid}`, OTP_TTL);
  if (attempts > OTP_MAX_ATTEMPTS) {
    await kv.del(`otp:${cid}`);
    return { ok: false, reason: "locked" };
  }

  const expected = Buffer.from(record.h, "hex");
  const actual = Buffer.from(hashCode(cid, code), "hex");
  if (/^\d{4}$/.test(code) && timingSafeEqual(expected, actual)) {
    await kv.del(`otp:${cid}`);
    await kv.del(`otp-attempts:${cid}`);
    return { ok: true, personId: record.pid };
  }

  const remaining = OTP_MAX_ATTEMPTS - attempts;
  if (remaining <= 0) {
    await kv.del(`otp:${cid}`);
    return { ok: false, reason: "locked" };
  }
  return { ok: false, reason: "invalid", remaining };
}
