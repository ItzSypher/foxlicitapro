"use client";

import { useRef, useState, useTransition } from "react";
import { CLASSE_CAMPO } from "@/components/empresa/editor-perfil";
import { salvarDadosPropostaAction } from "./actions";

const LIMITE_ASSINATURA_BYTES = 200 * 1024;
const TIPOS_ASSINATURA = ["image/png", "image/jpeg"];

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
  const entradaArquivo = useRef<HTMLInputElement>(null);

  function escolherArquivo(arquivo: File | undefined) {
    setAviso(null);
    if (!arquivo) return;
    if (!TIPOS_ASSINATURA.includes(arquivo.type)) {
      setAviso({ ok: false, texto: "Use uma imagem PNG ou JPEG." });
      return;
    }
    if (arquivo.size > LIMITE_ASSINATURA_BYTES) {
      setAviso({ ok: false, texto: "A imagem da assinatura passa de 200 KB. Use uma menor." });
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => {
      if (typeof leitor.result === "string") setAssinatura(leitor.result);
    };
    leitor.onerror = () => setAviso({ ok: false, texto: "Não foi possível ler a imagem." });
    leitor.readAsDataURL(arquivo);
  }

  function remover() {
    setAssinatura(null);
    if (entradaArquivo.current) entradaArquivo.current.value = "";
  }

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
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
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

      <div className="flex flex-col gap-2">
        <label htmlFor="assinatura-arquivo" className="text-sm font-medium text-ink">
          Assinatura (PNG ou JPEG, até 200 KB)
        </label>
        <input
          ref={entradaArquivo}
          id="assinatura-arquivo"
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => escolherArquivo(e.target.files?.[0])}
          className="text-sm text-ink file:mr-3 file:h-9 file:cursor-pointer file:rounded-control file:border file:border-border file:bg-surface file:px-3 file:text-sm"
        />
        {assinatura ? (
          <div className="flex flex-wrap items-end gap-3">
            {/* data URL escolhida pelo usuário: next/image não se aplica a esse tipo de origem */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assinatura} alt="Prévia da assinatura" className="h-16 max-w-[240px] rounded-control border border-border bg-white object-contain p-1" />
            <button
              type="button"
              onClick={remover}
              className="h-9 cursor-pointer rounded-control border border-border px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Remover
            </button>
          </div>
        ) : null}
      </div>

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
