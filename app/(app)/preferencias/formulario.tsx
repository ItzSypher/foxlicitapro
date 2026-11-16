"use client";

import { useState, useTransition } from "react";
import { formatarNumeroBR, parseNumeroBR } from "@/components/calculadora/numero";
import { Interruptor } from "@/components/ui/interruptor";
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
  const [excecoesPregao, setExcecoesPregao] = useState<string[]>(inicial.excecoesPregao);
  const [resumoAtivo, setResumoAtivo] = useState(inicial.resumoAtivo);
  const [capital, setCapital] = useState(inicial.capitalMaximo === null ? "" : formatarNumeroBR(inicial.capitalMaximo));
  const [dias, setDias] = useState(inicial.diasMaximosParado === null ? "" : String(inicial.diasMaximosParado));
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [erroCapital, setErroCapital] = useState<string | null>(null);
  const [erroDias, setErroDias] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();
  const somenteLeitura = !podeEditar;

  function salvar() {
    setAviso(null);
    setErroCapital(null);
    setErroDias(null);
    const capitalMaximo = parseNumeroBR(capital);
    const diasMaximosParado = parseNumeroBR(dias);
    if (Number.isNaN(capitalMaximo) || (capitalMaximo !== null && capitalMaximo < 0)) {
      setErroCapital("Digite um valor em reais, como 5000.");
      return;
    }
    if (Number.isNaN(diasMaximosParado) || (diasMaximosParado !== null && (diasMaximosParado < 0 || !Number.isInteger(diasMaximosParado)))) {
      setErroDias("Digite um número inteiro de dias, como 45.");
      return;
    }
    iniciar(async () => {
      const resultado = await salvarPreferenciasAction({
        termosPrioritarios: prioritarios,
        termosBloqueadosParaVoce: bloqueados,
        emailsResumo: emails,
        resumoAtivo,
        capitalMaximo,
        diasMaximosParado,
        excecoesPregao,
      });
      if (!resultado.ok) {
        setAviso({ tom: "erro", texto: resultado.erro });
        return;
      }
      setPrioritarios(resultado.preferencias.termosPrioritarios);
      setBloqueados(resultado.preferencias.termosBloqueadosParaVoce);
      setEmails(resultado.preferencias.emailsResumo);
      setExcecoesPregao(resultado.preferencias.excecoesPregao);
      setResumoAtivo(resultado.preferencias.resumoAtivo);
      setCapital(resultado.preferencias.capitalMaximo === null ? "" : formatarNumeroBR(resultado.preferencias.capitalMaximo));
      setDias(resultado.preferencias.diasMaximosParado === null ? "" : String(resultado.preferencias.diasMaximosParado));
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
        titulo="Pregão: exceções que valem a pena"
        ajuda="Pregão fica fora do foco atual. O conselheiro só recomenda um pregão quando o objeto tem um destes termos."
        valores={excecoesPregao}
        onChange={setExcecoesPregao}
        somenteLeitura={somenteLeitura}
        placeholder="Ex.: suporte gerenciado"
        vazio="Nenhuma exceção: todo pregão fica fora do foco."
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

      <section className="rounded-card border border-border bg-surface px-4 py-3">
        <Interruptor
          rotulo={<span className="text-base font-semibold">Receber resumo diário</span>}
          descricao="Desligado, ninguém recebe o e-mail, mesmo com endereços na lista."
          checked={resumoAtivo}
          disabled={somenteLeitura}
          onChange={(e) => setResumoAtivo(e.currentTarget.checked)}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4" aria-labelledby="titulo-caixa">
        <div>
          <h2 id="titulo-caixa" className="text-base font-semibold text-ink">
            Limites de caixa
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Licitação que pedir mais que isso recebe o alerta “Pede mais caixa do que você definiu” e perde um pouco de nota. Vazio = sem limite.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Capital máximo por licitação (R$)
            <input
              type="text"
              inputMode="decimal"
              value={capital}
              onChange={(e) => {
                setCapital(e.target.value);
                setErroCapital(null);
              }}
              aria-invalid={erroCapital !== null}
              aria-describedby={erroCapital ? "erro-capital" : undefined}
              disabled={somenteLeitura}
              placeholder="Ex.: 5000"
              className="h-11 w-full min-w-0 rounded-control border border-control bg-raised px-3 text-base tabular-nums text-ink outline-none placeholder:text-faint focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 aria-invalid:border-negative disabled:opacity-60"
            />
            {erroCapital ? (
              <span id="erro-capital" role="alert" className="text-[13px] font-normal text-negative">
                {erroCapital}
              </span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Dias máximos com dinheiro parado
            <input
              type="text"
              inputMode="numeric"
              value={dias}
              onChange={(e) => {
                setDias(e.target.value);
                setErroDias(null);
              }}
              aria-invalid={erroDias !== null}
              aria-describedby={erroDias ? "erro-dias" : undefined}
              disabled={somenteLeitura}
              placeholder="Ex.: 45"
              className="h-11 w-full min-w-0 rounded-control border border-control bg-raised px-3 text-base tabular-nums text-ink outline-none placeholder:text-faint focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 aria-invalid:border-negative disabled:opacity-60"
            />
            {erroDias ? (
              <span id="erro-dias" role="alert" className="text-[13px] font-normal text-negative">
                {erroDias}
              </span>
            ) : null}
          </label>
        </div>
      </section>

      {somenteLeitura ? null : (
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex flex-col gap-2 border-t border-border bg-ground px-4 py-3 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
          {aviso ? (
            <p
              role={aviso.tom === "erro" ? "alert" : "status"}
              className={cn("text-sm", aviso.tom === "erro" ? "text-negative" : "text-positive")}
            >
              {aviso.texto}
            </p>
          ) : null}
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-control bg-brand-fill px-5 text-sm font-semibold text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-wait disabled:opacity-60 md:w-auto md:self-start"
          >
            {salvando ? "Salvando…" : "Salvar preferências"}
          </button>
        </div>
      )}
    </div>
  );
}
