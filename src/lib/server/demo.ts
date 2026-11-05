import "server-only";
import type { DocumentItem } from "./notion";

/**
 * Documents fictifs pour le développement local (DEMO_DOCUMENTS=1, jamais en production).
 * Les fichiers sont lus dans public/demo/ (non versionné).
 */
export const demoEnabled = () => process.env.NODE_ENV !== "production" && process.env.DEMO_DOCUMENTS === "1";

const f = (name: string, index = 0) => {
  const ext = name.split(".").pop()!.toLowerCase();
  return { index, name, ext, kind: ext === "pdf" ? ("pdf" as const) : ["png", "jpg"].includes(ext) ? ("image" as const) : ("other" as const) };
};

export const DEMO_DOCS: DocumentItem[] = [
  { id: "00000000-0000-0000-0000-000000000001", title: "Statuts de la SCI", description: "Statuts signés lors de la constitution.\nVersion à jour après la dernière AG.", date: "2026-10-12", files: [f("statuts.pdf")] },
  { id: "00000000-0000-0000-0000-000000000002", title: "Photo de la façade", description: "Vue de la rue, octobre.", date: "2026-10-02", files: [f("facade.png")] },
  { id: "00000000-0000-0000-0000-000000000003", title: "PV d'assemblée générale 2026", description: "Approbation des comptes et affectation du résultat.", date: "2026-06-30", files: [f("pv-ag-2026.docx")] },
  { id: "00000000-0000-0000-0000-000000000004", title: "Acte de propriété", description: "", date: "2025-03-18", files: [f("acte.pdf"), f("annexes.xlsx", 1)] },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `00000000-0000-0000-0000-0000000001${String(i).padStart(2, "0")}`,
    title: `Avis d'imposition ${2025 - i}`,
    description: "Taxe foncière.",
    date: `${2025 - i}-09-15`,
    files: [f(`taxe-${2025 - i}.txt`)],
  })),
];

export function demoFile(pageId: string, index: number) {
  const doc = DEMO_DOCS.find((d) => d.id === pageId);
  const file = doc?.files[index];
  if (!file) return null;
  const real = file.kind === "pdf" ? "statuts.pdf" : file.kind === "image" ? "facade.png" : null;
  return real ? { path: `/demo/${real}`, ...file } : null;
}
