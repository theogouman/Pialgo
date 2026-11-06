import { animate, frame, motionValue, type AnimationPlaybackControls, type MotionValue } from "motion";

/**
 * Moteur de la transition « zoom » (façon iOS 18).
 *
 * Tout l'état visuel dérive de quelques MotionValues :
 *  - p   : progression ouverture (0 = posé sur la source, 1 = ouvert), piloté par ressort
 *  - gx, gy, gk : transformation du geste (translation + échelle autour d'une ancre)
 *  - dq  : progression « détachement » pendant un geste (atténue fond et éléments secondaires)
 *  - fade: opacité globale (mode « réduire les animations » uniquement)
 * Chaque frame, on mesure la source ET la destination en direct (getBoundingClientRect),
 * puis on écrit les styles. Les animations repartent toujours de la valeur et de la
 * vitesse courantes : ouverture/fermeture/geste sont interruptibles sans saut.
 */

export type Rect = { x: number; y: number; w: number; h: number };
type Velocity = { x: number; y: number; k: number };
export type ObjectMeta = { aspect: number; align?: [number, number] };
type Phase = "idle" | "opening" | "open" | "closing";

const SPRING_OPEN = { type: "spring", stiffness: 260, damping: 28, mass: 1, restDelta: 0.0008, restSpeed: 0.01 } as const;
const SPRING_CLOSE = { type: "spring", stiffness: 330, damping: 34, mass: 1, restDelta: 0.0008, restSpeed: 0.01 } as const;
const SPRING_CLOSE_PX = { type: "spring", stiffness: 330, damping: 34, mass: 1, restDelta: 0.3, restSpeed: 4 } as const;
const SPRING_CLOSE_SCALE = { type: "spring", stiffness: 330, damping: 34, mass: 1, restDelta: 0.0005, restSpeed: 0.01 } as const;
const SPRING_BACK_PX = { type: "spring", stiffness: 420, damping: 38, mass: 1, restDelta: 0.3, restSpeed: 4 } as const;
const SPRING_BACK_UNIT = { type: "spring", stiffness: 420, damping: 38, mass: 1, restDelta: 0.0005, restSpeed: 0.01 } as const;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

/** Ombre de l'objet. dq=0 : ombre « posée », identique sur la source et la destination. */
export function zoomShadow(dq = 0) {
  return `0 1px 2px rgba(20,20,20,0.06), 0 ${8 + 22 * dq}px ${24 + 36 * dq}px -6px rgba(20,20,20,${(0.12 + 0.16 * dq).toFixed(3)})`;
}
export const ZOOM_REST_SHADOW = zoomShadow(0);

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}
function radiusOf(el: Element) {
  return parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
}

export type ZoomElements = {
  root?: HTMLElement | null;
  backdrop?: HTMLElement | null;
  scroller?: HTMLElement | null;
  content?: HTMLElement | null;
  surface?: HTMLElement | null;
  object?: HTMLElement | null;
  inner?: HTMLElement | null;
  overlay?: HTMLElement | null;
  slot?: HTMLElement | null;
  dialog?: HTMLElement | null;
};

type TouchState =
  | { mode: "none" }
  | { mode: "pending"; x0: number; y0: number; pointerId?: number }
  | { mode: "drag"; ox: number; oy: number; bx: number; by: number; pointerId?: number }
  | { mode: "pinch"; d0: number; mx: number; my: number; bx: number; by: number; bk: number };

let scrollLocks = 0;
const openStack: ZoomEngine[] = [];

export class ZoomEngine {
  readonly p = motionValue(0);
  readonly gx = motionValue(0);
  readonly gy = motionValue(0);
  readonly gk = motionValue(1);
  readonly dq = motionValue(0);
  readonly fade = motionValue(1);
  /** Opacité des éléments secondaires (0..1), consommée par <ZoomSecondary>. */
  readonly chrome = motionValue(0);

  els: ZoomElements = {};
  meta: ObjectMeta = { aspect: 1 };
  phase: Phase = "idle";
  activeId: string | null = null;

  private sources = new Map<string, HTMLElement>();
  private sourceEl: HTMLElement | null = null;
  private srcRadius = 0;
  private dstRadius = 0;
  private fallback = false;
  private reduced = false;
  private anchor = { x: 0, y: 0 };
  private anims: AnimationPlaybackControls[] = [];
  private token = 0;
  private scheduled = false;
  private restoreFocus: HTMLElement | null = null;
  private inerted: Element[] = [];
  private touch: TouchState = { mode: "none" };
  private suppressClickUntil = 0;
  private innerSize = { w: 0, h: 0 };
  /** Échantillons récents du geste, pour calculer la vitesse du doigt au relâchement. */
  private samples: { t: number; x: number; y: number; k: number }[] = [];
  private unsubs: (() => void)[] = [];

