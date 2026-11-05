// Miroir client des types serveur (src/lib/server/notion.ts)
export type DocFile = { index: number; name: string; kind: "pdf" | "image" | "other"; ext: string };
export type DocumentItem = {
  id: string;
  title: string;
  description: string;
  date: string | null;
  files: DocFile[];
};

export const fileUrl = (docId: string, index: number, download = false) =>
  `/api/files/${docId}/${index}${download ? "?download=1" : ""}`;

export function formatDate(iso: string | null, long = false) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("fr-FR", long ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" });
}

/** "05 octobre 2026" (format JJ MMMM AAAA). */
export function addedOn(iso: string) {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Paris" });
}
