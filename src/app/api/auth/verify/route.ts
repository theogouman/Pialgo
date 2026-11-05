import { NextResponse, type NextRequest } from "next/server";
import { verifyChallenge } from "@/lib/server/otp";
import { CHALLENGE_COOKIE, SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : "";
  const result = await verifyChallenge(req.cookies.get(CHALLENGE_COOKIE)?.value, code);

  if (!result.ok) {
    const messages = {
      expired: "Ce code a expiré. Demandez-en un nouveau.",
      locked: "Trop de tentatives. Demandez un nouveau code.",
      invalid: `Code incorrect.${result.remaining ? ` ${result.remaining} essai${result.remaining > 1 ? "s" : ""} restant${result.remaining > 1 ? "s" : ""}.` : ""}`,
    } as const;
    return NextResponse.json({ error: messages[result.reason], reason: result.reason }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(result.personId), sessionCookieOptions);
  res.cookies.set(CHALLENGE_COOKIE, "", { path: "/api/auth", maxAge: 0 });
  return res;
}
