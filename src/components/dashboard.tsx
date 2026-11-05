"use client";

import { motion, useReducedMotion } from "motion/react";
import { FolderOpen } from "lucide-react";
import { ZoomProvider } from "@/components/zoom/zoom";
import { DocumentGrid } from "@/components/documents/document-grid";
import type { DocumentItem } from "@/components/documents/types";
import { SettingsMenu } from "./settings-menu";

export function Dashboard({
  userName,
  documents,
  error,
}: {
  userName: string;
  documents: DocumentItem[];
  error: string | null;
}) {
  const reduce = useReducedMotion();
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 10, filter: "blur(6px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { type: "spring" as const, visualDuration: 0.55, bounce: 0.1, delay },
        };

  return (
    <ZoomProvider>
      <div className="relative min-h-dvh">
        <div aria-hidden className="canvas-light pointer-events-none fixed inset-0" />
        <div aria-hidden className="canvas-grain pointer-events-none fixed inset-0" />
        <main className="relative mx-auto max-w-5xl px-4 pb-24 pt-5 sm:px-8 sm:pt-8">
          <div className="flex justify-end">
            <SettingsMenu userName={userName} />
          </div>

          <header className="mt-6 max-w-xl px-1 sm:mt-10">
            <motion.h1 {...rise(0)} className="text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[44px]">
              SCI Pialgo
            </motion.h1>
            <motion.p {...rise(0.06)} className="mt-3 text-[16px] leading-relaxed text-ink-soft sm:text-[17px]">
              Tous les documents relatifs à la SCI et autres informations sont centralisés dans cet espace
            </motion.p>
          </header>

          <section className="mt-10 sm:mt-14" aria-label="Documents">
            {error ? (
              <EmptyState title="Documents indisponibles" text={error} />
            ) : documents.length === 0 ? (
              <EmptyState title="Aucun document pour l'instant" text="Les documents ajoutés dans Notion apparaîtront ici." />
            ) : (
              <DocumentGrid documents={documents} />
            )}
          </section>
        </main>
      </div>
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
