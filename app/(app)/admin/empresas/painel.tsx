"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pilula } from "@/components/radar/pilula";
import { CLASSE_CAMPO, EditorCnaes, SeletorRegioes } from "@/components/empresa/editor-perfil";
import type { EmpresaConsultada } from "@/core/brasilapi";
import { PORTES, ROTULO_PORTE, type CnaePerfil, type Porte } from "@/core/perfil";
import type { Regiao } from "@/core/types";
import {
  adicionarGestorAction,
  consultarCnpjAction,
  criarEmpresaAction,
  criarEmpresaTesteAction,
  definirEmpresaAtivaAction,
  removerGestorAction,
} from "./actions";

export interface GestorLinha {
  usuarioId: string;
  nome: string;
  email: string;
}

export interface LinhaEmpresa {
  id: string;
  cnpj: string;
  nome: string;
  porte: Porte;
  local: string;
  ativa: boolean;
  teste: boolean;
  usuarios: number;
  gestores: GestorLinha[];
}

const BOTAO =
  "h-11 cursor-pointer rounded-control bg-brand-fill px-4 text-base font-medium text-black outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60";
const BOTAO_SECUNDARIO =
  "h-11 shrink-0 cursor-pointer rounded-control border border-control px-4 text-sm text-ink outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60";

