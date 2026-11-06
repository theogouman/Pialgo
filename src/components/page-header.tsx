"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
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
    <header className="mt-8 flex flex-col gap-5 px-1 sm:mt-12 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-xl">
        <motion.h1 {...rise(0)} className="text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[44px]">
          {title}
        </motion.h1>
        <motion.p {...rise(0.06)} className="mt-3 text-[16px] leading-relaxed text-ink-soft sm:text-[17px]">
          {subtitle}
        </motion.p>
      </div>
      {actions && <motion.div {...rise(0.1)}>{actions}</motion.div>}
    </header>
  );
}
