"use client";

import { useEffect } from "react";
import { ChevronLeft, Download } from "lucide-react";
import { ZoomPresentation, ZoomSecondary, ZoomTarget, useZoom } from "@/components/zoom/zoom";
import { Cover } from "./cover";
import { getThumb, requestPdfPages, useThumb, usePdfPages } from "./thumbnails";
import { fileUrl, type DocumentItem } from "./types";

/** Visionneuse plein écran (niveau 2 du zoom), dans le même onglet. */
export function DocumentViewer({ doc }: { doc: DocumentItem }) {
  return (
    <ZoomPresentation
      labelledBy="viewer-title"
      getMeta={() => {
        const t = getThumb(doc);
        return { aspect: t.aspect, align: t.align };
      }}
      renderObject={() => <Cover doc={doc} />}
      backdropClassName="bg-[#0f0f0f]"
      pageColor="#0f0f0f"
      pinchToClose={false}
      contentClassName="min-h-full"
      panelClassName="w-full"
    >
      {() => <ViewerBody doc={doc} />}
    </ZoomPresentation>
  );
}

function ViewerBody({ doc }: { doc: DocumentItem }) {
  const { close } = useZoom();
  const thumb = useThumb(doc);
  const main = doc.files[0];
  const isPdf = main?.kind === "pdf";
  const pages = usePdfPages(doc.id);

  useEffect(() => {
    if (isPdf) requestPdfPages(doc);
  }, [doc, isPdf]);

  const aspect = thumb.aspect;
  // Image : entière à l'écran. PDF : pleine largeur (lecture en défilant). Autre : vignette.
  const width =
    thumb.status === "art"
      ? "min(100%, 420px)"
      : isPdf
        ? "min(100%, 880px)"
        : `min(100%, 1100px, calc((100dvh - 96px) * ${aspect}))`;
  const pending = Math.max(0, pages.total - 1 - pages.pages.length);

  return (
    <div className="flex min-h-dvh flex-col items-center px-3 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] sm:px-6">
      <ZoomSecondary className="sticky top-0 z-20 flex w-full max-w-[880px] items-center justify-between gap-3 py-3">
        <button
          type="button"
          onClick={close}
          className="inline-flex h-10 items-center gap-1 rounded-full border border-white/10 bg-[#161616]/85 pl-2.5 pr-4 text-[15px] font-medium text-white shadow-[0_4px_16px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-colors hover:bg-[#161616] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <ChevronLeft className="size-5" strokeWidth={2} />
          Retour
        </button>
        <div className="flex min-w-0 flex-1 justify-center">
          <p
            id="viewer-title"
            className="max-w-full truncate rounded-full border border-white/10 bg-[#161616]/85 px-3.5 py-1.5 text-[13px] font-medium text-white/85 shadow-[0_4px_16px_rgba(0,0,0,0.28)] backdrop-blur-xl"
          >
            {doc.title}
          </p>
        </div>
        {main ? (
          <a
            href={fileUrl(doc.id, main.index, true)}
            download
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-[#161616]/85 px-4 text-[15px] font-medium text-white shadow-[0_4px_16px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-colors hover:bg-[#161616] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label="Télécharger"
          >
            <Download className="size-[18px]" strokeWidth={2} />
            <span className="hidden sm:inline">Télécharger</span>
          </a>
        ) : (
          <span className="w-10" />
        )}
      </ZoomSecondary>

      <ZoomTarget className="rounded-[10px]" style={{ width, aspectRatio: String(aspect) }} />

      {thumb.status === "art" && (
        <ZoomSecondary className="mt-6 text-center text-[14px] text-white/70">
          Aperçu indisponible pour ce format. Téléchargez le fichier pour l&apos;ouvrir.
        </ZoomSecondary>
      )}

      {isPdf && (pages.pages.length > 0 || pending > 0) && (
        <ZoomSecondary className="flex w-full flex-col items-center gap-3 pt-3">
          {pages.pages.map((pg, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={pg.src}
              alt={`Page ${i + 2}`}
              draggable={false}
              className="block rounded-[10px] bg-white"
              style={{ width, aspectRatio: String(pg.aspect) }}
            />
          ))}
          {Array.from({ length: pending }, (_, i) => (
            <div key={`p${i}`} className="t-skel overflow-hidden rounded-[10px]" style={{ width, aspectRatio: String(aspect) }}>
              <div className="t-skel-skeleton is-pulsing bg-white/8">
                <div className="size-full bg-white/5" />
              </div>
            </div>
          ))}
        </ZoomSecondary>
      )}
    </div>
  );
}
