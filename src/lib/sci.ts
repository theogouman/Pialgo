/**
 * Identité légale de la SCI — source : extrait Kbis (RCS Toulon, 05/11/2026) et
 * synthèse définitive INPI du Guichet unique (formalité J00296704927).
 * `copy` est la valeur placée dans le presse-papiers (sans espaces de mise en forme).
 */
export type IdentityField = {
  id: string;
  label: string;
  value: string;
  copy: string;
  hint?: string;
};

export const SCI_IDENTITY: IdentityField[] = [
  { id: "nom", label: "Nom", value: "PIALGO", copy: "PIALGO", hint: "Société civile immobilière" },
  { id: "siren", label: "SIREN", value: "132 282 179", copy: "132282179" },
  { id: "immatriculation", label: "Date d'immatriculation", value: "05/11/2026", copy: "05/11/2026", hint: "RCS Toulon" },
  { id: "liasse", label: "Numéro de liasse", value: "J00296704927", copy: "J00296704927" },
  { id: "euid", label: "Numéro d’identification européen (EUID)", value: "FR8305.132282179", copy: "FR8305.132282179" },
  {
    id: "naf",
    label: "Code NAF / APE",
    value: "6820B",
    copy: "6820B",
    hint: "Location de terrains et d’autres biens immobiliers",
  },
  {
    id: "cloture",
    label: "Date de clôture de l'exercice social",
    value: "31/12",
    copy: "31/12",
    hint: "Première clôture : 31/12/2027",
  },
];

/** Bloc texte de toutes les informations (bouton « Tout copier »). */
export function identityAsText() {
  return ["SCI PIALGO", ...SCI_IDENTITY.filter((f) => f.id !== "nom").map((f) => `${f.label} : ${f.copy}`)].join("\n");
}
