"use client";

import { useSyncExternalStore } from "react";
import { fileUrl, type DocumentItem } from "./types";

/**
 * Miniatures partagées entre la grille et l'objet qui zoome : une seule source
 * d'image par document, donc jamais deux versions différentes à l'écran.
 *  - image : le fichier lui-même
 *  - PDF   : première page rendue avec pdf.js (chargé à la demande)
 *  - autre : couverture vectorielle (ratio 1)
 */
export type Thumb =
  | { status: "loading"; aspect: number; align: [number, number] }
  | { status: "art"; aspect: 1; align: [number, number] }
  | { status: "ready"; src: string; aspect: number; align: [number, number] };

const ART: Thumb = { status: "art", aspect: 1, align: [0.5, 0.5] };
// Pendant le chargement, ratio de la case de la grille (4:5) : le squelette remplit le cadre.
const LOADING: Thumb = { status: "loading", aspect: 0.8, align: [0.5, 0] };

const previewable = (doc: DocumentItem) => doc.files.some((f) => f.kind === "image" || f.kind === "pdf");
const cache = new Map<string, Thumb>();
const started = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getThumb(doc: DocumentItem): Thumb {
  return cache.get(doc.id) ?? (previewable(doc) ? LOADING : ART);
}

export function useThumb(doc: DocumentItem) {
  const initial = previewable(doc) ? LOADING : ART;
  return useSyncExternalStore(subscribe, () => getThumb(doc), () => initial);
}

// File d'attente : 2 rendus PDF simultanés maximum.
let running = 0;
const queue: (() => Promise<void>)[] = [];
function enqueue(job: () => Promise<void>) {
  queue.push(job);
  pump();
}
function pump() {
  while (running < 2 && queue.length) {
    const job = queue.shift()!;
    running++;
    job().finally(() => {
      running--;
      pump();
    });
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
function pdfjs() {
  pdfjsPromise ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return m;
  });
  return pdfjsPromise;
}

async function renderPdf(url: string): Promise<{ src: string; aspect: number }> {
  const lib = await pdfjs();
  const task = lib.getDocument({ url });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 1100 / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    if (!blob) throw new Error("toBlob");
    const src = URL.createObjectURL(blob);
    await loadImage(src); // décodé avant affichage : pas de flash
    return { src, aspect: canvas.width / canvas.height };
  } finally {
    void task.destroy();
  }
}

export function requestThumb(doc: DocumentItem) {
  if (started.has(doc.id)) return;
  started.add(doc.id);
  const file = doc.files.find((f) => f.kind === "image") ?? doc.files.find((f) => f.kind === "pdf");
  if (!file) return;
  const url = fileUrl(doc.id, file.index);
  enqueue(async () => {
    try {
      if (file.kind === "image") {
        const img = await loadImage(url);
        await img.decode?.().catch(() => {});
        cache.set(doc.id, { status: "ready", src: url, aspect: img.naturalWidth / img.naturalHeight, align: [0.5, 0.5] });
      } else {
        const { src, aspect } = await renderPdf(url);
        cache.set(doc.id, { status: "ready", src, aspect, align: [0.5, 0] });
      }
      emit();
    } catch (err) {
      console.warn("[miniature] échec", doc.title, err);
      cache.set(doc.id, ART);
      emit();
    }
  });
}
