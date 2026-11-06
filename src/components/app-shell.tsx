"use client";

import type { ReactNode } from "react";
import { MainNav } from "./main-nav";
import { SettingsMenu } from "./settings-menu";

/** Cadre commun des pages connectées : fond, navigation, réglages. */
export function AppShell({ userName, children }: { userName: string; children: ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className="canvas-light pointer-events-none fixed inset-0" />
      <div aria-hidden className="canvas-grain pointer-events-none fixed inset-0" />
      <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-5 sm:px-8 sm:pt-8">
        <div className="flex items-center justify-between gap-3">
          <MainNav />
          <SettingsMenu userName={userName} />
        </div>
        <main>{children}</main>
      </div>
    </div>
  );
}
