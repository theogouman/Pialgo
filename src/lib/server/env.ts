// Pas de "server-only" : aussi utilisé par src/proxy.ts (via secret.ts).
/** Valeur provisoire posée dans Vercel pour les clés à compléter. */
export const PLACEHOLDER = "A_REMPLIR";

/** Lit une variable d'environnement ; vide ou provisoire = non définie. */
export function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && v !== PLACEHOLDER ? v : undefined;
}
