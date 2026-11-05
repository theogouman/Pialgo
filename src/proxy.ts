import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE, authSecret } from "@/lib/server/secret";

async function isAuthenticated(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, authSecret(), { algorithms: ["HS256"] });
    return payload.typ === "session";
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = await isAuthenticated(req);

  if (pathname === "/login") {
    return authed ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  if (!authed) {
    if (pathname.startsWith("/api/")) return new NextResponse("Non autorisé", { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Tout sauf les assets, l'auth OTP et les fichiers statiques.
  matcher: ["/((?!_next/static|_next/image|api/auth|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp|mjs)$).*)"],
};
