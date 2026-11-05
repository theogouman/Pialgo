// Pas de "server-only" ici : ce module est aussi importé par src/proxy.ts.
export const SESSION_COOKIE = "pialgo_session";
export const CHALLENGE_COOKIE = "pialgo_otp";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

let cached: Uint8Array | null = null;

export function authSecret(): Uint8Array {
  if (cached) return cached;
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum).");
    }
    console.warn("[auth] AUTH_SECRET absent : secret de développement utilisé.");
    cached = new TextEncoder().encode("dev-only-secret-do-not-use-in-production-0123456789");
    return cached;
  }
  cached = new TextEncoder().encode(raw);
  return cached;
}
