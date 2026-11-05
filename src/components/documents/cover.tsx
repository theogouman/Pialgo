"use client";

import { useThumb } from "./thumbnails";
import type { DocumentItem } from "./types";

const PALETTES = [
  ["#E9E4FF", "#FFE4EC", "#7C6CF2"],
  ["#DDF1FF", "#E8E4FF", "#3B82C4"],
  ["#FFEFD9", "#FFE1E1", "#D9774B"],
  ["#DFF6EA", "#E2F0FF", "#2F9E6E"],
  ["#F3E8FF", "#E0F2FE", "#8B5CF6"],
  ["#FFF4D6", "#E9F7EF", "#B7871B"],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Couverture vectorielle (ratio 1, rendue en « cover » quel que soit le cadre). */
function Artwork({ doc }: { doc: DocumentItem }) {
  const [a, b, c] = PALETTES[hash(doc.id) % PALETTES.length];
  const ext = (doc.files[0]?.ext || "doc").toUpperCase().slice(0, 4);
  const gid = `g-${doc.id}`;
  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" className="block size-full" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill={`url(#${gid})`} />
      <circle cx="330" cy="70" r="120" fill="#fff" opacity="0.35" />
      <g transform="translate(140 110)">
        <rect width="120" height="156" rx="14" fill="#fff" opacity="0.95" />
        <path d="M86 0h20a14 14 0 0 1 14 14v20z" fill={c} opacity="0.18" />
        <rect x="20" y="34" width="60" height="8" rx="4" fill={c} opacity="0.55" />
        <rect x="20" y="56" width="80" height="6" rx="3" fill="#0f0f17" opacity="0.12" />
        <rect x="20" y="72" width="72" height="6" rx="3" fill="#0f0f17" opacity="0.12" />
        <rect x="20" y="88" width="78" height="6" rx="3" fill="#0f0f17" opacity="0.12" />
        <rect x="20" y="118" width="44" height="20" rx="10" fill={c} />
        <text x="42" y="132" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="ui-sans-serif, system-ui">
          {ext}
        </text>
      </g>
    </svg>
  );
}

/**
 * Contenu visuel d'un document. Remplit son conteneur en « cover » ;
 * même rendu dans la grille et dans l'objet qui zoome.
 */
export function Cover({ doc }: { doc: DocumentItem }) {
  const thumb = useThumb(doc.id);
  if (thumb.status === "ready") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumb.src}
        alt=""
        draggable={false}
        className="block size-full object-cover select-none"
        style={{ objectPosition: `${thumb.align[0] * 100}% ${thumb.align[1] * 100}%` }}
      />
    );
  }
  return <Artwork doc={doc} />;
}
