"use client";

import { useState, useTransition } from "react";
import { CLASSE_CAMPO, EditorCnaes } from "@/components/empresa/editor-perfil";
import { OndeAtender } from "@/components/empresa/onde-atender";
import type { Areas } from "@/core/areas";
import type { CnaePerfil } from "@/core/perfil";
import { salvarEmpresaAction } from "./actions";

interface Props {
  nomeFantasia: string | null;
  cnaes: CnaePerfil[];
  areas: Areas;
  radarTudoDoRamo: boolean;
}

export function FormularioEmpresa(inicial: Props) {
  const [nome, setNome] = useState(inicial.nomeFantasia ?? "");
  const [cnaes, setCnaes] = useState(inicial.cnaes);
  const [areas, setAreas] = useState(inicial.areas);
  const [tudoDoRamo, setTudoDoRamo] = useState(inicial.radarTudoDoRamo);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();

  function salvar() {
    setAviso(null);
    iniciar(async () => {
      const r = await salvarEmpresaAction({ nomeFantasia: nome.trim() || null, cnaes, areas, radarTudoDoRamo: tudoDoRamo });
      setAviso(r.ok ? { ok: true, texto: "Dados da empresa salvos." } : { ok: false, texto: r.erro });
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
        <label htmlFor="nome-fantasia" className="text-base font-semibold text-ink">
          Nome fantasia
        </label>
        <input id="nome-fantasia" value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} className={CLASSE_CAMPO} />
      </section>

      <section data-tour="empresa-ramo" className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-ink">Atividades (CNAE) e frentes</h2>
        <p className="text-[13px] text-muted-foreground">A frente define em qual aba do Radar e da Calculadora a atividade entra.</p>
        <EditorCnaes cnaes={cnaes} onChange={setCnaes} />
      </section>

      <OndeAtender areas={areas} onAreas={setAreas} tudoDoRamo={tudoDoRamo} onTudoDoRamo={setTudoDoRamo} />

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex flex-col gap-2 border-t border-border bg-ground px-4 py-3 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
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
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
