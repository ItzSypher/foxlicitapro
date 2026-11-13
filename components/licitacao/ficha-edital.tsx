"use client";

import { useState } from "react";
import { CheckCheck, FileSearch, Loader2 } from "lucide-react";
import { confirmarFichaAction, lerEditalAction } from "@/app/(app)/licitacao/[cnpj]/[ano]/[sequencial]/ficha-actions";
import { Pilula, type TomPilula } from "@/components/radar/pilula";
import { NOME_NIVEL, calcularCapitalGiro, type NivelCapitalGiro } from "@/core/capital-giro";
import { formatarDataHoraBrasilia } from "@/core/datas-edital";
import { NAO_INFORMADO, NOME_NATUREZA, type FichaEdital, type FichaSalva } from "@/core/ficha";
import { Colapsavel } from "./colapsavel";
import { Secao } from "./secao";

const SECUNDARIO =
  "inline-flex h-11 items-center justify-center gap-2 rounded-control border border-control bg-transparent px-4 text-sm font-medium whitespace-nowrap text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 md:h-9";

const PRIMARIO =
  "inline-flex h-11 items-center justify-center gap-2 rounded-control bg-brand-fill px-4 text-sm font-semibold whitespace-nowrap text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground disabled:opacity-50 md:h-9";

const TOM_CAPITAL: Record<NivelCapitalGiro, TomPilula> = { baixo: "positivo", medio: "aviso", alto: "negativo" };

interface Props {
  /** "{cnpj}-{ano}-{sequencial}" */
  compra: string;
  inicial: FichaSalva | null;
  assistenteAtivo: boolean;
  /** tem "usar_assistente": pode ler o edital */
  podeLer: boolean;
  /** tem "revisao_juridica" ou "editar_propostas": pode confirmar a ficha */
  podeConfirmar: boolean;
}

function ehAusente(texto: string): boolean {
  return texto.trim().toLowerCase().startsWith(NAO_INFORMADO);
}

