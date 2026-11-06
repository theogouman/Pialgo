"use client";

import { fileUrl, type DocumentItem } from "./types";

/**
 * Cache local des documents (Cache Storage du navigateur, persistant entre les visites).
 * Clés versionnées par la date de modification Notion : un document modifié est
 * rechargé, les anciennes versions sont purgées. Vidé à la déconnexion.
 *   file  : fichier d'origine (PDF, image…)
 *   thumb : 1re page rendue (JPEG) + ratio + nombre de pages
 *   page  : pages suivantes rendues pour la visionneuse
 */
const CACHE_NAME = "pialgo-documents-v1";

let opened: Promise<Cache | null> | null = null;
function store(): Promise<Cache | null> {
  opened ??= typeof caches === "undefined" ? Promise.resolve(null) : caches.open(CACHE_NAME).catch(() => null);
  return opened;
}

const v = (doc: DocumentItem) => encodeURIComponent(doc.version);
export const cacheKey = {
  file: (doc: DocumentItem, index: number) => `/__cache/file/${doc.id}/${index}?v=${v(doc)}`,
  thumb: (doc: DocumentItem) => `/__cache/thumb/${doc.id}?v=${v(doc)}`,
  page: (doc: DocumentItem, n: number, width: number) => `/__cache/page/${doc.id}/${n}/${width}?v=${v(doc)}`,
};

export type Entry = { blob: Blob; meta: Record<string, string> };

export async function readEntry(key: string): Promise<Entry | null> {
  const res = await (await store())?.match(key).catch(() => undefined);
  if (!res) return null;
  const meta: Record<string, string> = {};
  res.headers.forEach((value, name) => {
    if (name.startsWith("x-meta-")) meta[name.slice(7)] = value;
  });
  return { blob: await res.blob(), meta };
}

export async function writeEntry(key: string, blob: Blob, meta: Record<string, string | number> = {}) {
  const headers = new Headers({ "Content-Type": blob.type || "application/octet-stream" });
  for (const [k, val] of Object.entries(meta)) headers.set(`x-meta-${k}`, String(val));
  await (await store())?.put(key, new Response(blob, { headers })).catch(() => {});
}

// Mémoire de l'onglet : une seule requête par fichier, même en parallèle.
const inFlight = new Map<string, Promise<Blob>>();

/** Fichier d'un document : mémoire → cache local → réseau (puis mis en cache). */
export function fetchFile(doc: DocumentItem, index: number): Promise<Blob> {
  const key = cacheKey.file(doc, index);
  let p = inFlight.get(key);
  if (!p) {
    p = (async () => {
      const hit = await readEntry(key);
      if (hit) return hit.blob;
      const res = await fetch(fileUrl(doc.id, index));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      void writeEntry(key, blob);
      return blob;
    })();
    p.catch(() => inFlight.delete(key));
    inFlight.set(key, p);
  }
  return p;
}

/** Supprime les entrées de documents disparus ou modifiés. */
export async function pruneCache(docs: DocumentItem[]) {
  const cache = await store();
  if (!cache) return;
  const current = new Map(docs.map((d) => [d.id, d.version]));
  for (const req of await cache.keys()) {
    const url = new URL(req.url);
    const id = url.pathname.split("/")[3];
    if (current.get(id) !== url.searchParams.get("v")) await cache.delete(req);
  }
}

/** Vide tout (déconnexion : rien ne reste sur l'appareil). */
export async function clearCache() {
  inFlight.clear();
  opened = null;
  if (typeof caches !== "undefined") await caches.delete(CACHE_NAME).catch(() => {});
}
