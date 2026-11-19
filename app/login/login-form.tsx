"use client";

import { useActionState, useEffect, useState, type KeyboardEvent } from "react";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { CircleAlert, Eye, EyeOff, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { entrar, type EstadoLogin } from "./actions";

const ESTADO_INICIAL: EstadoLogin = { erro: null };

const CAMPO =
  "h-11 w-full rounded-control border border-control bg-surface px-3 text-base text-ink outline-none transition-colors placeholder:text-faint focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand";

const TREMIDA = [0, -8, 8, -6, 6, -3, 3, 0];

export function LoginForm() {
  const [estado, acao, pendente] = useActionState(entrar, ESTADO_INICIAL);
  const reduzir = useReducedMotion();
  const tremida = useAnimationControls();
  const [email, setEmail] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [capsLigado, setCapsLigado] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const descricao = estado.erro ? "erro-login" : undefined;

  useEffect(() => {
    if (!estado.erro || reduzir) return;
    void tremida.start({ x: TREMIDA, transition: { duration: 0.45, ease: "easeInOut" } });
  }, [estado, reduzir, tremida]);

  function lerCaps(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLigado(e.getModifierState("CapsLock"));
  }

  return (
    <motion.div
      className="w-full max-w-md"
      initial={reduzir ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <motion.div
        animate={tremida}
        className="flex flex-col gap-6 rounded-sheet border border-border bg-surface/85 p-6 shadow-2xl shadow-black/30 backdrop-blur-sm sm:p-8"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Entrar</h2>
          <p className="text-sm text-muted-foreground">Acesse sua conta para continuar.</p>
        </div>

        <form action={acao} className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium text-ink">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={estado.erro ? true : undefined}
              aria-describedby={descricao}
              className={CAMPO}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="senha" className="text-sm font-medium text-ink">
              Senha
            </label>
            <div className="relative">
              <input
                id="senha"
                name="senha"
                type={mostrar ? "text" : "password"}
                autoComplete="current-password"
                autoCapitalize="none"
                spellCheck={false}
                required
                onKeyDown={lerCaps}
                onKeyUp={lerCaps}
                onBlur={() => setCapsLigado(false)}
                aria-invalid={estado.erro ? true : undefined}
                aria-describedby={descricao}
                className={`${CAMPO} pr-12`}
              />
              <button
                type="button"
                onClick={() => setMostrar((v) => !v)}
                aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={mostrar}
                className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-control text-muted-foreground outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
              >
                {mostrar ? (
                  <EyeOff className="size-5" aria-hidden="true" />
                ) : (
                  <Eye className="size-5" aria-hidden="true" />
                )}
              </button>
            </div>
            <div aria-live="polite">
              {capsLigado ? (
                <p className="flex items-center gap-1.5 text-sm text-warning">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                  Caps Lock está ligado.
                </p>
              ) : null}
            </div>
          </div>

          {estado.erro ? (
            <p
              id="erro-login"
              role="alert"
              className="flex items-start gap-2 rounded-control border border-negative/40 bg-pill-neg-bg px-3 py-2.5 text-sm text-pill-neg-fg"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{estado.erro}</span>
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={pendente}
            aria-busy={pendente}
            className="h-11 w-full gap-2 rounded-control bg-brand-fill text-sm font-semibold text-black hover:bg-brand-fill/90 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {pendente ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Entrando…
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setAjudaAberta((v) => !v)}
            aria-expanded={ajudaAberta}
            aria-controls="ajuda-senha"
            className="self-start rounded-control text-sm text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
          >
            Esqueci minha senha
          </button>
          {ajudaAberta ? (
            <motion.p
              id="ajuda-senha"
              initial={reduzir ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-control border border-border bg-raised px-3 py-2.5 text-sm text-muted-foreground"
            >
              Fale com o administrador da sua conta para receber uma nova senha.
            </motion.p>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
