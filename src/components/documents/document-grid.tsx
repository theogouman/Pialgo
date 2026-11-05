"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ZoomPresentation, ZoomSource, useZoom } from "@/components/zoom/zoom";
import { Cover } from "./cover";
import { DocumentDetail } from "./document-detail";
import { getThumb, requestThumb } from "./thumbnails";
import { formatDate, type DocumentItem } from "./types";

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
        onClick={() => open(doc.id)}
        whileTap={reduce ? undefined : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="group block w-full cursor-pointer rounded-[22px] p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#868593]/50"
        aria-label={`Ouvrir ${doc.title}`}
      >
        <ZoomSource id={doc.id} className="aspect-[4/5] w-full rounded-[18px] bg-cloud">
          <Cover doc={doc} />
        </ZoomSource>
        <div className="px-1 pb-1 pt-3">
          <p className="line-clamp-2 text-[15px] font-medium leading-snug text-ink">{doc.title}</p>
          <p className="mt-1 text-[13px] text-mute">
            {formatDate(doc.date)}
            {doc.files.length > 1 ? ` · ${doc.files.length} fichiers` : ""}
          </p>
        </div>
      </motion.button>
    </motion.li>
  );
}

export function DocumentGrid({ documents }: { documents: DocumentItem[] }) {
  const byId = new Map(documents.map((d) => [d.id, d]));
  return (
    <>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3 sm:gap-x-3 lg:grid-cols-4">
        {documents.map((doc, i) => (
          <DocumentCard key={doc.id} doc={doc} index={i} />
        ))}
      </ul>

      <ZoomPresentation
        labelledBy="doc-title"
        getMeta={(id) => {
          const t = getThumb(id);
          return { aspect: t.aspect, align: t.align };
        }}
        renderObject={(id) => {
          const doc = byId.get(id);
          return doc ? <Cover doc={doc} /> : null;
        }}
        contentClassName="flex min-h-full items-stretch justify-center sm:items-start sm:px-6 sm:py-14"
        panelClassName="w-full sm:max-w-[680px]"
        surfaceClassName="bg-white sm:rounded-[32px] sm:shadow-[0_1px_2px_rgba(15,15,30,0.06),0_30px_80px_-20px_rgba(15,15,30,0.35)]"
      >
        {(id) => {
          const doc = byId.get(id);
          return doc ? <DocumentDetail doc={doc} /> : null;
        }}
      </ZoomPresentation>
    </>
  );
}
