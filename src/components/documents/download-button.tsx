"use client";

import { useState, type ReactNode } from "react";
import { Check, Download, Loader2 } from "lucide-react";
import { fileBlob } from "./thumbnails";
import type { DocumentItem } from "./types";

/**
 * Télécharge le fichier sans quitter la page : le contenu est récupéré en blob puis
 * enregistré via un lien « download » (Safari iOS l'envoie dans Téléchargements au
 * lieu d'ouvrir l'URL). Le PDF déjà chargé pour l'aperçu est réutilisé.
 */
export function DownloadButton({
  doc,
  index = 0,
  className,
  label,
}: {
  doc: DocumentItem;
  index?: number;
  className?: string;
  label?: ReactNode;
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const file = doc.files[index];
  if (!file) return null;

  async function download() {
    if (state === "busy") return;
    setState("busy");
    try {
      const blob = await fileBlob(doc, index);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = file.name;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
      setState("done");
      setTimeout(() => setState("idle"), 1800);
    } catch (err) {
      console.error("[téléchargement]", err);
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  }

  const Icon = state === "busy" ? Loader2 : state === "done" ? Check : Download;
  return (
    <button
      type="button"
      onClick={download}
      aria-label={`Télécharger ${file.name}`}
      aria-busy={state === "busy"}
      className={className}
    >
      <Icon className={`size-[18px] ${state === "busy" ? "animate-spin" : ""}`} strokeWidth={2} />
      {state === "error" ? <span>Échec, réessayer</span> : label}
    </button>
  );
}
