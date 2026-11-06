import "server-only";
import { env } from "./env";

/**
 * Lecture de la base Notion « Documents » (SCI Pialgo).
 * Schéma : Nom (title), Descriptions (rich_text), Fichiers (files), Date d'ajout (date).
 * L'intégration Notion (NOTION_TOKEN) doit être connectée à la base.
 */
const NOTION_VERSION = "2025-09-03";
const API = "https://api.notion.com/v1";

export const DATA_SOURCE_ID =
  env("NOTION_DATA_SOURCE_ID") ?? "40fbad05-6a95-804f-ab16-000b56571976";

export type DocFile = {
  index: number;
  name: string;
  kind: "pdf" | "image" | "other";
  ext: string;
};

export type DocumentItem = {
  id: string;
  title: string;
  description: string;
  date: string | null; // ISO
  /** Date de dernière modification Notion : version du document (clé de cache). */
  version: string;
  files: DocFile[];
};

type RichText = { plain_text: string };
type NotionFile = {
  name: string;
  type: "file" | "external" | "file_upload";
  file?: { url: string; expiry_time: string };
  external?: { url: string };
};
type NotionPage = {
  id: string;
  object: "page";
  created_time: string;
  last_edited_time: string;
  in_trash?: boolean;
  archived?: boolean;
  parent: { type: string; data_source_id?: string; database_id?: string };
  properties: Record<string, unknown>;
};

function headers() {
  const token = env("NOTION_TOKEN");
  if (!token) throw new Error("NOTION_TOKEN manquant.");
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

export function isNotionConfigured() {
  return Boolean(env("NOTION_TOKEN"));
}

const normId = (id: string) => id.replace(/-/g, "").toLowerCase();

function fileKind(name: string): { kind: DocFile["kind"]; ext: string } {
  const clean = name.split("?")[0];
  const ext = (clean.includes(".") ? clean.split(".").pop()! : "").toLowerCase();
  if (ext === "pdf") return { kind: "pdf", ext };
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "heic"].includes(ext)) return { kind: "image", ext };
  return { kind: "other", ext };
}

function prop<T>(page: NotionPage, name: string): T | undefined {
  return page.properties[name] as T | undefined;
}

function filesOf(page: NotionPage): NotionFile[] {
  return prop<{ files: NotionFile[] }>(page, "Fichiers")?.files ?? [];
}

function toItem(page: NotionPage): DocumentItem {
  const title = prop<{ title: RichText[] }>(page, "Nom")?.title.map((t) => t.plain_text).join("") ?? "";
  const description =
    prop<{ rich_text: RichText[] }>(page, "Descriptions")?.rich_text.map((t) => t.plain_text).join("") ?? "";
  const date = prop<{ date: { start: string } | null }>(page, "Date d'ajout")?.date?.start ?? page.created_time;
  return {
    id: page.id,
    title: title || "Sans titre",
    description,
    date,
    version: page.last_edited_time,
    files: filesOf(page).map((f, index) => ({ index, name: f.name, ...fileKind(f.name) })),
  };
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const res = await fetch(`${API}/data_sources/${DATA_SOURCE_ID}/query`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        page_size: 100,
        start_cursor: cursor,
        sorts: [
          { property: "Date d'ajout", direction: "descending" },
          { timestamp: "created_time", direction: "descending" },
        ],
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { results: NotionPage[]; has_more: boolean; next_cursor: string | null };
    pages.push(...json.results.filter((r) => r.object === "page"));
    cursor = json.has_more ? (json.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages.filter((p) => !p.in_trash && !p.archived).map(toItem);
}

/** URL (temporaire) d'un fichier, en vérifiant que la page appartient bien à la base. */
export async function getFileSource(pageId: string, index: number) {
  if (!/^[0-9a-f-]{32,36}$/i.test(pageId)) return null;
  const res = await fetch(`${API}/pages/${pageId}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) return null;
  const page = (await res.json()) as NotionPage;
  const parent = page.parent.data_source_id ?? page.parent.database_id;
  const allowed = [normId(DATA_SOURCE_ID), normId(env("NOTION_DATABASE_ID") ?? "40fbad056a9580b7b187d850f8624029")];
  if (!parent || !allowed.includes(normId(parent)) || page.in_trash || page.archived) return null;
  const file = filesOf(page)[index];
  if (!file) return null;
  const url = file.type === "external" ? file.external?.url : file.file?.url;
  if (!url) return null;
  return { url, name: file.name, ...fileKind(file.name) };
}
