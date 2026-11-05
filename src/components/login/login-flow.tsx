"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { OtpInput, type OtpStatus } from "@/components/ui/otp-input";
import { PEOPLE, type PersonId } from "@/lib/people";
import { cn } from "@/lib/utils";

type Step = "idle" | "choose" | "code";

const MORPH = { type: "spring", visualDuration: 0.55, bounce: 0.18 } as const;
const GLASS =
  "border border-white/60 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,15,30,0.06),0_24px_60px_-20px_rgba(15,15,30,0.28)] backdrop-blur-2xl backdrop-saturate-150";

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
  const otpRef = useRef<HTMLDivElement>(null);
  const focusFirstSlot = () =>
    requestAnimationFrame(() => otpRef.current?.querySelector<HTMLInputElement>("input")?.focus());

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode(id: PersonId) {
    setPerson(id);
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Une erreur est survenue.");
        if (res.status === 429 && step === "code") setCooldown(30);
        return;
      }
      setSentTo(json.sentTo ?? []);
      setCode("");
      setStatus("idle");
      setCooldown(30);
      setStep("code");
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau.");
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

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <Backdrop />

      <div className="relative flex w-full max-w-[400px] flex-col items-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ type: "spring", visualDuration: 0.6, bounce: 0.1 }}
          className="mb-8 text-center"
        >
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-mute">Espace privé</p>
          <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.03em] text-ink">SCI Pialgo</h1>
        </motion.div>

        <LayoutGroup>
          {step === "idle" ? (
            <motion.button
              layoutId="glass"
              type="button"
              onClick={() => setStep("choose")}
              transition={reduce ? { duration: 0 } : MORPH}
              whileTap={reduce ? undefined : { scale: 0.96 }}
              style={{ borderRadius: 999 }}
              className="relative h-14 bg-ink px-9 text-[16px] font-medium text-white shadow-[0_1px_2px_rgba(15,15,30,0.2),0_12px_30px_-10px_rgba(15,15,30,0.5)] outline-none focus-visible:ring-2 focus-visible:ring-[#868593]/50 focus-visible:ring-offset-2"
            >
              <motion.span layout="position" initial={false} exit={{ opacity: 0 }}>
                Se connecter
              </motion.span>
            </motion.button>
          ) : (
            <motion.div
              layoutId="glass"
              transition={reduce ? { duration: 0 } : MORPH}
              style={{ borderRadius: 32 }}
              className={cn("relative w-full overflow-hidden", GLASS)}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {step === "choose" ? (
                  <Panel key="choose" reduce={!!reduce}>
                    <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">Qui êtes-vous ?</h2>
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
                            initial={reduce ? false : { opacity: 0, y: 8, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            transition={{ type: "spring", visualDuration: 0.4, bounce: 0.15, delay: 0.12 + i * 0.05 }}
                            whileTap={reduce ? undefined : { scale: 0.96 }}
                            className={cn(
                              "relative flex h-[60px] items-center justify-between rounded-[18px] border px-4 text-left text-[16px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#868593]/50",
                              selected
                                ? "border-ink bg-ink text-white"
                                : "border-white/70 bg-white/55 text-ink hover:bg-white/80",
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
                                    selected ? "border-white bg-white" : "border-[#868593]/50",
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
                ) : (
                  <Panel key="code" reduce={!!reduce}>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("choose");
                        setError(null);
                        setPerson(null);
                      }}
                      className="-ml-1 mb-3 inline-flex items-center gap-1 rounded-full px-1 py-0.5 text-[13px] font-medium text-mute outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-[#868593]/50"
                    >
                      <ArrowLeft className="size-3.5" /> Changer de personne
                    </button>
                    <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">Bonjour {name}</h2>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
                      Saisissez le code envoyé à <span className="font-medium text-ink">{sentTo.join(" et ")}</span>
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
                        slotClassName="bg-white/70 dark:bg-white/70 sm:size-16 sm:text-2xl"
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
                          className="rounded-full px-2 py-0.5 font-medium text-mute outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-[#868593]/50 disabled:cursor-default disabled:hover:text-mute"
                        >
                          {sending ? "Envoi…" : cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : "Renvoyer le code"}
                        </button>
                      )}
                    </div>
                    <ErrorLine error={error} center />
                  </Panel>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </LayoutGroup>
      </div>

      <p className="absolute inset-x-0 bottom-4 text-center text-[11px] text-mute/80">
        Saisie du code :{" "}
        <a href="https://www.rareui.com" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-ink">
          Rare UI
        </a>
      </p>
    </div>
  );
}

function Panel({ children, reduce }: { children: React.ReactNode; reduce: boolean }) {
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(8px)" }}
      transition={{ type: "spring", visualDuration: 0.4, bounce: 0.12, delay: 0.08 }}
      className="p-6 sm:p-7"
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

function Backdrop() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 -z-0 bg-canvas">
      <div className="blob absolute -left-[15%] top-[8%] size-[60vmax] rounded-full bg-[radial-gradient(circle,#D9D2FF_0%,transparent_65%)]" />
      <div
        className="blob absolute -right-[20%] top-[30%] size-[55vmax] rounded-full bg-[radial-gradient(circle,#FFD9CC_0%,transparent_65%)]"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="blob absolute bottom-[-25%] left-[15%] size-[50vmax] rounded-full bg-[radial-gradient(circle,#CFE8FF_0%,transparent_65%)]"
        style={{ animationDelay: "-12s" }}
      />
    </div>
  );
}