  constructor(private setActiveId: (id: string | null) => void) {}

  /** À appeler au montage (et à chaque remontage en StrictMode). */
  attach() {
    this.detach();
    for (const v of [this.p, this.gx, this.gy, this.gk, this.dq, this.fade]) {
      this.unsubs.push(v.on("change", () => this.schedule()));
    }
  }

  detach() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }

  setEl(key: keyof ZoomElements, el: HTMLElement | null) {
    this.els[key] = el;
  }

  /** Pincement pour fermer (sinon : zoom natif du navigateur, utile pour lire un document). */
  pinchToClose = true;
  /** Couleur de page pendant l'ouverture (fond de html + theme-color : barres de Safari). */
  pageColor: string | (() => string | null) | null = null;
  private savedPage: { bg: string; theme: string | null } | null = null;

  setOptions(o: { pinchToClose?: boolean; pageColor?: string | (() => string | null) | null }) {
    if (o.pinchToClose !== undefined) this.pinchToClose = o.pinchToClose;
    if (o.pageColor !== undefined) this.pageColor = o.pageColor;
  }

  private applyPageColor() {
    const color = typeof this.pageColor === "function" ? this.pageColor() : this.pageColor;
    if (!color || this.savedPage) return;
    const html = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    this.savedPage = { bg: html.style.backgroundColor, theme: meta?.content ?? null };
    html.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
    if (meta) meta.content = color;
  }

  private restorePageColor() {
    if (!this.savedPage) return;
    const html = document.documentElement;
    html.style.backgroundColor = this.savedPage.bg;
    document.body.style.backgroundColor = this.savedPage.bg;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta && this.savedPage.theme !== null) meta.content = this.savedPage.theme;
    this.savedPage = null;
  }

  /** Ramène le zoom natif (pincement) à 100 % — astuce viewport, efficace sur iOS. */
  private resetPageZoom() {
    const vv = window.visualViewport;
    if (!vv || vv.scale <= 1.01) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    const original = meta.content;
    meta.content = `${original}, maximum-scale=1`;
    setTimeout(() => (meta.content = original), 400);
  }

  setMeta(meta: ObjectMeta) {
    this.meta = meta;
    this.schedule();
  }

  // ---------- Registre des sources ----------

  register(id: string, el: HTMLElement | null) {
    if (el) this.sources.set(id, el);
    else if (this.sources.get(id)) this.sources.delete(id);
  }

  // ---------- API publique ----------

  open(id: string) {
    if (this.activeId === id && this.phase !== "idle") {
      this.reopen();
      return;
    }
    if (this.activeId && this.activeId !== id) this.finish();
    const active = document.activeElement;
    this.restoreFocus = active instanceof HTMLElement && active !== document.body ? active : null;
    this.activeId = id;
    this.phase = "opening";
    this.setActiveId(id);
    // La suite se passe dans mounted(), appelé en layout effect une fois le DOM prêt.
  }

  close(v: Velocity = { x: 0, y: 0, k: 0 }) {
    if (this.phase === "idle" || this.phase === "closing") return;
    if (!this.pinchToClose) this.resetPageZoom();
    this.phase = "closing";
    const token = ++this.token;
    this.setInert(false);
    if (this.els.root) this.els.root.style.pointerEvents = "none";

    const src = this.activeId ? this.sources.get(this.activeId) : undefined;
    this.sourceEl = src ?? null;
    this.fallback = !src || !src.isConnected || !this.isVisible(rectOf(src));
    if (src && !this.fallback) this.srcRadius = radiusOf(src);

    this.stopAll();
    if (this.reduced) {
      this.anims = [animate(this.fade, 0, { duration: 0.16, ease: "easeOut" })];
    } else {
      this.anims = [
        animate(this.p, 0, SPRING_CLOSE),
        animate(this.gx, 0, { ...SPRING_CLOSE_PX, velocity: v.x }),
        animate(this.gy, 0, { ...SPRING_CLOSE_PX, velocity: v.y }),
        animate(this.gk, 1, { ...SPRING_CLOSE_SCALE, velocity: v.k }),
      ];
    }
    Promise.all(this.anims.map((a) => a.finished)).then(() => {
      if (token === this.token && this.phase === "closing") this.finish();
    });
  }

  /** Appelé par la présentation une fois l'overlay monté pour activeId. */
  mounted() {
    const id = this.activeId;
    if (!id || this.phase !== "opening") return;
    const token = ++this.token;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const src = this.sources.get(id) ?? null;
    this.sourceEl = src;
    this.fallback = !src || !this.isVisible(rectOf(src));
    if (src) {
      this.srcRadius = radiusOf(src);
      src.style.opacity = "0";
      src.setAttribute("data-zoom-source-hidden", "");
    }
    if (this.els.slot) this.dstRadius = radiusOf(this.els.slot);
    if (this.els.root) {
      this.els.root.style.display = "";
      this.els.root.style.pointerEvents = "";
    }
    this.lockScroll();
    this.setInert(true);
    this.applyPageColor();
    if (!openStack.includes(this)) openStack.push(this);

    this.stopAll();
    this.gx.jump(0);
    this.gy.jump(0);
    this.gk.jump(1);
    this.dq.jump(0);
    this.innerSize = { w: 0, h: 0 };
    if (this.reduced) {
      this.p.jump(1);
      this.fade.jump(0);
      this.render();
      this.anims = [animate(this.fade, 1, { duration: 0.2, ease: "easeOut" })];
    } else {
      this.fade.jump(1);
      this.p.jump(0);
      this.render(); // première frame peinte : l'objet est exactement sur la source
      this.anims = [animate(this.p, 1, SPRING_OPEN)];
    }
    Promise.all(this.anims.map((a) => a.finished)).then(() => {
      if (token === this.token && this.phase === "opening") this.phase = "open";
    });
    this.els.dialog?.focus({ preventScroll: true });
  }

  private reopen() {
    const token = ++this.token;
    this.phase = "opening";
    this.setInert(true);
    if (this.els.root) this.els.root.style.pointerEvents = "";
    this.stopAll();
    this.anims = this.reduced
      ? [animate(this.fade, 1, { duration: 0.2, ease: "easeOut" })]
      : [
          animate(this.p, 1, SPRING_OPEN),
          animate(this.gx, 0, SPRING_BACK_PX),
          animate(this.gy, 0, SPRING_BACK_PX),
          animate(this.gk, 1, SPRING_BACK_UNIT),
          animate(this.dq, 0, SPRING_BACK_UNIT),
        ];
    Promise.all(this.anims.map((a) => a.finished)).then(() => {
      if (token === this.token && this.phase === "opening") this.phase = "open";
    });
    this.els.dialog?.focus({ preventScroll: true });
  }

  /** Fin de fermeture : tout est permuté dans la même tâche, donc sans frame intermédiaire. */
  finish() {
    this.token++;
    this.stopAll();
    if (this.sourceEl) {
      this.sourceEl.removeAttribute("data-zoom-source-hidden");
      this.sourceEl.style.opacity = "";
    }
    if (this.els.root) this.els.root.style.display = "none";
    this.unlockScroll();
    this.setInert(false);
    this.restorePageColor();
    const i = openStack.indexOf(this);
    if (i >= 0) openStack.splice(i, 1);
    const focusTarget =
      this.restoreFocus?.isConnected
        ? this.restoreFocus
        : (this.sourceEl?.closest<HTMLElement>("button, a, [tabindex]") ?? null);
    focusTarget?.focus({ preventScroll: true });
    this.restoreFocus = null;
    this.phase = "idle";
    this.activeId = null;
    this.sourceEl = null;
    this.touch = { mode: "none" };
    this.setActiveId(null);
  }

  // ---------- Rendu ----------

  schedule = () => {
    if (this.scheduled || this.phase === "idle") return;
    this.scheduled = true;
    frame.preRender(() => {
      this.scheduled = false;
      this.render();
    });
  };

  private isVisible(r: Rect) {
    return r.w > 0 && r.h > 0 && r.y + r.h > 0 && r.y < window.innerHeight && r.x + r.w > 0 && r.x < window.innerWidth;
  }

  render() {
    const { object, inner, overlay, slot, content, backdrop, surface, root } = this.els;
    if (!object || !inner || !slot || !content || this.phase === "idle") return;

    // Lectures (avant toute écriture)
    const D = rectOf(slot);
    const O = content.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let S: Rect;
    const src = this.sourceEl;
    if (this.fallback || !src || !src.isConnected) {
      S = { w: D.w * 0.5, h: D.h * 0.5, x: vw / 2 - D.w * 0.25, y: vh / 2 - D.h * 0.25 };
    } else {
      S = rectOf(src);
    }

    const p = this.p.get();
    const k = this.gk.get();
    const dq = this.dq.get();
    const gx = this.gx.get();
    const gy = this.gy.get();
    const A = this.anchor;

    const R0: Rect = { x: lerp(S.x, D.x, p), y: lerp(S.y, D.y, p), w: lerp(S.w, D.w, p), h: lerp(S.h, D.h, p) };
    const R: Rect = {
      x: A.x + k * (R0.x - A.x) + gx,
      y: A.y + k * (R0.y - A.y) + gy,
      w: Math.max(1, R0.w * k),
      h: Math.max(1, R0.h * k),
    };
    const srcR = this.fallback ? this.dstRadius : this.srcRadius;
    const radius = Math.max(0, lerp(srcR, this.dstRadius, p)) + 14 * dq;

    // Écritures
    object.style.transform = `translate3d(${R.x - O.left}px, ${R.y - O.top}px, 0)`;
    object.style.width = `${R.w}px`;
    object.style.height = `${R.h}px`;
    object.style.borderRadius = `${radius}px`;
    object.style.boxShadow = zoomShadow(dq);
    if (!object.hasAttribute("data-zoom-source-hidden")) {
      object.style.opacity = this.fallback ? String(clamp(p * 1.5)) : "1";
    }

    // Contenu : base dimensionnée en « cover » sur la destination, puis échelle UNIFORME
    // pour couvrir le cadre courant. Jamais d'étirement, une seule image.
    const a = this.meta.aspect > 0 ? this.meta.aspect : 1;
    const [ax, ay] = this.meta.align ?? [0.5, 0.5];
    const bw = D.w / D.h > a ? D.w : D.h * a;
    const bh = D.w / D.h > a ? D.w / a : D.h;
    if (Math.abs(bw - this.innerSize.w) > 0.5 || Math.abs(bh - this.innerSize.h) > 0.5) {
      this.innerSize = { w: bw, h: bh };
      inner.style.width = `${bw}px`;
      inner.style.height = `${bh}px`;
    }
    const s = Math.max(R.w / bw, R.h / bh);
    inner.style.transform = `translate3d(${(R.w - bw * s) * ax}px, ${(R.h - bh * s) * ay}px, 0) scale(${s})`;

    const pc = clamp(p);
    if (backdrop) backdrop.style.opacity = String(pc * (1 - dq));
    // Décor de la source (titre, voile) : identique à la source à p=0, disparaît tôt à
    // l'ouverture et revient en fin de fermeture. L'opacité est posée sur chaque calque
    // [data-zoom-fade] (pas sur un parent) pour ne pas casser leurs backdrop-filter.
    if (overlay) {
      const o = String(this.reduced ? 0 : 1 - smooth(p / 0.35));
      overlay.querySelectorAll<HTMLElement>("[data-zoom-fade]").forEach((el) => (el.style.opacity = o));
    }
    if (surface) surface.style.opacity = String(clamp(p / 0.55) * (1 - dq));
    this.chrome.set(this.reduced ? 1 : smooth((p - 0.55) / 0.45) * (1 - clamp(dq * 2.5)));
    if (root) root.style.opacity = this.reduced ? String(this.fade.get()) : "1";
  }

  // ---------- Gestes ----------

  private interactive() {
    return (this.phase === "open" || this.phase === "opening") && !this.reduced;
  }

  private beginGesture(ax: number, ay: number) {
    // Reprend depuis l'état courant (y compris si un retour élastique est en cours).
    for (const a of this.anims) a.stop();
    for (const v of [this.gx, this.gy, this.gk, this.dq]) v.stop();
    if (Math.abs(this.gk.get() - 1) < 0.002) this.anchor = { x: ax - this.gx.get(), y: ay - this.gy.get() };
    if (this.phase === "opening") {
      // l'ouverture continue sous le doigt
      this.anims = [animate(this.p, 1, SPRING_OPEN)];
    }
    if (this.els.root) this.els.root.style.userSelect = "none";
    this.samples = [];
    this.sample();
  }

  private sample() {
    const t = performance.now();
    this.samples.push({ t, x: this.gx.get(), y: this.gy.get(), k: this.gk.get() });
    while (this.samples.length > 2 && t - this.samples[0].t > 120) this.samples.shift();
  }

  /** Vitesse du doigt (unités/s) sur les ~100 dernières ms ; 0 si le doigt s'est arrêté. */
  private fingerVelocity(): Velocity {
    const now = performance.now();
    const recent = this.samples.filter((s) => now - s.t <= 100);
    this.samples = [];
    if (recent.length < 2) return { x: 0, y: 0, k: 0 };
    const a = recent[0];
    const b = recent[recent.length - 1];
    const dt = Math.max(16, b.t - a.t) / 1000;
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt, k: (b.k - a.k) / dt };
  }

  private dragTo(dx: number, dy: number, bx: number, by: number) {
    const vh = window.innerHeight;
    const y = by + (dy < 0 ? dy * 0.35 : dy);
    this.gx.set(bx + dx * 0.9);
    this.gy.set(y);
    const q = clamp(y / vh);
    this.gk.set(1 - 0.55 * q);
    this.dq.set(clamp(y / (vh * 0.35)));
    this.sample();
  }

  private release(kind: "drag" | "pinch") {
    if (this.els.root) this.els.root.style.userSelect = "";
    const vh = window.innerHeight;
    const v = this.fingerVelocity();
    const shouldClose =
      kind === "drag"
        ? this.gy.get() > vh * 0.25 || (v.y > 500 && this.gy.get() > 4)
        : this.gk.get() < 0.86 || v.k < -0.8;
    if (shouldClose) {
      this.close(v);
      return;
    }
    this.stopAll();
    this.anims = [
      animate(this.gx, 0, { ...SPRING_BACK_PX, velocity: v.x }),
      animate(this.gy, 0, { ...SPRING_BACK_PX, velocity: v.y }),
      animate(this.gk, 1, { ...SPRING_BACK_UNIT, velocity: v.k }),
      animate(this.dq, 0, SPRING_BACK_UNIT),
    ];
    if (this.p.get() < 1) this.anims.push(animate(this.p, 1, SPRING_OPEN));
    const token = ++this.token;
    Promise.all(this.anims.map((a) => a.finished)).then(() => {
      if (token === this.token && this.phase === "opening") this.phase = "open";
    });
  }

  /** Branche les gestes (glisser vers le bas, pincement, souris) sur le conteneur scrollable. */
  bindGestures(scroller: HTMLElement) {
    const atTop = () => scroller.scrollTop <= 0;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });

    const onTouchStart = (e: TouchEvent) => {
      if (!this.interactive()) return;
      const zoomed = (window.visualViewport?.scale ?? 1) > 1.01;
      if (e.touches.length === 1 && this.touch.mode === "none") {
        // Page agrandie au pincement : un doigt sert à se déplacer, pas à fermer.
        this.touch = zoomed ? { mode: "none" } : { mode: "pending", x0: e.touches[0].clientX, y0: e.touches[0].clientY };
      } else if (e.touches.length === 2 && !this.pinchToClose) {
        this.touch = { mode: "none" }; // zoom natif du navigateur
      } else if (e.touches.length === 2) {
        const m = mid(e.touches);
        this.beginGesture(m.x, m.y);
        this.touch = { mode: "pinch", d0: dist(e.touches), mx: m.x, my: m.y, bx: this.gx.get(), by: this.gy.get(), bk: this.gk.get() };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = this.touch;
      if (t.mode === "pending" && e.touches.length === 1) {
        const dx = e.touches[0].clientX - t.x0;
        const dy = e.touches[0].clientY - t.y0;
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (dy > 0 && dy > Math.abs(dx) && atTop()) {
          const x = e.touches[0].clientX;
          const y = e.touches[0].clientY;
          this.beginGesture(x, y);
          this.touch = { mode: "drag", ox: x, oy: y, bx: this.gx.get(), by: this.gy.get() };
          e.preventDefault();
        } else {
          this.touch = { mode: "none" };
        }
      } else if (t.mode === "drag") {
        e.preventDefault();
        this.dragTo(e.touches[0].clientX - t.ox, e.touches[0].clientY - t.oy, t.bx, t.by);
      } else if (t.mode === "pinch" && e.touches.length >= 2) {
        e.preventDefault();
        const ratio = dist(e.touches) / t.d0;
        let k = t.bk * ratio;
        if (k > 1) k = 1 + (k - 1) * 0.25;
        const m = mid(e.touches);
        this.gk.set(k);
        this.gx.set(t.bx + (m.x - t.mx));
        this.gy.set(t.by + (m.y - t.my));
        this.dq.set(clamp((1 - k) / 0.4));
        this.sample();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const t = this.touch;
      if (t.mode === "drag" && e.touches.length === 0) {
        this.touch = { mode: "none" };
        this.release("drag");
      } else if (t.mode === "pinch" && e.touches.length < 2) {
        this.touch = { mode: "none" };
        this.release("pinch");
      } else if (e.touches.length === 0) {
        this.touch = { mode: "none" };
      }
    };

    // Souris / stylet : même geste au cliquer-glisser.
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.button !== 0 || !this.interactive()) return;
      const target = e.target as HTMLElement;
      if (target.closest("button:not([data-zoom-drag]), a:not([data-zoom-drag]), input, textarea, select, [data-zoom-nodrag]")) return;
      if (!atTop()) return;
      this.touch = { mode: "pending", x0: e.clientX, y0: e.clientY, pointerId: e.pointerId };
    };
    const onPointerMove = (e: PointerEvent) => {
      const t = this.touch;
      if (t.mode === "pending" && t.pointerId === e.pointerId) {
        const dx = e.clientX - t.x0;
        const dy = e.clientY - t.y0;
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (dy > 0 && dy > Math.abs(dx)) {
          this.beginGesture(e.clientX, e.clientY);
          this.touch = { mode: "drag", ox: e.clientX, oy: e.clientY, bx: this.gx.get(), by: this.gy.get(), pointerId: e.pointerId };
        } else this.touch = { mode: "none" };
      } else if (t.mode === "drag" && t.pointerId === e.pointerId) {
        e.preventDefault();
        this.dragTo(e.clientX - t.ox, e.clientY - t.oy, t.bx, t.by);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      const t = this.touch;
      if ((t.mode === "drag" || t.mode === "pending") && t.pointerId === e.pointerId) {
        this.touch = { mode: "none" };
        if (t.mode === "drag") {
          this.suppressClickUntil = performance.now() + 300;
          this.release("drag");
        }
      }
    };
    const onGesture = (e: Event) => {
      if (this.pinchToClose) e.preventDefault(); // Safari iOS : pas de zoom navigateur
    };
    // Un cliquer-glisser ne doit pas déclencher de clic (lien, fond) au relâchement.
    const onClickCapture = (e: MouseEvent) => {
      if (this.clickSuppressed()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    scroller.addEventListener("click", onClickCapture, true);

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", onTouchEnd);
    scroller.addEventListener("touchcancel", onTouchEnd);
    scroller.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    scroller.addEventListener("gesturestart", onGesture);
    return () => {
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchEnd);
      scroller.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      scroller.removeEventListener("gesturestart", onGesture);
      scroller.removeEventListener("click", onClickCapture, true);
    };
  }

  clickSuppressed() {
    return performance.now() < this.suppressClickUntil;
  }

  // ---------- Utilitaires ----------

  private stopAll() {
    for (const a of this.anims) a.stop();
    this.anims = [];
    for (const v of [this.p, this.gx, this.gy, this.gk, this.dq, this.fade]) v.stop();
  }

  // Verrou partagé : plusieurs niveaux de zoom peuvent être ouverts en même temps.
  private scrollLocked = false;
  private lockScroll() {
    if (this.scrollLocked) return;
    this.scrollLocked = true;
    if (scrollLocks++ === 0) document.documentElement.style.overflow = "hidden";
  }
  private unlockScroll() {
    if (!this.scrollLocked) return;
    this.scrollLocked = false;
    if (--scrollLocks === 0) document.documentElement.style.overflow = "";
  }

  /** Vrai si ce niveau est le plus haut ouvert (seul lui réagit à Échap / Tab). */
  isTopmost() {
    return openStack[openStack.length - 1] === this;
  }

  private setInert(on: boolean) {
    if (on) {
      if (this.inerted.length) return;
      const root = this.els.root;
      for (const el of Array.from(document.body.children)) {
        if (el === root || el.contains(root ?? null) || el.hasAttribute("inert")) continue;
        if (el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
        el.setAttribute("inert", "");
        this.inerted.push(el);
      }
    } else {
      for (const el of this.inerted) el.removeAttribute("inert");
      this.inerted = [];
    }
  }
}

export type { MotionValue };
