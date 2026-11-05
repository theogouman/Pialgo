"use client";

import { ArrowUpRight, Download, FileText, Image as ImageIcon, File, X } from "lucide-react";
import { ZoomSecondary, ZoomTarget, useZoom } from "@/components/zoom/zoom";
import { fileUrl, formatDate, type DocumentItem, type DocFile } from "./types";

const icons = { pdf: FileText, image: ImageIcon, other: File } as const;

function FileRow({ doc, file }: { doc: DocumentItem; file: DocFile }) {
  const Icon = icons[file.kind];
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-cloud px-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-ink-soft shadow-[0_1px_2px_rgba(15,15,30,0.08)]">
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{file.name}</span>
      <a
        href={fileUrl(doc.id, file.index)}
        target="_blank"
        rel="noopener"
        className="grid size-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#868593]/50"
        aria-label={`Ouvrir ${file.name}`}
      >
        <ArrowUpRight className="size-[18px]" strokeWidth={1.75} />
      </a>
      <a
        href={fileUrl(doc.id, file.index, true)}
        className="grid size-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#868593]/50"
        aria-label={`Télécharger ${file.name}`}
      >
        <Download className="size-[18px]" strokeWidth={1.75} />
      </a>
    </li>
  );
}

export function DocumentDetail({ doc }: { doc: DocumentItem }) {
  const { close } = useZoom();
  const main = doc.files[0];

  return (
    <div className="flex min-h-dvh flex-col px-3 pb-10 pt-3 sm:min-h-0 sm:px-4 sm:pb-8 sm:pt-4">
      <ZoomSecondary className="flex items-center justify-between px-2 pb-3">
        <span className="text-[13px] font-medium text-mute">{formatDate(doc.date, true)}</span>
        <button
          type="button"
          onClick={close}
          className="grid size-9 place-items-center rounded-full bg-cloud text-ink-soft transition-colors hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#868593]/50"
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
            className="absolute inset-0 rounded-[24px] outline-none focus-visible:ring-2 focus-visible:ring-[#868593]/50 focus-visible:ring-offset-2"
            aria-label={`Ouvrir ${main.name}`}
          />
        )}
      </ZoomTarget>

      <ZoomSecondary className="px-2 pt-6">
        <h2 id="doc-title" className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {doc.title}
        </h2>
        {doc.description && (
          <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{doc.description}</p>
        )}

        {main && (
          <div className="mt-6 flex gap-2">
            <a
              href={fileUrl(doc.id, main.index)}
              target="_blank"
              rel="noopener"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[15px] font-medium text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#868593]/50 focus-visible:ring-offset-2"
            >
              Ouvrir le document
              <ArrowUpRight className="size-4" strokeWidth={2} />
            </a>
            <a
              href={fileUrl(doc.id, main.index, true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cloud px-5 text-[15px] font-medium text-ink transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#868593]/50"
            >
              <Download className="size-4" strokeWidth={2} />
              <span className="hidden sm:inline">Télécharger</span>
            </a>
          </div>
        )}

        {doc.files.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-2 px-1 text-[13px] font-medium uppercase tracking-[0.06em] text-mute">
              {doc.files.length > 1 ? `${doc.files.length} fichiers` : "Fichier"}
            </h3>
            <ul className="space-y-2">
              {doc.files.map((f) => (
                <FileRow key={f.index} doc={doc} file={f} />
              ))}
            </ul>
          </div>
        )}
        {doc.files.length === 0 && <p className="mt-6 text-[14px] text-mute">Aucun fichier joint dans Notion.</p>}
      </ZoomSecondary>
    </div>
  );
}
