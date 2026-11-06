"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ZoomPresentation, ZoomSource, useZoom } from "@/components/zoom/zoom";
import { CardVeil } from "./card-veil";
import { Cover } from "./cover";
import { DocumentDetail } from "./document-detail";
import { getThumb, prefetchDocument, requestThumb } from "./thumbnails";
import type { DocumentItem } from "./types";

function DocumentCard({ doc, index }: { doc: DocumentItem; index: number }) {
  const { open } = useZoom();
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          requestThumb(doc);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [doc]);

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ type: "spring", visualDuration: 0.5, bounce: 0.1, delay: Math.min(index, 12) * 0.04 }}
    >
      <motion.button
        ref={ref}
        type="button"
        data-zoom-trigger={doc.id}
        onPointerDown={() => prefetchDocument(doc)}
        onClick={() => {
          prefetchDocument(doc);
          open(doc.id);
        }}
        whileTap={reduce ? undefined : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="group block w-full cursor-pointer rounded-[22px] p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-mute/50"
        aria-label={`Ouvrir ${doc.title}`}
      >
        <ZoomSource id={doc.id} className="relative aspect-[4/5] w-full rounded-[18px] bg-cloud">
          <Cover doc={doc} />
          <CardVeil title={doc.title} />
        </ZoomSource>
      </motion.button>
    </motion.li>
  );
}

const detailPageColor = () => (window.matchMedia("(min-width: 640px)").matches ? null : "#ffffff");

export function DocumentGrid({ documents }: { documents: DocumentItem[] }) {
  const byId = new Map(documents.map((d) => [d.id, d]));
  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {documents.map((doc, i) => (
          <DocumentCard key={doc.id} doc={doc} index={i} />
        ))}
      </ul>

      <ZoomPresentation
        labelledBy="doc-title"
        getMeta={(id) => {
          const doc = byId.get(id);
          if (!doc) return { aspect: 1 };
          const t = getThumb(doc);
          return { aspect: t.aspect, align: t.align };
        }}
        renderObject={(id) => {
          const doc = byId.get(id);
          return doc ? <Cover doc={doc} /> : null;
        }}
        renderOverlay={(id) => {
          const doc = byId.get(id);
          return doc ? <CardVeil title={doc.title} /> : null;
        }}
        // Sur mobile la vue détail est plein écran et blanche : Safari prend la même teinte.
        pageColor={detailPageColor}
        contentClassName="flex min-h-full items-stretch justify-center sm:items-start sm:px-6 sm:py-14"
        panelClassName="w-full sm:max-w-[680px]"
        surfaceClassName="bg-white sm:rounded-[32px] sm:shadow-[0_1px_2px_rgba(20,20,20,0.06),0_30px_80px_-20px_rgba(20,20,20,0.3)]"
      >
        {(id) => {
          const doc = byId.get(id);
          return doc ? <DocumentDetail doc={doc} /> : null;
        }}
      </ZoomPresentation>
    </>
  );
}