function Linha({
  rotulo,
  children,
  trecho,
  pagina,
}: {
  rotulo: string;
  children: React.ReactNode;
  trecho?: string | null;
  pagina?: number | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm leading-snug wrap-break-word text-ink">
        {children}
        {trecho ? (
          <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">
            “{trecho}”{pagina ? ` (p. ${pagina})` : ""}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function Ausente() {
  return <span className="text-muted-foreground">Não informado no edital</span>;
}

function Texto({ valor }: { valor: string }) {
  return ehAusente(valor) ? <Ausente /> : <>{valor}</>;
}

function SimNao({ valor }: { valor: boolean | null }) {
  if (valor === null) return <Ausente />;
  return <>{valor ? "Sim" : "Não"}</>;
}

function Dias({ valor }: { valor: number | null }) {
  if (valor === null) return <Ausente />;
  return <>{valor === 1 ? "1 dia" : `${valor} dias`}</>;
}

function SelosPagamento({ ficha }: { ficha: FichaEdital }) {
  const capital = calcularCapitalGiro({
    prazoEntregaDias: ficha.prazoEntregaDias.valor,
    prazoPagamentoDias: ficha.prazoPagamentoDias.valor,
    medicaoMensal: ficha.medicaoMensal.valor,
    pagamentoAntecipado: ficha.pagamentoAntecipado.valor,
  });
  const antecipado = ficha.pagamentoAntecipado.valor === true;
  const prazo = ficha.prazoPagamentoDias.valor;
  return (
    <>
      {ficha.medicaoMensal.valor === true ? <Pilula tom="positivo">Mensal</Pilula> : null}
      {prazo !== null && !antecipado ? <Pilula tom="neutro">Paga após entrega ({prazo} {prazo === 1 ? "dia" : "dias"})</Pilula> : null}
      {antecipado ? <Pilula tom="positivo">Antecipação prevista</Pilula> : null}
      {capital.nivel !== null ? (
        <Pilula tom={TOM_CAPITAL[capital.nivel]}>Capital de giro: {NOME_NIVEL[capital.nivel]}</Pilula>
      ) : (
        <Pilula tom="neutro">Capital de giro: sem estimativa</Pilula>
      )}
    </>
  );
}

function Grade({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-x-4 gap-y-4 sm:grid-cols-2">{children}</dl>;
}

function GruposDaFicha({ ficha }: { ficha: FichaEdital }) {
  const capital = calcularCapitalGiro({
    prazoEntregaDias: ficha.prazoEntregaDias.valor,
    prazoPagamentoDias: ficha.prazoPagamentoDias.valor,
    medicaoMensal: ficha.medicaoMensal.valor,
    pagamentoAntecipado: ficha.pagamentoAntecipado.valor,
  });
  const natureza = ficha.natureza.valor;
  return (
    <div className="flex flex-col gap-3">
      <Colapsavel titulo="Pagamento e caixa" aberta selos={<SelosPagamento ficha={ficha} />}>
        <Grade>
          <Linha rotulo="Capital de giro">
            <span className="block">
              {capital.nivel !== null ? `${NOME_NIVEL[capital.nivel][0].toUpperCase()}${NOME_NIVEL[capital.nivel].slice(1)}` : "Sem estimativa"}
              {capital.dias !== null ? ` · ${capital.dias} ${capital.dias === 1 ? "dia" : "dias"} com dinheiro parado` : ""}
            </span>
            <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">{capital.motivo}</span>
          </Linha>
          <Linha rotulo="Natureza" trecho={ficha.natureza.trecho} pagina={ficha.natureza.pagina}>
            {natureza === "nao-informado" ? <Ausente /> : NOME_NATUREZA[natureza]}
          </Linha>
          <Linha rotulo="Forma de pagamento" trecho={ficha.formaPagamento.trecho} pagina={ficha.formaPagamento.pagina}>
            <Texto valor={ficha.formaPagamento.valor} />
          </Linha>
          <Linha rotulo="Prazo de pagamento" trecho={ficha.prazoPagamentoDias.trecho} pagina={ficha.prazoPagamentoDias.pagina}>
            <Dias valor={ficha.prazoPagamentoDias.valor} />
          </Linha>
          <Linha rotulo="Medição mensal" trecho={ficha.medicaoMensal.trecho} pagina={ficha.medicaoMensal.pagina}>
            <SimNao valor={ficha.medicaoMensal.valor} />
          </Linha>
          <Linha rotulo="Pagamento antecipado" trecho={ficha.pagamentoAntecipado.trecho} pagina={ficha.pagamentoAntecipado.pagina}>
            <SimNao valor={ficha.pagamentoAntecipado.valor} />
            {ficha.pagamentoAntecipado.valor === true && ficha.pagamentoAntecipado.condicao ? ` · ${ficha.pagamentoAntecipado.condicao}` : ""}
          </Linha>
          <Linha rotulo="Reajuste" trecho={ficha.reajuste.trecho} pagina={ficha.reajuste.pagina}>
            <Texto valor={ficha.reajuste.valor} />
          </Linha>
        </Grade>
      </Colapsavel>

      <Colapsavel titulo="Entrega">
        <Grade>
          <Linha rotulo="Prazo de entrega" trecho={ficha.prazoEntregaDias.trecho} pagina={ficha.prazoEntregaDias.pagina}>
            <Dias valor={ficha.prazoEntregaDias.valor} />
          </Linha>
          <Linha rotulo="Local de entrega" trecho={ficha.localEntrega.trecho} pagina={ficha.localEntrega.pagina}>
            <Texto valor={ficha.localEntrega.valor} />
          </Linha>
          <Linha rotulo="Amostra ou prova de conceito" trecho={ficha.amostraProvaConceito.trecho} pagina={ficha.amostraProvaConceito.pagina}>
            <Texto valor={ficha.amostraProvaConceito.valor} />
          </Linha>
          <Linha rotulo="Visita técnica" trecho={ficha.visitaTecnica.trecho} pagina={ficha.visitaTecnica.pagina}>
            <Texto valor={ficha.visitaTecnica.valor} />
          </Linha>
        </Grade>
      </Colapsavel>

      <Colapsavel titulo="Exigências">
        <Grade>
          <Linha rotulo="Critério de julgamento" trecho={ficha.criterioJulgamento.trecho} pagina={ficha.criterioJulgamento.pagina}>
            <Texto valor={ficha.criterioJulgamento.valor} />
          </Linha>
          <Linha rotulo="Modo de disputa" trecho={ficha.modoDisputa.trecho} pagina={ficha.modoDisputa.pagina}>
            <Texto valor={ficha.modoDisputa.valor} />
          </Linha>
          <Linha rotulo="Exclusivo para ME/EPP" trecho={ficha.exclusividadeMeEpp.trecho} pagina={ficha.exclusividadeMeEpp.pagina}>
            <SimNao valor={ficha.exclusividadeMeEpp.valor} />
          </Linha>
          <Linha rotulo="Garantia contratual" trecho={ficha.garantiaContratualPercentual.trecho} pagina={ficha.garantiaContratualPercentual.pagina}>
            {ficha.garantiaContratualPercentual.valor === null ? (
              <Ausente />
            ) : (
              `${ficha.garantiaContratualPercentual.valor.toLocaleString("pt-BR")}% do contrato`
            )}
          </Linha>
          <div className="sm:col-span-2">
            <Linha rotulo="Multas e sanções" trecho={ficha.multasSancoes.trecho} pagina={ficha.multasSancoes.pagina}>
              <Texto valor={ficha.multasSancoes.valor} />
            </Linha>
          </div>
          <div className="sm:col-span-2">
            <Linha rotulo="Documentos de habilitação" trecho={ficha.documentosHabilitacao.trecho} pagina={ficha.documentosHabilitacao.pagina}>
              {ficha.documentosHabilitacao.valor.length === 0 ? (
                <Ausente />
              ) : (
                <ul className="flex list-disc flex-col gap-1 pl-4">
                  {ficha.documentosHabilitacao.valor.map((doc) => (
                    <li key={doc}>{doc}</li>
                  ))}
                </ul>
              )}
            </Linha>
          </div>
        </Grade>
      </Colapsavel>

      <Colapsavel titulo="Como competir">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-snug text-ink marker:text-muted-foreground">
          {ficha.comoCompetir.map((dica) => (
            <li key={dica} className="pl-1">
              {dica}
            </li>
          ))}
        </ol>
      </Colapsavel>
    </div>
  );
}

function SeloConferencia({ salva }: { salva: FichaSalva }) {
  const data = formatarDataHoraBrasilia(salva.confirmadaEm);
  if (salva.confirmadaEm === null) return <Pilula tom="aviso">Não conferida</Pilula>;
  const quem = salva.confirmadaPorNome ?? "equipe";
  return <Pilula tom="positivo">{data ? `Conferida por ${quem} em ${data}` : `Conferida por ${quem}`}</Pilula>;
}

/** Ficha do edital: lida do PDF pelo assistente, uma por edital e compartilhada. */
export function FichaEditalSecao({ compra, inicial, assistenteAtivo, podeLer, podeConfirmar }: Props) {
  const [salva, setSalva] = useState<FichaSalva | null>(inicial);
  const [ocupado, setOcupado] = useState<"lendo" | "confirmando" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function ler(regenerar: boolean) {
    setErro(null);
    setOcupado("lendo");
    try {
      const r = await lerEditalAction(compra, regenerar);
      if (r.ok) setSalva(r.ficha);
      else setErro(r.erro);
    } catch {
      setErro("Não foi possível ler o edital agora.");
    }
    setOcupado(null);
  }

  async function confirmar() {
    setErro(null);
    setOcupado("confirmando");
    try {
      const r = await confirmarFichaAction(compra);
      if (r.ok) setSalva(r.ficha);
      else setErro(r.erro);
    } catch {
      setErro("Não foi possível confirmar a ficha agora.");
    }
    setOcupado(null);
  }

  return (
    <Secao id="ficha" titulo="Ficha do edital" detalhe={salva ? <SeloConferencia salva={salva} /> : null}>
      {ocupado === "lendo" ? (
        <p role="status" className="flex items-center gap-2 rounded-card border border-border bg-surface p-4 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />
          Lendo o edital. Pode levar até 1 minuto.
        </p>
      ) : null}

      {ocupado !== "lendo" && salva === null ? (
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          {assistenteAtivo && podeLer ? (
            <>
              <p className="text-sm leading-snug text-muted-foreground">
                O assistente lê o PDF do edital e monta a ficha: pagamento, prazos, exigências e dicas para a disputa.
              </p>
              <div>
                <button type="button" onClick={() => ler(false)} className={PRIMARIO}>
                  <FileSearch aria-hidden="true" className="size-4" />
                  Ler edital
                </button>
              </div>
            </>
          ) : assistenteAtivo ? (
            <p role="status" className="text-[13px] leading-snug text-muted-foreground">
              A ficha deste edital ainda não foi gerada. Peça a quem tem acesso ao assistente para ler o edital.
            </p>
          ) : (
            <p role="status" className="text-[13px] leading-snug text-muted-foreground">
              A ficha do edital não está disponível agora: o assistente ainda não está ativado.
            </p>
          )}
        </div>
      ) : null}

      {salva !== null ? (
        <>
          <div className="flex flex-wrap gap-2">
            {salva.confirmadaEm === null && podeConfirmar ? (
              <button type="button" onClick={confirmar} disabled={ocupado !== null} className={PRIMARIO}>
                {ocupado === "confirmando" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <CheckCheck aria-hidden="true" className="size-4" />}
                Confirmar ficha
              </button>
            ) : null}
            {assistenteAtivo && podeLer ? (
              <button type="button" onClick={() => ler(true)} disabled={ocupado !== null} className={SECUNDARIO}>
                <FileSearch aria-hidden="true" className="size-4" />
                Ler de novo
              </button>
            ) : null}
          </div>
          <GruposDaFicha ficha={salva.ficha} />
        </>
      ) : null}

      {erro ? (
        <p role="alert" className="text-sm text-negative">
          {erro}
        </p>
      ) : null}
    </Secao>
  );
}
