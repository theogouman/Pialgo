"use client";

import { useSyncExternalStore } from "react";
import { zoomBusy } from "@/components/zoom/engine";
import { cacheKey, fetchFile, readEntry, writeEntry } from "./file-cache";
import type { DocumentItem } from "./types";

/**
 * Miniatures et pages rendues, partagées entre la grille, l'objet qui zoome et la
 * visionneuse (une seule source d'image par document : jamais deux versions à l'écran).
 *  - image : le fichier lui-même
 *  - PDF   : 1re page rendue avec pdf.js, mise en cache (JPEG) avec le nombre de pages
 *  - autre : couverture vectorielle (ratio 1)
 */
export type Thumb =
  | { status: "loading"; aspect: number; align: [number, number] }
  | { status: "art"; aspect: 1; align: [number, number] }
  | { status: "ready"; src: string; aspect: number; align: [number, number]; pages: number };

const ART: Thumb = { status: "art", aspect: 1, align: [0.5, 0.5] };
// Pendant le chargement, ratio de la case de la grille (4:5) : le squelette remplit le cadre.
const LOADING: Thumb = { status: "loading", aspect: 0.8, align: [0.5, 0] };
const THUMB_WIDTH = 1100;

const previewFile = (doc: DocumentItem) =>
  doc.files.find((f) => f.kind === "image") ?? doc.files.find((f) => f.kind === "pdf");

// ---------- Petit store réactif ----------

const thumbs = new Map<string, Thumb>();
const pages = new Map<string, PageImage>(); // clé `${docId}:${n}`
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getThumb(doc: DocumentItem): Thumb {
  return thumbs.get(doc.id) ?? (previewFile(doc) ? LOADING : ART);
}

export function useThumb(doc: DocumentItem) {
  const initial = previewFile(doc) ? LOADING : ART;
  return useSyncExternalStore(subscribe, () => getThumb(doc), () => initial);
}

export type PageImage = { src: string; aspect: number };
export function usePdfPage(docId: string, n: number) {
  return useSyncExternalStore(subscribe, () => pages.get(`${docId}:${n}`) ?? null, () => null);
}

// ---------- Ordonnancement ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Les rendus pdf.js occupent le fil principal : jamais pendant un mouvement visible. */
async function waitForStillness() {
  while (zoomBusy()) await sleep(60);
}

/** File à 2 travaux simultanés ; le dernier document demandé passe devant. */
let running = 0;
const queue: { id: string; job: () => Promise<void> }[] = [];
function enqueue(id: string, job: () => Promise<void>, urgent = false) {
  if (urgent) queue.unshift({ id, job });
  else queue.push({ id, job });
  pump();
}
function pump() {
  while (running < 2 && queue.length) {
    const { job } = queue.shift()!;
    running++;
    void job().finally(() => {
      running--;
      pump();
    });
  }
}
function prioritize(id: string) {
  const i = queue.findIndex((q) => q.id === id);
  if (i > 0) queue.unshift(...queue.splice(i, 1));
}

// ---------- Rendu ----------

function decoded(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => img.decode().then(() => resolve(img), () => resolve(img));
    img.onerror = reject;
    img.src = src;
  });
}

let pdfjsLib: Promise<typeof import("pdfjs-dist")> | null = null;
function pdfjs() {
  pdfjsLib ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return m;
  });
  return pdfjsLib;
}

type PdfDoc = import("pdfjs-dist").PDFDocumentProxy;
const openDocs = new Map<string, Promise<PdfDoc>>();

/** Document pdf.js ouvert une fois par onglet (analyse dans le worker). */
function openPdf(doc: DocumentItem): Promise<PdfDoc> {
  let p = openDocs.get(doc.id);
  if (!p) {
    const file = doc.files.find((f) => f.kind === "pdf")!;
    p = (async () => {
      const [lib, blob] = await Promise.all([pdfjs(), fetchFile(doc, file.index)]);
      return lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    })();
    p.catch(() => openDocs.delete(doc.id));
    openDocs.set(doc.id, p);
  }
  return p;
}

async function renderPage(pdf: PdfDoc, n: number, width: number) {
  const page = await pdf.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });
  await waitForStillness();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
  canvas.width = canvas.height = 0; // libère la mémoire tout de suite (iOS)
  if (!blob) throw new Error("toBlob");
  return { blob, aspect: viewport.width / viewport.height };
}

async function show(blob: Blob) {
  const src = URL.createObjectURL(blob);
  const img = await decoded(src); // décodé avant affichage : pas de flash
  return { src, aspect: img.naturalWidth / img.naturalHeight };
}

// ---------- API ----------

const started = new Set<string>();

export function requestThumb(doc: DocumentItem, urgent = false) {
  if (started.has(doc.id)) {
    if (urgent) prioritize(doc.id);
    return;
  }
  const file = previewFile(doc);
  if (!file) return;
  started.add(doc.id);
  enqueue(
    doc.id,
    async () => {
      try {
        if (file.kind === "image") {
          const { src, aspect } = await show(await fetchFile(doc, file.index));
          thumbs.set(doc.id, { status: "ready", src, aspect, align: [0.5, 0.5], pages: 1 });
        } else {
          // Visite suivante : la 1re page est déjà rendue dans le cache, pas de pdf.js.
          const key = cacheKey.thumb(doc);
          let entry = await readEntry(key);
          if (!entry) {
            const pdf = await openPdf(doc);
            const { blob } = await renderPage(pdf, 1, THUMB_WIDTH);
            entry = { blob, meta: { pages: String(pdf.numPages) } };
            void writeEntry(key, blob, entry.meta);
          }
          const { src, aspect } = await show(entry.blob);
          thumbs.set(doc.id, { status: "ready", src, aspect, align: [0.5, 0], pages: Number(entry.meta.pages) || 1 });
        }
      } catch (err) {
        console.warn("[miniature] échec", doc.title, err);
        thumbs.set(doc.id, ART);
      }
      emit();
    },
    urgent,
  );
}

/** Largeur de rendu des pages de la visionneuse (nette sur l'écran, sans excès). */
export function pageRenderWidth() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  return Math.min(1500, Math.max(900, Math.round(Math.min(window.innerWidth, 880) * dpr)));
}

const pageStarted = new Set<string>();

/** Rend la page n (≥ 2) à la demande, quand elle approche de l'écran. */
export function requestPage(doc: DocumentItem, n: number) {
  const id = `${doc.id}:${n}`;
  if (pageStarted.has(id)) return;
  pageStarted.add(id);
  const width = pageRenderWidth();
  enqueue(
    id,
    async () => {
      try {
        const key = cacheKey.page(doc, n, width);
        let blob = (await readEntry(key))?.blob;
        if (!blob) {
          blob = (await renderPage(await openPdf(doc), n, width)).blob;
          void writeEntry(key, blob);
        }
        pages.set(id, await show(blob));
        emit();
      } catch (err) {
        console.warn("[visionneuse] page", n, err);
        pageStarted.delete(id);
      }
    },
    true,
  );
}

/**
 * Au clic depuis la grille : miniature en tête de file et fichier téléchargé tout de
 * suite (réseau uniquement — aucun rendu lourd qui bloquerait les interactions).
 */
export function prefetchDocument(doc: DocumentItem) {
  requestThumb(doc, true);
  const pdf = doc.files.find((f) => f.kind === "pdf");
  if (pdf) void fetchFile(doc, pdf.index).catch(() => {});
}

/** Contenu d'un fichier pour le téléchargement (cache local d'abord). */
export function fileBlob(doc: DocumentItem, index: number) {
  return fetchFile(doc, index);
}
