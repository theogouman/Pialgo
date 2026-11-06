"use client";

import { FolderOpen } from "lucide-react";
import { ZoomProvider } from "@/components/zoom/zoom";
import { DocumentGrid } from "@/components/documents/document-grid";
import type { DocumentItem } from "@/components/documents/types";
import { PageHeader } from "./page-header";

export function DocumentsView({ documents, error }: { documents: DocumentItem[]; error: string | null }) {
  return (
    <ZoomProvider>
      <PageHeader
        title="SCI Pialgo"
        subtitle="Tous les documents relatifs à la SCI et autres informations sont centralisés dans cet espace"
      />
      <section className="mt-10 sm:mt-14" aria-label="Documents">
        {error ? (
          <EmptyState title="Documents indisponibles" text={error} />
        ) : documents.length === 0 ? (
          <EmptyState title="Aucun document pour l'instant" text="Les documents ajoutés dans Notion apparaîtront ici." />
        ) : (
          <DocumentGrid documents={documents} />
        )}
      </section>
    </ZoomProvider>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center rounded-[28px] border border-dashed border-line bg-white/60 px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-cloud text-mute">
        <FolderOpen className="size-6" strokeWidth={1.6} />
      </span>
      <p className="mt-4 text-[16px] font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-[14px] text-mute">{text}</p>
    </div>
  );
}
