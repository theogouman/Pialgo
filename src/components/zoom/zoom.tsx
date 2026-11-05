"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { ZoomEngine, ZOOM_REST_SHADOW, type ObjectMeta } from "./engine";

export { ZOOM_REST_SHADOW };

type ZoomContextValue = {
  engine: ZoomEngine;
  activeId: string | null;
  open: (id: string) => void;
  close: () => void;
};

const ZoomContext = createContext<ZoomContextValue | null>(null);

export function useZoom() {
  const ctx = useContext(ZoomContext);
  if (!ctx) throw new Error("useZoom doit être utilisé dans <ZoomProvider>");
  return ctx;
}

/** Fournit un moteur de transition. Une paire source/destination = un id. */
export function ZoomProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [engine] = useState(() => new ZoomEngine((id) => setActiveId(id)));
  useEffect(() => {
    engine.attach();
    return () => engine.detach();
  }, [engine]);

  const open = useCallback((id: string) => engine.open(id), [engine]);
  const close = useCallback(() => engine.close(), [engine]);
  const value = useMemo(() => ({ engine, activeId, open, close }), [engine, activeId, open, close]);
  return <ZoomContext value={value}>{children}</ZoomContext>;
}

/**
 * Élément source (miniature). Son rayon de coin est lu dans le CSS calculé.
 * Il reçoit l'ombre « posée » commune à l'objet, pour une continuité parfaite.
 */
export function ZoomSource({
  id,
  className,
  style,
  children,
}: {
  id: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { engine } = useZoom();
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      engine.register(id, el);
      return () => engine.register(id, null);
    },
    [engine, id],
  );
  return (
    <div ref={ref} data-zoom-source={id} className={cn("overflow-hidden", className)} style={{ boxShadow: ZOOM_REST_SHADOW, ...style }}>
      {children}
    </div>
  );
}

/** Emplacement de destination dans la vue détail. L'objet vient s'y poser. */
export function ZoomTarget({ className, style, children }: { className?: string; style?: CSSProperties; children?: ReactNode }) {
  const { engine } = useZoom();
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      engine.setEl("slot", el);
    },
    [engine],
  );
  return (
    <div ref={ref} data-zoom-target className={cn("relative", className)} style={style}>
      {children}
    </div>
  );
}

/** Éléments secondaires de la destination : fondu + léger décalage, après l'objet. */
export function ZoomSecondary({
  className,
  children,
  offset = 10,
}: {
  className?: string;
  children: ReactNode;
  offset?: number;
}) {
  const { engine } = useZoom();
  const chrome = engine.chrome as MotionValue<number>;
  const y = useTransform(chrome, (v) => (1 - v) * offset);
  return (
    <motion.div className={className} style={{ opacity: chrome, y }}>
      {children}
    </motion.div>
  );
}

type PresentationProps = {
  /** Contenu de l'objet qui zoome (image, couverture…), rendu en « cover ». */
  renderObject: (id: string) => ReactNode;
  /**
   * Décor optionnel affiché par-dessus l'objet, à l'identique de la source (titre, voile…).
   * Il n'est pas mis à l'échelle et s'estompe pendant l'ouverture. Marquer chaque calque
   * avec data-zoom-fade.
   */
  renderOverlay?: (id: string) => ReactNode;
  /** Ratio naturel du contenu de l'objet et son alignement (équivalent object-position). */
  getMeta: (id: string) => ObjectMeta;
  /** Contenu de la vue détail ; doit contenir un <ZoomTarget/>. */
  children: (id: string) => ReactNode;
  labelledBy?: string;
  panelClassName?: string;
  surfaceClassName?: string;
  contentClassName?: string;
  backdropClassName?: string;
};

/** Vue détail plein écran, portée dans <body>. */
export function ZoomPresentation({
  renderObject,
  renderOverlay,
  getMeta,
  children,
  labelledBy,
  panelClassName,
  surfaceClassName,
  contentClassName,
  backdropClassName,
}: PresentationProps) {
  const { engine, activeId, close } = useZoom();
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const meta = activeId ? getMeta(activeId) : null;

  // Le contenu de l'objet peut changer de ratio (miniature chargée…).
  useLayoutEffect(() => {
    if (!meta) return;
    engine.setMeta(meta);
  }, [engine, meta?.aspect, meta?.align?.[0], meta?.align?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // Montage : positionne l'objet sur la source AVANT la première peinture.
  useLayoutEffect(() => {
    if (!activeId) return;
    engine.mounted();
  }, [engine, activeId]);

  useEffect(() => {
    if (!activeId) return;
    const scroller = scrollerRef.current;
    engine.setEl("scroller", scroller);
    const unbind = scroller ? engine.bindGestures(scroller) : undefined;
    const onResize = () => engine.schedule();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Tab") {
        trapFocus(e, engine.els.dialog);
      }
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKey);
    return () => {
      unbind?.();
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
    };
  }, [engine, activeId, close]);

  if (!activeId) return null;

  const set = (key: keyof ZoomEngine["els"]) => (el: HTMLElement | null) => engine.setEl(key, el);

  const onBackdropClick = (e: React.MouseEvent) => {
    if (engine.clickSuppressed()) return;
    if (e.target === e.currentTarget) close();
  };

  return createPortal(
    <div ref={set("root")} className="fixed inset-0 z-50" data-zoom-root>
      <div
        ref={set("backdrop")}
        aria-hidden
        className={cn("absolute inset-0 bg-[#0b0b14]/40", backdropClassName)}
        style={{ opacity: 0 }}
      />
      <div
        ref={scrollerRef}
        className="absolute inset-0 overflow-y-auto overscroll-contain"
        style={{ touchAction: "pan-y" }}
        onClick={onBackdropClick}
      >
        <div ref={set("content")} className={cn("relative min-h-full", contentClassName)} onClick={onBackdropClick}>
          <div
            ref={set("dialog")}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            className={cn("relative outline-none", panelClassName)}
          >
            <div ref={set("surface")} aria-hidden className={cn("absolute inset-0", surfaceClassName)} style={{ opacity: 0 }} />
            <div className="relative">{children(activeId)}</div>
          </div>
          {/* L'objet : un seul élément, au-dessus de tout, jamais dupliqué. */}
          <div
            ref={set("object")}
            data-zoom-object
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-10 overflow-hidden bg-[#F4F4F9]"
            style={{ contain: "strict", willChange: "transform", transformOrigin: "0 0" }}
          >
            <div ref={set("inner")} data-zoom-inner className="absolute left-0 top-0" style={{ transformOrigin: "0 0", willChange: "transform" }}>
              {renderObject(activeId)}
            </div>
            {renderOverlay && (
              <div ref={set("overlay")} className="absolute inset-0">
                {renderOverlay(activeId)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function trapFocus(e: KeyboardEvent, container?: HTMLElement | null) {
  if (!container) return;
  const focusables = Array.from(
    container.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'),
  ).filter((el) => el.offsetParent !== null);
  if (!focusables.length) {
    e.preventDefault();
    container.focus();
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === container)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}
