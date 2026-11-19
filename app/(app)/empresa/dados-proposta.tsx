"use client";

import { useState, useTransition } from "react";
import { CLASSE_CAMPO } from "@/components/empresa/editor-perfil";
import { salvarDadosPropostaAction } from "./actions";
import { AssinaturaCampo } from "./assinatura-campo";

interface Props {
  responsavel: string | null;
  representanteCpf: string | null;
  representanteRg: string | null;
  dadosBancarios: string | null;
  assinatura: string | null;
}

export function DadosProposta(inicial: Props) {
  const [responsavel, setResponsavel] = useState(inicial.responsavel ?? "");
  const [cpf, setCpf] = useState(inicial.representanteCpf ?? "");
  const [rg, setRg] = useState(inicial.representanteRg ?? "");
  const [banco, setBanco] = useState(inicial.dadosBancarios ?? "");
  const [assinatura, setAssinatura] = useState<string | null>(inicial.assinatura);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();

  function salvar() {
    setAviso(null);
    iniciar(async () => {
      const r = await salvarDadosPropostaAction({
        responsavel: responsavel.trim() || null,
        representanteCpf: cpf.trim() || null,
        representanteRg: rg.trim() || null,
        dadosBancarios: banco.trim() || null,
        assinatura,
      });
      setAviso(r.ok ? { ok: true, texto: "Dados da proposta salvos." } : { ok: false, texto: r.erro });
    });
  }

  return (
    <section data-tour="empresa-proposta" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-ink">Dados da proposta</h2>
        <p className="text-[13px] text-muted-foreground">
          Saem em toda proposta nova. A imagem da assinatura não substitui a assinatura digital do gov.br.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="representante-nome" className="text-sm font-medium text-ink">
          Representante legal
        </label>
        <input id="representante-nome" value={responsavel} maxLength={120} onChange={(e) => setResponsavel(e.target.value)} className={CLASSE_CAMPO} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="representante-cpf" className="text-sm font-medium text-ink">
            CPF
          </label>
          <input id="representante-cpf" value={cpf} maxLength={30} onChange={(e) => setCpf(e.target.value)} className={CLASSE_CAMPO} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="representante-rg" className="text-sm font-medium text-ink">
            RG
          </label>
          <input id="representante-rg" value={rg} maxLength={30} onChange={(e) => setRg(e.target.value)} className={CLASSE_CAMPO} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="dados-bancarios" className="text-sm font-medium text-ink">
          Dados bancários
        </label>
        <textarea
          id="dados-bancarios"
          value={banco}
          maxLength={500}
          rows={3}
          placeholder="Banco, agência, conta e titular"
          onChange={(e) => setBanco(e.target.value)}
          className={`${CLASSE_CAMPO} h-auto py-2`}
        />
      </div>

      <AssinaturaCampo valor={assinatura} aoMudar={setAssinatura} />

      {aviso ? (
        <p role={aviso.ok ? "status" : "alert"} className={aviso.ok ? "text-sm text-positive" : "text-sm text-negative"}>
          {aviso.texto}
        </p>
      ) : null}
      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="h-11 w-full cursor-pointer rounded-control bg-brand-fill px-4 text-base font-medium text-black outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-wait disabled:opacity-60 sm:w-fit"
      >
        {salvando ? "Salvando…" : "Salvar dados da proposta"}
      </button>
    </section>
  );
}
