"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CLASSE_CAMPO, EditorCnaes, SeletorRegioes } from "@/components/empresa/editor-perfil";
import type { EmpresaConsultada } from "@/core/brasilapi";
import { ROTULO_PORTE, type CnaePerfil, type Porte } from "@/core/perfil";
import type { Regiao } from "@/core/types";
import { consultarCnpjAction, criarEmpresaAction, definirEmpresaAtivaAction } from "./actions";

export interface LinhaEmpresa {
  id: string;
  cnpj: string;
  nome: string;
  porte: Porte;
  local: string;
  ativa: boolean;
  usuarios: number;
}

const BOTAO =
  "h-11 cursor-pointer rounded-control bg-brand-fill px-4 text-base font-medium text-black outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60";
const BOTAO_SECUNDARIO =
  "h-11 cursor-pointer rounded-control border border-control px-4 text-sm text-ink outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60";

export function PainelEmpresas({ empresas, empresaAtualId }: { empresas: LinhaEmpresa[]; empresaAtualId: string }) {
  const roteador = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function alternar(e: LinhaEmpresa) {
    setErro(null);
    iniciar(async () => {
      const r = await definirEmpresaAtivaAction(e.id, !e.ativa);
      if (!r.ok) setErro(r.erro);
      else roteador.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {erro ? (
        <p role="alert" className="text-sm text-ink">
          {erro}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {empresas.map((e) => (
          <li key={e.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium text-ink">
                {e.nome}
                {!e.ativa ? <span className="ml-2 text-xs text-muted-foreground">desativada</span> : null}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {e.cnpj} · {ROTULO_PORTE[e.porte]} · {e.local} · {e.usuarios} {e.usuarios === 1 ? "pessoa" : "pessoas"}
              </p>
            </div>
            {e.id === empresaAtualId ? (
              <span className="text-xs text-muted-foreground">Sua empresa</span>
            ) : (
              <button type="button" disabled={pendente} onClick={() => alternar(e)} className={BOTAO_SECUNDARIO}>
                {e.ativa ? "Desativar" : "Ativar"}
              </button>
            )}
          </li>
        ))}
      </ul>
      <NovaEmpresa aoCriar={() => roteador.refresh()} />
    </div>
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
        <button type="button" disabled={ocupado || cnpj.trim() === ""} onClick={consultar} className={`${BOTAO} shrink-0`}>
          {ocupado && !consultada ? "Consultando..." : "Consultar"}
        </button>
      </div>

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
          <button type="button" disabled={ocupado} onClick={criar} className={`${BOTAO} sm:w-fit`}>
            {ocupado ? "Criando..." : "Criar empresa"}
          </button>
        </div>
      ) : null}

      {aviso ? (
        <p role={aviso.ok ? "status" : "alert"} className={aviso.ok ? "text-sm text-brand" : "text-sm text-ink"}>
          {aviso.texto}
        </p>
      ) : null}
    </section>
  );
}
