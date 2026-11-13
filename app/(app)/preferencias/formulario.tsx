"use client";

import { useState, useTransition } from "react";
import type { Preferencias } from "@/core/types-equipe";
import { cn } from "@/lib/utils";
import { salvarPreferenciasAction } from "./actions";
import { ListaChips } from "./lista-chips";

interface Props {
  inicial: Preferencias;
  podeEditar: boolean;
}

type Aviso = { tom: "ok" | "erro"; texto: string };

export function FormularioPreferencias({ inicial, podeEditar }: Props) {
  const [prioritarios, setPrioritarios] = useState<string[]>(inicial.termosPrioritarios);
  const [bloqueados, setBloqueados] = useState<string[]>(inicial.termosBloqueadosParaVoce);
  const [emails, setEmails] = useState<string[]>(inicial.emailsResumo);
  const [resumoAtivo, setResumoAtivo] = useState(inicial.resumoAtivo);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [salvando, iniciar] = useTransition();
  const somenteLeitura = !podeEditar;

  function salvar() {
    setAviso(null);
    iniciar(async () => {
      const resultado = await salvarPreferenciasAction({
        termosPrioritarios: prioritarios,
        termosBloqueadosParaVoce: bloqueados,
        emailsResumo: emails,
        resumoAtivo,
      });
      if (!resultado.ok) {
        setAviso({ tom: "erro", texto: resultado.erro });
        return;
      }
      setPrioritarios(resultado.preferencias.termosPrioritarios);
      setBloqueados(resultado.preferencias.termosBloqueadosParaVoce);
      setEmails(resultado.preferencias.emailsResumo);
      setResumoAtivo(resultado.preferencias.resumoAtivo);
      setAviso({ tom: "ok", texto: "Preferências salvas. O Radar já usa os novos termos." });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {somenteLeitura ? (
        <p className="rounded-card border border-border bg-raised p-3 text-sm text-ink">
          Você pode ver, mas não pode alterar as preferências.
        </p>
      ) : null}

      <ListaChips
        titulo="Priorizar no Para você"
        ajuda="Oportunidades com estes termos aparecem primeiro na aba Para você."
        valores={prioritarios}
        onChange={setPrioritarios}
        somenteLeitura={somenteLeitura}
        placeholder="Ex.: software, suporte de ti"
        vazio="Nenhum termo. A ordem segue só a nota."
      />

      <ListaChips
        titulo="Nunca sugerir no Para você"
        ajuda="Oportunidades com estes termos saem da aba Para você, mas continuam na aba Todas."
        valores={bloqueados}
        onChange={setBloqueados}
        somenteLeitura={somenteLeitura}
        placeholder="Ex.: cftv, câmera"
        vazio="Nenhum termo bloqueado."
      />

      <ListaChips
        titulo="E-mails do resumo diário"
        ajuda="Estes endereços recebem, todo dia, as melhores oportunidades abertas."
        valores={emails}
        onChange={setEmails}
        somenteLeitura={somenteLeitura}
        placeholder="nome@empresa.com.br"
        tipo="email"
        vazio="Nenhum e-mail cadastrado."
      />

      <section className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface p-4">
        <div className="min-w-0">
          <h2 id="titulo-resumo" className="text-base font-semibold text-ink">
            Receber resumo diário
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Desligado, ninguém recebe o e-mail, mesmo com endereços na lista.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={resumoAtivo}
          aria-labelledby="titulo-resumo"
          disabled={somenteLeitura}
          onClick={() => setResumoAtivo((atual) => !atual)}
          className="inline-flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex h-7 w-12 items-center rounded-full border p-0.5 transition-colors",
              resumoAtivo ? "border-transparent bg-brand-fill" : "border-control bg-raised",
            )}
          >
            <span
              className={cn(
                "size-5 rounded-full transition-transform duration-150",
                resumoAtivo ? "translate-x-5 bg-black" : "translate-x-0 bg-muted-foreground",
              )}
            />
          </span>
          <span className="sr-only">{resumoAtivo ? "Ligado" : "Desligado"}</span>
        </button>
      </section>

      {somenteLeitura ? null : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="inline-flex h-11 cursor-pointer items-center justify-center rounded-control bg-brand-fill px-5 text-sm font-semibold text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-wait disabled:opacity-60 md:self-start"
          >
            {salvando ? "Salvando..." : "Salvar preferências"}
          </button>
          {aviso ? (
            <p
              role={aviso.tom === "erro" ? "alert" : "status"}
              className={cn("text-sm", aviso.tom === "erro" ? "text-negative" : "text-positive")}
            >
              {aviso.texto}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