export function PainelEmpresas({ empresas, empresaAtualId }: { empresas: LinhaEmpresa[]; empresaAtualId: string }) {
  const roteador = useRouter();
  const [erro, setErro] = useState<{ id: string; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const [alvo, setAlvo] = useState<string | null>(null);

  function alternar(e: LinhaEmpresa) {
    setErro(null);
    setAlvo(e.id);
    iniciar(async () => {
      const r = await definirEmpresaAtivaAction(e.id, !e.ativa);
      if (!r.ok) setErro({ id: e.id, texto: r.erro });
      else roteador.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] tabular-nums text-muted-foreground">
        {empresas.length === 1 ? "1 empresa" : `${empresas.length} empresas`}
      </p>
      <ul className="flex flex-col gap-2">
        {empresas.map((e) => (
          <li key={e.id} className="flex min-w-0 flex-col gap-2 rounded-card border border-border bg-surface p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-medium break-words text-ink">
                  {e.nome}
                  {e.teste ? <Pilula tom="neutro">Teste</Pilula> : null}
                  {!e.ativa ? <Pilula tom="negativo">Desativada</Pilula> : null}
                </p>
                <p className="text-[13px] tabular-nums break-words text-muted-foreground">
                  {e.cnpj} · {ROTULO_PORTE[e.porte]} · {e.local} · {e.usuarios} {e.usuarios === 1 ? "pessoa" : "pessoas"}
                </p>
              </div>
              {e.id === empresaAtualId ? (
                <span className="shrink-0 text-xs text-muted-foreground">Sua empresa</span>
              ) : (
                <button type="button" disabled={pendente} onClick={() => alternar(e)} className={BOTAO_SECUNDARIO}>
                  {pendente && alvo === e.id ? "Aguarde…" : e.ativa ? "Desativar" : "Ativar"}
                </button>
              )}
            </div>
            <Gestores empresaId={e.id} gestores={e.gestores} aoMudar={() => roteador.refresh()} />
            {erro && erro.id === e.id ? (
              <p role="alert" className="text-[13px] text-negative">
                {erro.texto}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <NovaEmpresa aoCriar={() => roteador.refresh()} />
      <NovaEmpresaTeste aoCriar={() => roteador.refresh()} />
    </div>
  );
}

function Gestores({ empresaId, gestores, aoMudar }: { empresaId: string; gestores: GestorLinha[]; aoMudar: () => void }) {
  const [email, setEmail] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function adicionar() {
    setAviso(null);
    iniciar(async () => {
      const r = await adicionarGestorAction({ empresaId, email });
      if (!r.ok) {
        setAviso(r.erro);
        return;
      }
      setEmail("");
      aoMudar();
    });
  }

  function remover(g: GestorLinha) {
    setAviso(null);
    iniciar(async () => {
      const r = await removerGestorAction({ empresaId, usuarioId: g.usuarioId });
      if (!r.ok) {
        setAviso(r.erro);
        return;
      }
      aoMudar();
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2">
      <h3 className="text-sm font-semibold text-ink">Gestores</h3>
      {gestores.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Ninguém de fora da equipe gerencia esta empresa.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {gestores.map((g) => (
            <li key={g.usuarioId} className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 flex-1 text-[13px] break-words text-ink">
                {g.nome} <span className="text-muted-foreground">· {g.email}</span>
              </p>
              <button type="button" disabled={ocupado} onClick={() => remover(g)} className={BOTAO_SECUNDARIO}>
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="E-mail do gestor"
          type="email"
          placeholder="E-mail de quem já tem login"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={CLASSE_CAMPO}
        />
        <button type="button" disabled={ocupado || email.trim() === ""} onClick={adicionar} className={`${BOTAO_SECUNDARIO} w-full sm:w-auto`}>
          {ocupado ? "Aguarde…" : "Adicionar gestor"}
        </button>
      </div>
      {aviso ? (
        <p role="alert" className="text-[13px] text-negative">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}

function NovaEmpresaTeste({ aoCriar }: { aoCriar: () => void }) {
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [uf, setUf] = useState("RJ");
  const [municipio, setMunicipio] = useState("");
  const [porte, setPorte] = useState<Porte>("me");
  const [regioes, setRegioes] = useState<Regiao[]>(["nova-iguacu"]);
  const [nomeDono, setNomeDono] = useState("");
  const [emailDono, setEmailDono] = useState("");
  const [senha, setSenha] = useState("");
  const [semDono, setSemDono] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();

  function criar() {
    setAviso(null);
    iniciar(async () => {
      const r = await criarEmpresaTesteAction({ cnpj, razaoSocial, uf, municipio, porte, regioes, semDono, nomeDono, emailDono, senha });
      if (!r.ok) {
        setAviso({ ok: false, texto: r.erro });
        return;
      }
      setAviso({
        ok: true,
        texto: semDono
          ? "Empresa de teste criada sem dono. Adicione quem vai gerenciá-la na seção Gestores."
          : "Empresa de teste criada. O dono já pode entrar com o e-mail e a senha informados.",
      });
      setCnpj("");
      setRazaoSocial("");
      setMunicipio("");
      setNomeDono("");
      setEmailDono("");
      setSenha("");
      aoCriar();
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4" aria-labelledby="titulo-teste">
      <h2 id="titulo-teste" className="text-base font-semibold text-ink">
        Empresa de teste (sem consulta à Receita)
      </h2>
      <div className="flex flex-col gap-2">
        <input aria-label="CNPJ de teste" inputMode="numeric" placeholder="CNPJ (14 dígitos quaisquer)" value={cnpj} onChange={(e) => setCnpj(e.target.value)} className={CLASSE_CAMPO} />
        <input aria-label="Razão social" placeholder="Razão social" value={razaoSocial} maxLength={150} onChange={(e) => setRazaoSocial(e.target.value)} className={CLASSE_CAMPO} />
        <div className="grid gap-2 sm:grid-cols-[6rem_1fr_1fr]">
          <input aria-label="UF" placeholder="UF" value={uf} maxLength={2} onChange={(e) => setUf(e.target.value)} className={CLASSE_CAMPO} />
          <input aria-label="Município" placeholder="Município" value={municipio} maxLength={100} onChange={(e) => setMunicipio(e.target.value)} className={CLASSE_CAMPO} />
          <select aria-label="Porte" value={porte} onChange={(e) => setPorte(e.target.value as Porte)} className={CLASSE_CAMPO}>
            {PORTES.map((p) => (
              <option key={p} value={p}>
                {ROTULO_PORTE[p]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-ink">Regiões de atendimento</h3>
        <SeletorRegioes regioes={regioes} onChange={setRegioes} desabilitado={ocupado} />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Primeiro dono</h3>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={semDono} onChange={(e) => setSemDono(e.target.checked)} className="size-4" />
          Criar sem dono por enquanto (o dono é adicionado depois)
        </label>
        {semDono ? null : (
          <>
            <input aria-label="Nome do dono de teste" placeholder="Nome" value={nomeDono} onChange={(e) => setNomeDono(e.target.value)} className={CLASSE_CAMPO} />
            <input aria-label="E-mail do dono de teste" type="email" placeholder="E-mail" value={emailDono} onChange={(e) => setEmailDono(e.target.value)} className={CLASSE_CAMPO} />
            <input
              aria-label="Senha do dono de teste"
              type="password"
              autoComplete="new-password"
              placeholder="Senha (mínimo 8 caracteres)"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={CLASSE_CAMPO}
            />
          </>
        )}
      </div>
      <button type="button" disabled={ocupado} onClick={criar} className={`${BOTAO} w-full sm:w-fit`}>
        {ocupado ? "Criando…" : "Criar empresa de teste"}
      </button>
      {aviso ? (
        <p role={aviso.ok ? "status" : "alert"} className={aviso.ok ? "text-sm text-positive" : "text-sm text-negative"}>
          {aviso.texto}
        </p>
      ) : null}
    </section>
  );
}

function NovaEmpresa({ aoCriar }: { aoCriar: () => void }) {
  const [cnpj, setCnpj] = useState("");
  const [consultada, setConsultada] = useState<EmpresaConsultada | null>(null);
  const [cnaes, setCnaes] = useState<CnaePerfil[]>([]);
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [nomeDono, setNomeDono] = useState("");
  const [emailDono, setEmailDono] = useState("");
  const [senha, setSenha] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();

  function consultar() {
    setAviso(null);
    iniciar(async () => {
      const r = await consultarCnpjAction(cnpj);
      if (!r.ok) {
        setConsultada(null);
        setAviso({ ok: false, texto: r.erro });
        return;
      }
      setConsultada(r.empresa);
      setCnaes(r.empresa.cnaes);
      setRegioes(r.regioes);
    });
  }

  function criar() {
    setAviso(null);
    iniciar(async () => {
      const r = await criarEmpresaAction({ cnpj, cnaes, regioes, nomeDono, emailDono, senha });
      if (!r.ok) {
        setAviso({ ok: false, texto: r.erro });
        return;
      }
      setAviso({ ok: true, texto: "Empresa criada. O dono já pode entrar com o e-mail e a senha informados." });
      setConsultada(null);
      setCnpj("");
      setNomeDono("");
      setEmailDono("");
      setSenha("");
      aoCriar();
    });
  }

  const mensagem = aviso ? (
    <p role={aviso.ok ? "status" : "alert"} className={aviso.ok ? "text-sm text-positive" : "text-sm text-negative"}>
      {aviso.texto}
    </p>
  ) : null;

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4" aria-labelledby="titulo-nova">
      <h2 id="titulo-nova" className="text-base font-semibold text-ink">
        Nova empresa
      </h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="cnpj-nova" className="sr-only">
          CNPJ
        </label>
        <input
          id="cnpj-nova"
          inputMode="numeric"
          placeholder="CNPJ (só números ou com pontos)"
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          className={CLASSE_CAMPO}
        />
        <button type="button" disabled={ocupado || cnpj.trim() === ""} onClick={consultar} className={`${BOTAO} w-full shrink-0 sm:w-auto`}>
          {ocupado && !consultada ? "Consultando…" : "Consultar"}
        </button>
      </div>
      {consultada ? null : mensagem}

      {consultada ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink">
            {consultada.razaoSocial} · {ROTULO_PORTE[consultada.porte]} · {consultada.municipio}/{consultada.uf}
          </p>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">Atividades e frentes</h3>
            <EditorCnaes cnaes={cnaes} onChange={setCnaes} desabilitado={ocupado} />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-ink">Regiões de atendimento</h3>
            <SeletorRegioes regioes={regioes} onChange={setRegioes} desabilitado={ocupado} />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">Primeiro dono</h3>
            <input aria-label="Nome do dono" placeholder="Nome" value={nomeDono} onChange={(e) => setNomeDono(e.target.value)} className={CLASSE_CAMPO} />
            <input
              aria-label="E-mail do dono"
              type="email"
              placeholder="E-mail"
              value={emailDono}
              onChange={(e) => setEmailDono(e.target.value)}
              className={CLASSE_CAMPO}
            />
            <input
              aria-label="Senha do dono"
              type="password"
              autoComplete="new-password"
              placeholder="Senha (mínimo 8 caracteres)"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={CLASSE_CAMPO}
            />
          </div>
          <button type="button" disabled={ocupado} onClick={criar} className={`${BOTAO} w-full sm:w-fit`}>
            {ocupado ? "Criando…" : "Criar empresa"}
          </button>
          {mensagem}
        </div>
      ) : null}

    </section>
  );
}
