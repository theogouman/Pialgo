// Données publiques (envoyées au navigateur) : identifiant + prénom uniquement.
// Les adresses e-mail restent côté serveur (voir server/people.ts).
export const PEOPLE = [
  { id: "theo", name: "Théo" },
  { id: "corine", name: "Corine" },
  { id: "melanie", name: "Mélanie" },
  { id: "laura", name: "Laura" },
] as const;

export type PersonId = (typeof PEOPLE)[number]["id"];

export function isPersonId(value: unknown): value is PersonId {
  return PEOPLE.some((p) => p.id === value);
}

export function personName(id: PersonId) {
  return PEOPLE.find((p) => p.id === id)!.name;
}
