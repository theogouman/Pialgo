"use client";

import { useState } from "react";
import { useThumb } from "./thumbnails";
import type { DocumentItem } from "./types";

/** Couverture sobre pour les fichiers sans aperçu (ratio 1, rendue en « cover »). */
function Artwork({ doc }: { doc: DocumentItem }) {
  const ext = (doc.files[0]?.ext || "doc").toUpperCase().slice(0, 4);
  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" className="block size-full" aria-hidden>
      <rect width="400" height="400" fill="#ECEBE7" />
      <g transform="translate(140 112)">
        <rect width="120" height="156" rx="12" fill="#FFFFFF" />
        <path d="M90 0h18a12 12 0 0 1 12 12v18z" fill="#E4E2DD" />
        <rect x="20" y="34" width="56" height="7" rx="3.5" fill="#161616" opacity="0.7" />
        <rect x="20" y="56" width="80" height="5" rx="2.5" fill="#161616" opacity="0.1" />
        <rect x="20" y="70" width="70" height="5" rx="2.5" fill="#161616" opacity="0.1" />
        <rect x="20" y="84" width="76" height="5" rx="2.5" fill="#161616" opacity="0.1" />
        <text x="20" y="136" fontSize="12" fontWeight="600" letterSpacing="1" fill="#8A877F" fontFamily="ui-sans-serif, system-ui">
          {ext}
        </text>
      </g>
    </svg>
  );
}

/** Squelette d'une page de document (barres qui pulsent). */
function PageSkeleton() {
  return (
    <div className="t-skel-skeleton is-pulsing flex flex-col gap-[6%] bg-[#ECEBE7] px-[12%] pt-[14%]">
      <div className="h-[5%] w-[62%] rounded-full bg-[#DEDCD6]" />
      <div className="h-[3%] w-[40%] rounded-full bg-[#E3E1DC]" />
      <div className="mt-[4%] h-[3%] w-full rounded-full bg-[#E3E1DC]" />
      <div className="h-[3%] w-[88%] rounded-full bg-[#E3E1DC]" />
      <div className="h-[3%] w-[94%] rounded-full bg-[#E3E1DC]" />
      <div className="h-[3%] w-[70%] rounded-full bg-[#E3E1DC]" />
    </div>
  );
}

/**
 * Contenu visuel d'un document : squelette pendant le chargement, puis révélation
 * (fondu + flou croisés, transition « Skeleton loader and reveal » de transitions.dev).
 * Même rendu dans la grille et dans l'objet qui zoome.
 */
export function Cover({ doc }: { doc: DocumentItem }) {
  const thumb = useThumb(doc);
  // Déjà prêt au montage (cache) : affiché directement, sans rejouer la révélation.
  const [mountedReady] = useState(thumb.status !== "loading");

  if (thumb.status === "art") return <Artwork doc={doc} />;

  const ready = thumb.status === "ready";
  return (
    <div className={`t-skel size-full ${ready ? "is-revealed" : ""} ${mountedReady ? "is-resetting" : ""}`}>
      <PageSkeleton />
      <div className="t-skel-content">
        {ready && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb.src}
            alt=""
            draggable={false}
            className="block size-full object-cover select-none"
            style={{ objectPosition: `${thumb.align[0] * 100}% ${thumb.align[1] * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}
