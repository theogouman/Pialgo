"use client";

import { ArrowUpRight, Download, X } from "lucide-react";
import { ZoomSecondary, ZoomTarget, useZoom } from "@/components/zoom/zoom";
import { addedOn, fileUrl, type DocumentItem } from "./types";

export function DocumentDetail({ doc }: { doc: DocumentItem }) {
  const { close } = useZoom();
  const main = doc.files[0];

  return (
    <div className="flex min-h-dvh flex-col px-3 pb-10 pt-3 sm:min-h-0 sm:px-4 sm:pb-8 sm:pt-4">
      <ZoomSecondary className="flex justify-end pb-3">
        <button
          type="button"
          onClick={close}
          className="grid size-9 place-items-center rounded-full bg-cloud text-ink-soft transition-colors hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mute/50"
          aria-label="Fermer"
        >
          <X className="size-[18px]" strokeWidth={2} />
        </button>
      </ZoomSecondary>

      <ZoomTarget className="aspect-[4/3] w-full rounded-[24px] sm:aspect-[16/10]">
        {main && (
          <a
            href={fileUrl(doc.id, main.index)}
            target="_blank"
            rel="noopener"
            data-zoom-drag
            draggable={false}
            className="absolute inset-0 rounded-[24px] outline-none focus-visible:ring-2 focus-visible:ring-mute/50 focus-visible:ring-offset-2"
            aria-label={`Ouvrir ${main.name}`}
          />
        )}
      </ZoomTarget>

      <ZoomSecondary className="px-2 pt-6">
        {doc.date && <p className="text-[13px] font-medium text-mute">Ajouté le {addedOn(doc.date)}</p>}
        <h2 id="doc-title" className="mt-1.5 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {doc.title}
        </h2>
        {doc.description && (
          <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{doc.description}</p>
        )}

        {main ? (
          <div className="mt-6 flex gap-2">
            <a
              href={fileUrl(doc.id, main.index)}
              target="_blank"
              rel="noopener"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[15px] font-medium text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mute/50 focus-visible:ring-offset-2"
            >
              Ouvrir le document
              <ArrowUpRight className="size-4" strokeWidth={2} />
            </a>
            <a
              href={fileUrl(doc.id, main.index, true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cloud px-5 text-[15px] font-medium text-ink transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mute/50"
              aria-label="Télécharger"
            >
              <Download className="size-4" strokeWidth={2} />
              <span className="hidden sm:inline">Télécharger</span>
            </a>
          </div>
        ) : (
          <p className="mt-6 text-[14px] text-mute">Aucun fichier joint dans Notion.</p>
        )}
      </ZoomSecondary>
    </div>
  );
}
