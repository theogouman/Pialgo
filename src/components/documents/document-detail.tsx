"use client";

import { useEffect } from "react";
import { Maximize2, X } from "lucide-react";
import { ZoomProvider, ZoomSecondary, ZoomTarget, useZoom, type ZoomContextValue } from "@/components/zoom/zoom";
import { DocumentViewer } from "./document-viewer";
import { DownloadButton } from "./download-button";
import { addedOn, type DocumentItem } from "./types";

/**
 * Vue détail (niveau 1). Elle porte son propre niveau de zoom (niveau 2) : l'aperçu
 * déjà agrandi repart avec la même transition pour devenir la visionneuse plein écran.
 */
export function DocumentDetail({ doc }: { doc: DocumentItem }) {
  const detail = useZoom();
  return (
    <ZoomProvider>
      <DetailBody doc={doc} detail={detail} />
    </ZoomProvider>
  );
}

function DetailBody({ doc, detail }: { doc: DocumentItem; detail: ZoomContextValue }) {
  const viewer = useZoom();
  const main = doc.files[0];

  // La source du niveau 2 est l'objet du niveau 1 (l'aperçu posé dans la vue détail).
  // Effet passif : la ref de cet objet (rendu après la vue détail) est alors attachée.
  useEffect(() => {
    viewer.engine.register(doc.id, detail.engine.els.object ?? null);
    return () => viewer.engine.register(doc.id, null);
  }, [viewer.engine, detail.engine, doc.id]);

  return (
    <div className="flex min-h-dvh flex-col px-3 pb-10 pt-3 sm:min-h-0 sm:px-4 sm:pb-8 sm:pt-4">
      <ZoomSecondary zoom={detail} className="flex justify-end pb-3">
        <button
          type="button"
          onClick={detail.close}
          className="grid size-9 place-items-center rounded-full bg-cloud text-ink-soft transition-colors hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mute/50"
          aria-label="Fermer"
        >
          <X className="size-[18px]" strokeWidth={2} />
        </button>
      </ZoomSecondary>

      <ZoomTarget zoom={detail} className="aspect-[4/3] w-full rounded-[24px] sm:aspect-[16/10]">
        <button
          type="button"
          onClick={() => viewer.open(doc.id)}
          data-zoom-drag
          className="absolute inset-0 cursor-zoom-in rounded-[24px] outline-none focus-visible:ring-2 focus-visible:ring-mute/50 focus-visible:ring-offset-2"
          aria-label={`Afficher ${doc.title} en grand`}
        />
      </ZoomTarget>

      <ZoomSecondary zoom={detail} className="px-2 pt-6">
        {doc.date && <p className="text-[13px] font-medium text-mute">Ajouté le {addedOn(doc.date)}</p>}
        <h2 id="doc-title" className="mt-1.5 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {doc.title}
        </h2>
        {doc.description && (
          <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{doc.description}</p>
        )}

        {main ? (
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={() => viewer.open(doc.id)}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[15px] font-medium text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mute/50 focus-visible:ring-offset-2"
            >
              <Maximize2 className="size-4" strokeWidth={2} />
              Ouvrir le document
            </button>
            <DownloadButton
              doc={doc}
              index={main.index}
              label={<span className="hidden sm:inline">Télécharger</span>}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cloud px-5 text-[15px] font-medium text-ink transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mute/50"
            />
          </div>
        ) : (
          <p className="mt-6 text-[14px] text-mute">Aucun fichier joint dans Notion.</p>
        )}
      </ZoomSecondary>

      <DocumentViewer doc={doc} />
    </div>
  );
}
