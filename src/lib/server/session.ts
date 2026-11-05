import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { isPersonId, type PersonId } from "@/lib/people";
import { SESSION_COOKIE, CHALLENGE_COOKIE, SESSION_MAX_AGE, authSecret } from "./secret";

export { SESSION_COOKIE, CHALLENGE_COOKIE };

export type Session = { personId: PersonId };

export async function createSessionToken(personId: PersonId) {
  return new SignJWT({ pid: personId, typ: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(authSecret());
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret(), { algorithms: ["HS256"] });
    if (payload.typ !== "session" || !isPersonId(payload.pid)) return null;
    return { personId: payload.pid };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
