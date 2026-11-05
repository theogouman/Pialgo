import { NextResponse, type NextRequest } from "next/server";
import { isPersonId, personName } from "@/lib/people";
import { emailsFor, maskEmail } from "@/lib/server/people";
import { cancelChallenge, issueChallenge, OTP_TTL } from "@/lib/server/otp";
import { sendOtpEmail } from "@/lib/server/mailer";
import { CHALLENGE_COOKIE } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { person?: unknown } | null;
  if (!body || !isPersonId(body.person)) {
    return NextResponse.json({ error: "Personne inconnue." }, { status: 400 });
  }
  const personId = body.person;
  const emails = emailsFor(personId);

  const issued = await issueChallenge(personId);
  if (!issued.ok) {
    return NextResponse.json(
      { error: "Un code vient d'être envoyé. Patientez quelques secondes avant d'en redemander un." },
      { status: 429 },
    );
  }

  try {
    await sendOtpEmail(emails, personName(personId), issued.code);
  } catch (err) {
    console.error("[otp] envoi impossible", err);
    await cancelChallenge(personId);
    return NextResponse.json({ error: "L'e-mail n'a pas pu être envoyé. Réessayez." }, { status: 502 });
  }

  const res = NextResponse.json({ sentTo: emails.map(maskEmail) });
  res.cookies.set(CHALLENGE_COOKIE, issued.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
    maxAge: OTP_TTL,
  });
  return res;
}
