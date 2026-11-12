"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Pilula } from "@/components/radar/pilula";
import { CONTROLE } from "@/components/propostas/campos";
import type { Usuario } from "@/core/types-equipe";
import { adicionarPessoaAction, alternarAtivoAction, redefinirSenhaAction, type EstadoAdicionar } from "./actions";
import { SenhaUnica } from "./senha-unica";

const ESTADO_INICIAL: EstadoAdicionar = { erro: null, senha: null, nome: null, email: null };

const BOTAO =
  "inline-flex h-11 items-center justify-center rounded-control border border-control bg-raised px-3 text-sm text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50";

function FormAdicionar() {
  const [estado, acao, pendente] = useActionState(adicionarPessoaAction, ESTADO_INICIAL);
  const [fechadoPara, setFechadoPara] = useState<string | null>(null);
  const mostrarSenha = estado.senha !== null && fechadoPara !== estado.senha;

  return (
    <section aria-labelledby="titulo-adicionar" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <h2 id="titulo-adicionar" className="text-base font-semibold text-ink">
        Adicionar pessoa
      </h2>
      {mostrarSenha && estado.senha ? (
        <SenhaUnica
          titulo={`Senha de ${estado.nome ?? "nova pessoa"} (${estado.email ?? ""})`}
          senha={estado.senha}
          aoFechar={() => setFechadoPara(estado.senha)}
        />
      ) : (
        <form action={acao} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nome-pessoa" className="text-[13px] font-medium text-ink">
              Nome
            </label>
            <input id="nome-pessoa" name="nome" type="text" required maxLength={100} autoComplete="off" className={CONTROLE} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email-pessoa" className="text-[13px] font-medium text-ink">
              E-mail
            </label>
            <input
              id="email-pessoa"
              name="email"
              type="email"
              required
              maxLength={200}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className={CONTROLE}
            />
          </div>
          <p className="text-[13px] text-muted-foreground">Papel: gestor. A senha inicial é gerada e aparece uma vez.</p>
          {estado.erro ? (
            <p role="alert" className="text-[13px] text-negative">
              {estado.erro}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pendente}
            className="inline-flex h-11 w-full items-center justify-center rounded-control bg-brand-fill px-4 text-sm font-medium text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 sm:w-fit"
          >
            {pendente ? "Adicionando…" : "Adicionar pessoa"}
          </button>
        </form>
      )}
    </section>
  );
}

function LinhaPessoa({ usuario, ehVoce }: { usuario: Usuario; ehVoce: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [senha, setSenha] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function redefinir() {
    setErro(null);
    iniciar(async () => {
      const r = await redefinirSenhaAction(usuario.id);
      if (r.ok) setSenha(r.senha);
      else setErro(r.erro);
    });
  }

  function alternar() {
    setErro(null);
    iniciar(async () => {
      const r = await alternarAtivoAction(usuario.id, !usuario.ativo);
      if (!r.ok) setErro(r.erro);
    });
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-sm font-medium text-ink">
            {usuario.nome}
            {ehVoce ? " (você)" : ""}
          </p>
          <p className="truncate text-[13px] text-muted-foreground">{usuario.email}</p>
        </div>
        <span className="flex items-center gap-2">
          <Pilula tom="neutro">{usuario.papel === "dono" ? "Dono" : "Gestor"}</Pilula>
          <Pilula tom={usuario.ativo ? "positivo" : "negativo"}>{usuario.ativo ? "Ativo" : "Desativado"}</Pilula>
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={redefinir} disabled={pendente} className={BOTAO}>
          Redefinir senha
        </button>
        {!ehVoce ? (
          <button type="button" onClick={alternar} disabled={pendente} className={BOTAO}>
            {usuario.ativo ? "Desativar" : "Reativar"}
          </button>
        ) : null}
      </div>
      {senha ? <SenhaUnica titulo={`Nova senha de ${usuario.nome}`} senha={senha} aoFechar={() => setSenha(null)} /> : null}
      {erro ? (
        <p role="alert" className="text-[13px] text-negative">
          {erro}
        </p>
      ) : null}
    </li>
  );
}

export function ListaEquipe({ usuarios, usuarioId }: { usuarios: Usuario[]; usuarioId: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">
        {usuarios.map((u) => (
          <LinhaPessoa key={u.id} usuario={u} ehVoce={u.id === usuarioId} />
        ))}
      </ul>
      <FormAdicionar />
      <Link
        href="/equipe/conta"
        className="inline-flex h-11 w-fit items-center text-sm font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
      >
        Minha conta e troca de senha
      </Link>
    </div>
  );
}
