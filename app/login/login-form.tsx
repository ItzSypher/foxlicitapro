"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { entrar, type EstadoLogin } from "./actions";

const ESTADO_INICIAL: EstadoLogin = { erro: null };

const CAMPO =
  "h-11 w-full rounded-control border border-control bg-surface px-3 text-base text-ink outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand md:text-sm";

export function LoginForm() {
  const [estado, acao, pendente] = useActionState(entrar, ESTADO_INICIAL);
  const descricao = estado.erro ? "erro-login" : undefined;

  return (
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
          aria-invalid={estado.erro ? true : undefined}
          className={CAMPO}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="senha" className="text-sm font-medium text-ink">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={estado.erro ? true : undefined}
          aria-describedby={descricao}
          className={CAMPO}
        />
        {estado.erro ? (
          <p id="erro-login" role="alert" className="text-sm text-negative">
            {estado.erro}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pendente} className="h-11 w-full rounded-control text-sm">
        {pendente ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
