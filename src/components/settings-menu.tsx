"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LogOut, Settings } from "lucide-react";

export function SettingsMenu({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Réglages"
        aria-haspopup="menu"
        aria-expanded={open}
        whileTap={reduce ? undefined : { scale: 0.92 }}
        className="grid size-10 place-items-center rounded-full border border-line bg-white/80 text-ink-soft shadow-[0_1px_2px_rgba(20,20,20,0.05)] backdrop-blur-xl outline-none focus-visible:ring-2 focus-visible:ring-mute/50"
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className="grid place-items-center"
        >
          <Settings className="size-[19px]" strokeWidth={1.8} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -6, filter: "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: -4, filter: "blur(4px)" }}
            transition={{ type: "spring", visualDuration: 0.28, bounce: 0.15 }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-12 z-40 w-56 overflow-hidden rounded-[20px] border border-line bg-white/85 p-1.5 shadow-[0_1px_2px_rgba(20,20,20,0.05),0_18px_40px_-12px_rgba(20,20,20,0.2)] backdrop-blur-2xl"
          >
            <div className="px-3 pb-2 pt-2">
              <p className="text-[12px] text-mute">Connecté·e en tant que</p>
              <p className="text-[15px] font-medium text-ink">{userName}</p>
            </div>
            <div className="mx-2 h-px bg-line" />
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              disabled={pending}
              className="mt-1 flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-[15px] font-medium text-[#d6342b] transition-colors hover:bg-[#FF3B30]/8 focus-visible:bg-[#FF3B30]/8 focus-visible:outline-none disabled:opacity-60"
            >
              <LogOut className="size-[18px]" strokeWidth={1.9} />
              {pending ? "Déconnexion…" : "Se déconnecter"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
