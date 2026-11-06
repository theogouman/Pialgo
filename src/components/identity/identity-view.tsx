"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Copy, CopyCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { copyText } from "@/lib/clipboard";
import { SCI_IDENTITY, identityAsText, type IdentityField } from "@/lib/sci";
import { cn } from "@/lib/utils";

const ICON_SWAP = {
  initial: { opacity: 0, scale: 0.6, filter: "blur(4px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.6, filter: "blur(4px)" },
  transition: { type: "spring", visualDuration: 0.25, bounce: 0.2 },
} as const;

export function IdentityView() {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy(id: string, text: string, label: string) {
    const ok = await copyText(text);
    setCopied(ok ? id : null);
    setToast({ key: Date.now(), text: ok ? `${label} copié` : "Copie impossible" });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopied(null);
      setToast(null);
    }, 1800);
  }

  const allCopied = copied === "__all";

  return (
    <>
      <PageHeader
        title="Identité"
        subtitle="Les informations légales de la SCI. Touchez une ligne pour la copier."
        actions={
          <button
            type="button"
            onClick={() => copy("__all", identityAsText(), "Tout")}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-[14px] font-medium text-ink shadow-[0_1px_2px_rgba(20,20,20,0.05)] transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mute/50"
          >
            <span className="relative grid size-4 place-items-center">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span key={allCopied ? "ok" : "copy"} {...(reduce ? {} : ICON_SWAP)} className="grid place-items-center">
                  {allCopied ? <CopyCheck className="size-4" strokeWidth={2} /> : <Copy className="size-4" strokeWidth={2} />}
                </motion.span>
              </AnimatePresence>
            </span>
            Tout copier
          </button>
        }
      />

      <section aria-label="Informations de la SCI" className="mt-10 sm:mt-14">
        <ul className="overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_1px_2px_rgba(20,20,20,0.05),0_12px_32px_-18px_rgba(20,20,20,0.18)]">
          {SCI_IDENTITY.map((field, i) => (
            <Row key={field.id} field={field} index={i} copied={copied === field.id} onCopy={copy} reduce={!!reduce} />
          ))}
        </ul>
        <p className="mt-4 px-2 text-[12px] text-mute">Sources : extrait Kbis du 05/11/2026 et synthèse INPI (formalité J00296704927).</p>
      </section>

      {/* Confirmation */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-40 grid place-items-center">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.key}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98, filter: "blur(4px)" }}
              transition={{ type: "spring", visualDuration: 0.3, bounce: 0.15 }}
              // Même cellule de grille : le toast sortant et l'entrant se superposent.
              className="col-start-1 row-start-1 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 py-2.5 text-[14px] font-medium text-white shadow-[0_10px_30px_-10px_rgba(20,20,20,0.5)]"
            >
              <Check className="size-4" strokeWidth={2.4} />
              {toast.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function Row({
  field,
  index,
  copied,
  onCopy,
  reduce,
}: {
  field: IdentityField;
  index: number;
  copied: boolean;
  onCopy: (id: string, text: string, label: string) => void;
  reduce: boolean;
}) {
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 8, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ type: "spring", visualDuration: 0.45, bounce: 0.1, delay: 0.08 + index * 0.035 }}
      className="border-b border-line last:border-b-0"
    >
      <button
        type="button"
        onClick={() => onCopy(field.id, field.copy, field.label)}
        aria-label={`Copier ${field.label} : ${field.copy}`}
        className={cn(
          "group flex w-full items-center gap-4 px-5 py-4 text-left outline-none transition-colors duration-200 focus-visible:bg-cloud sm:px-6",
          copied ? "bg-cloud" : "hover:bg-canvas active:bg-cloud",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-mute">{field.label}</span>
          <span className="mt-0.5 block break-all text-[17px] font-medium tabular-nums tracking-[-0.01em] text-ink">
            {field.value}
          </span>
          {field.hint && <span className="mt-0.5 block text-[13px] text-ink-soft">{field.hint}</span>}
        </span>
        <span
          className={cn(
            "relative grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-200",
            copied ? "bg-ink text-white" : "bg-cloud text-ink-soft group-hover:bg-line",
          )}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span key={copied ? "ok" : "copy"} {...(reduce ? {} : ICON_SWAP)} className="grid place-items-center">
              {copied ? <Check className="size-[17px]" strokeWidth={2.4} /> : <Copy className="size-[16px]" strokeWidth={2} />}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>
    </motion.li>
  );
}
