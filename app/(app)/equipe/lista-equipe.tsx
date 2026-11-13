"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Pilula } from "@/components/radar/pilula";
import { CONTROLE } from "@/components/propostas/campos";
import { ROTULO_PAPEL, ROTULO_PERMISSAO } from "@/core/permissoes";
import type { Usuario } from "@/core/types-equipe";
import {
  adicionarPessoaAction,
  alternarAtivoAction,
  atualizarAcessosAction,
  redefinirSenhaAction,
  type EstadoAdicionar,
} from "./actions";
import { CamposAcesso, acessoPadrao, type ValorAcesso } from "./campos-acesso";
import { SenhaUnica } from "./senha-unica";

const ESTADO_INICIAL: EstadoAdicionar = { erro: null, senha: null, nome: null, email: null, criada: false };

const BOTAO =
  "inline-flex h-11 items-center justify-center rounded-control border border-control bg-raised px-3 text-sm text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50";

function FormAdicionar() {
  const [estado, acao, pendente] = useActionState(adicionarPessoaAction, ESTADO_INICIAL);
  const [fechadoPara, setFechadoPara] = useState<string | null>(null);
  const [acesso, setAcesso] = useState<ValorAcesso>(() => acessoPadrao("gestor"));
  const [modoSenha, setModoSenha] = useState<"gerar" | "digitar">("gerar");
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
          {estado.criada && estado.senha === null ? (
            <p role="status" className="rounded-control border border-brand px-3 py-2 text-[13px] text-ink">
              {estado.nome ?? "Pessoa"} foi adicionada. Ela já pode entrar com a senha que você digitou.
            </p>
          ) : null}
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
          <CamposAcesso prefixo="nova" valor={acesso} aoMudar={setAcesso} nomeados />
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-[13px] font-medium text-ink">Senha</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
              <input
                type="radio"
                name="modoSenha"
                value="gerar"
                checked={modoSenha === "gerar"}
                onChange={() => setModoSenha("gerar")}
                className="size-5 shrink-0 accent-brand-fill"
              />
              Gerar uma senha (aparece uma vez)
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
              <input
                type="radio"
                name="modoSenha"
                value="digitar"
                checked={modoSenha === "digitar"}
                onChange={() => setModoSenha("digitar")}
                className="size-5 shrink-0 accent-brand-fill"
              />
              Digitar a senha
            </label>
          </fieldset>
          {modoSenha === "digitar" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="senha-pessoa" className="text-[13px] font-medium text-ink">
                  Senha (mínimo 8 caracteres)
                </label>
                <input
                  id="senha-pessoa"
                  name="senha"
                  type="password"
                  required
                  minLength={8}
                  maxLength={200}
                  autoComplete="new-password"
                  className={CONTROLE}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmar-pessoa" className="text-[13px] font-medium text-ink">
                  Repita a senha
                </label>
                <input
                  id="confirmar-pessoa"
                  name="confirmar"
                  type="password"
                  required
                  minLength={8}
                  maxLength={200}
                  autoComplete="new-password"
                  className={CONTROLE}
                />
              </div>
            </>
          ) : null}
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
  const [editando, setEditando] = useState(false);
  const [acesso, setAcesso] = useState<ValorAcesso>({
    papel: usuario.papel,
    permissoes: usuario.permissoes,
    limite: usuario.limitePropostasAssistenteDia,
  });

  function salvarAcessos() {
    setErro(null);
    iniciar(async () => {
      const r = await atualizarAcessosAction(usuario.id, {
        papel: acesso.papel,
        permissoes: acesso.permissoes,
        limite: acesso.limite,
      });
      if (r.ok) setEditando(false);
      else setErro(r.erro);
    });
  }

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
          <Pilula tom="neutro">{ROTULO_PAPEL[usuario.papel]}</Pilula>
          <Pilula tom={usuario.ativo ? "positivo" : "negativo"}>{usuario.ativo ? "Ativo" : "Desativado"}</Pilula>
        </span>
      </div>
      <p className="text-[13px] leading-snug text-muted-foreground">
        {usuario.papel === "dono"
          ? "Pode tudo."
          : `${usuario.permissoes.length === 0 ? "Só consulta." : usuario.permissoes.map((p) => ROTULO_PERMISSAO[p]).join(", ") + "."} Assistente: ${usuario.limitePropostasAssistenteDia} por dia.`}
      </p>
      {editando ? (
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3">
          <CamposAcesso prefixo={`acesso-${usuario.id}`} valor={acesso} aoMudar={setAcesso} nomeados={false} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={salvarAcessos} disabled={pendente || Number.isNaN(acesso.limite)} className={BOTAO}>
              Salvar acessos
            </button>
            <button type="button" onClick={() => setEditando(false)} disabled={pendente} className={BOTAO}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setEditando((v) => !v)} disabled={pendente} className={BOTAO}>
          Editar acessos
        </button>
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
