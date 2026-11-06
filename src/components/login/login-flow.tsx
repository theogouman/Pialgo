"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { OtpInput, type OtpStatus } from "@/components/ui/otp-input";
import { PEOPLE, type PersonId } from "@/lib/people";
import { cn } from "@/lib/utils";

type Step = "idle" | "choose" | "code";

const MORPH = { type: "spring", visualDuration: 0.5, bounce: 0.06 } as const;
const CLOSED_W = 184;
const CLOSED_H = 56;

export function LoginFlow() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("idle");
  const [person, setPerson] = useState<PersonId | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<OtpStatus>("idle");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // Après un renvoi, l'ancien code n'est plus valable : on le signale.
  const [resent, setResent] = useState(false);
  const otpRef = useRef<HTMLDivElement>(null);
  const focusFirstSlot = () =>
    requestAnimationFrame(() => otpRef.current?.querySelector<HTMLInputElement>("input")?.focus());

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode(id: PersonId) {
    // Passage immédiat à la saisie du code : la requête se fait en arrière-plan.
    const fromChoose = step !== "code";
    setPerson(id);
    setSending(true);
    setError(null);
    if (fromChoose) {
      setResent(false);
      setSentTo([]);
      setCode("");
      setStatus("idle");
      setStep("code");
    }
    const fail = (message: string) => {
      setError(message);
      if (fromChoose) {
        setStep("choose");
        setPerson(null);
      }
    };
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429 && !fromChoose) {
          setError(json.error ?? "Patientez avant de redemander un code.");
          setCooldown(30);
        } else fail(json.error ?? "Une erreur est survenue.");
        return;
      }
      setSentTo(json.sentTo ?? []);
      setCooldown(30);
      setResent(!fromChoose);
    } catch {
      fail("Connexion impossible. Vérifiez votre réseau.");
    } finally {
      setSending(false);
    }
  }

  async function verify(value: string) {
    if (verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setError(json.error ?? "Code incorrect.");
        setTimeout(() => {
          setCode("");
          setStatus("idle");
          focusFirstSlot();
        }, 700);
        return;
      }
      setStatus("success");
      setTimeout(() => {
        router.replace("/");
        router.refresh();
      }, 650);
    } catch {
      setStatus("error");
      setError("Connexion impossible. Vérifiez votre réseau.");
    } finally {
      setVerifying(false);
    }
  }

  const name = PEOPLE.find((p) => p.id === person)?.name;
  const open = step !== "idle";

  // Le morph anime UN seul élément (largeur, hauteur, couleur) avec un rayon fixe de 28 px :
  // coins toujours parfaitement ronds, contenu jamais écrasé (pas de transform scale).
  const wrapRef = useRef<HTMLDivElement>(null);
  const [panelW, setPanelW] = useState(0);
  const [panelEl, setPanelEl] = useState<HTMLDivElement | null>(null);
  const [panelH, setPanelH] = useState(0);
  // Le panneau sortant (AnimatePresence) se démonte APRÈS le montage du nouveau :
  // on ignore son « null » pour continuer à mesurer le panneau actif.
  const keepPanel = (el: HTMLDivElement | null) => {
    if (el) setPanelEl(el);
  };

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPanelW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!panelEl) return;
    // ResizeObserver notifie aussi la taille initiale, avant la peinture.
    const ro = new ResizeObserver(() => setPanelH(panelEl.offsetHeight));
    ro.observe(panelEl);
    return () => ro.disconnect();
  }, [panelEl]);

  const morph = reduce ? { duration: 0 } : MORPH;

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden className="canvas-light pointer-events-none absolute inset-0" />
      <div aria-hidden className="canvas-grain pointer-events-none absolute inset-0" />

      <div ref={wrapRef} className="relative flex w-full max-w-[400px] flex-col items-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ type: "spring", visualDuration: 0.6, bounce: 0 }}
          className="mb-9 text-center"
        >
          <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-mute">Espace privé</p>
          <h1 className="mt-2.5 text-[34px] font-semibold tracking-[-0.03em] text-ink">SCI Pialgo</h1>
        </motion.div>

        <motion.div
          data-glass
          initial={false}
          animate={{
            width: open ? panelW || 360 : CLOSED_W,
            height: open ? panelH || CLOSED_H : CLOSED_H,
            backgroundColor: open ? "rgba(255,255,255,0.72)" : "rgba(22,22,22,1)",
            borderColor: open ? "rgba(228,226,221,1)" : "rgba(22,22,22,1)",
          }}
          whileTap={!open && !reduce ? { scale: 0.97 } : undefined}
          transition={morph}
          style={{ borderRadius: 28 }}
          className="relative overflow-hidden border shadow-[0_1px_2px_rgba(20,20,20,0.06),0_20px_50px_-24px_rgba(20,20,20,0.35)] backdrop-blur-xl"
        >
          <AnimatePresence initial={false}>
            {!open && (
              <motion.button
                key="cta"
                type="button"
                onClick={() => setStep("choose")}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                className="absolute inset-0 rounded-[28px] text-[16px] font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-mute/50 focus-visible:ring-offset-2"
              >
                Se connecter
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {step === "choose" && (
              <Panel key="choose" reduce={!!reduce} width={panelW} panelRef={keepPanel}>
                <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">Qui se connecte ?</h2>
                <p className="mt-1 text-[14px] text-ink-soft">Un code à 4 chiffres vous sera envoyé par e-mail.</p>
                <div role="radiogroup" aria-label="Choisissez votre nom" className="mt-5 grid grid-cols-2 gap-2.5">
                  {PEOPLE.map((p, i) => {
                    const selected = person === p.id;
                    return (
                      <motion.button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={sending}
                        onClick={() => requestCode(p.id)}
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", visualDuration: 0.35, bounce: 0, delay: 0.16 + i * 0.04 }}
                        whileTap={reduce ? undefined : { scale: 0.97 }}
                        className={cn(
                          "relative flex h-[58px] items-center justify-between rounded-[18px] border px-4 text-left text-[16px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-mute/50",
                          selected ? "border-ink bg-ink text-white" : "border-line bg-white/70 text-ink hover:bg-white",
                          sending && !selected && "opacity-50",
                        )}
                      >
                        {p.name}
                        <span className="grid size-5 place-items-center">
                          {selected && sending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <span
                              className={cn(
                                "size-[18px] rounded-full border-[1.5px]",
                                selected ? "border-white bg-white" : "border-mute/50",
                              )}
                            />
                          )}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
                <ErrorLine error={error} />
              </Panel>
            )}
            {step === "code" && (
              <Panel key="code" reduce={!!reduce} width={panelW} panelRef={keepPanel}>
                <button
                  type="button"
                  onClick={() => {
                    setStep("choose");
                    setError(null);
                    setPerson(null);
                  }}
                  className="-ml-1 mb-3 inline-flex items-center gap-1 rounded-full px-1 py-0.5 text-[13px] font-medium text-mute outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-mute/50"
                >
                  <ArrowLeft className="size-3.5" /> Changer de personne
                </button>
                <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">Bonjour {name}</h2>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
                  {sentTo.length ? (
                    <>
                      Saisissez le code envoyé à <span className="font-medium text-ink">{sentTo.join(" et ")}</span>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" /> Envoi du code par e-mail…
                    </span>
                  )}
                </p>
                <div ref={otpRef} className="mt-6 flex justify-center">
                  <OtpInput
                    length={4}
                    size="lg"
                    value={code}
                    onChange={setCode}
                    onComplete={verify}
                    status={status}
                    disabled={status === "success"}
                    autoFocus
                    slotClassName="bg-white dark:bg-white border border-line sm:size-16 sm:text-2xl"
                    aria-label="Code de connexion"
                  />
                </div>
                <div className="mt-5 flex min-h-6 items-center justify-center text-[13px]">
                  {status === "success" ? (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="inline-flex items-center gap-1.5 font-medium text-[#1f9d48]"
                    >
                      <Check className="size-4" /> Connexion…
                    </motion.span>
                  ) : (
                    <button
                      type="button"
                      disabled={cooldown > 0 || sending}
                      onClick={() => person && requestCode(person)}
                      className="rounded-full px-2 py-0.5 font-medium text-mute outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-mute/50 disabled:cursor-default disabled:hover:text-mute"
                    >
                      {sending ? "Envoi…" : cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : "Renvoyer le code"}
                    </button>
                  )}
                </div>
                {resent && !error && status !== "success" && (
                  <p className="pt-2 text-center text-[13px] text-mute">Nouveau code envoyé : seul le dernier reçu est valable.</p>
                )}
                <ErrorLine error={error} center />
              </Panel>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

    </div>
  );
}

function Panel({
  children,
  reduce,
  width,
  panelRef,
}: {
  children: React.ReactNode;
  reduce: boolean;
  width: number;
  panelRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <motion.div
      ref={panelRef}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(6px)", transition: { duration: 0.15 } }}
      transition={{ type: "spring", visualDuration: 0.35, bounce: 0, delay: 0.1 }}
      style={{ width: width || undefined }}
      className="absolute left-0 top-0 p-6 sm:p-7"
    >
      {children}
    </motion.div>
  );
}

function ErrorLine({ error, center }: { error: string | null; center?: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {error && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={cn("overflow-hidden pt-3 text-[13px] text-[#d6342b]", center && "text-center")}
        >
          {error}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
