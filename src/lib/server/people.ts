import "server-only";
import type { PersonId } from "@/lib/people";

/**
 * Liste blanche : seules ces adresses peuvent recevoir un code et accéder à l'espace.
 * Pour Théo, le code est envoyé aux deux adresses.
 */
const EMAILS: Record<PersonId, string[]> = {
  theo: ["theo@gouman.fr", "gouman.t83@gmail.com"],
  corine: ["corinepierret@gmail.com"],
  melanie: ["melalati83@gmail.com"],
  laura: ["alatilaura91@gmail.com"],
};

export function emailsFor(id: PersonId): string[] {
  return EMAILS[id];
}

/** "theo@gouman.fr" -> "t•••@gouman.fr" */
export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}•••@${domain}`;
}
