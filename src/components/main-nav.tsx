"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Documents" },
  { href: "/identite", label: "Identité" },
] as const;

/** Navigation principale : pastille dont l'indicateur glisse vers l'onglet actif. */
export function MainNav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <nav aria-label="Navigation principale">
      <ul className="flex items-center gap-0.5 rounded-full border border-line bg-white/80 p-1 shadow-[0_1px_2px_rgba(20,20,20,0.05)]">
        {LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <li key={link.href} className="relative">
              {active && (
                <motion.span
                  layoutId="main-nav-indicator"
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-ink"
                  transition={reduce ? { duration: 0 } : { type: "spring", visualDuration: 0.35, bounce: 0.12 }}
                />
              )}
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative block rounded-full px-4 py-1.5 text-[14px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-mute/50",
                  active ? "text-white" : "text-ink-soft hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
