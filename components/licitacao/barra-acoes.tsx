import Link from "next/link";
import { Calculator, ExternalLink, FilePlus2 } from "lucide-react";
import { BotaoAssistente } from "@/components/licitacao/botao-assistente";
import { BotaoSalvarPipeline } from "@/components/pipeline/botao-salvar";
import type { OportunidadeComScore } from "@/core/types";
import type { ChaveCompra } from "@/core/types-detalhe";
import { assistenteDisponivel } from "@/lib/gemini";

const SECUNDARIO =
  "inline-flex h-11 items-center justify-center gap-2 rounded-control border border-control bg-transparent px-4 text-sm font-medium whitespace-nowrap text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand md:h-9";

const PRIMARIO =
  "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-control bg-brand-fill px-4 text-sm font-semibold whitespace-nowrap text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground md:h-9 lg:flex-none";

interface Props {
  chave: ChaveCompra;
  numeroControle: string;
  linkPncp: string;
  linkOrigem: string | null;
  /** null quando faltam dados para montar a oportunidade; some o botão de salvar */
  oportunidade: OportunidadeComScore | null;
  salvo: boolean;
}

function Secundarias({ numeroControle, linkPncp, linkOrigem, salvo }: Pick<Props, "numeroControle" | "linkPncp" | "linkOrigem" | "salvo">) {
  return (
    <>
      {salvo ? (
        <Link href={`/calculadora?item=${encodeURIComponent(numeroControle)}`} className={SECUNDARIO}>
          <Calculator aria-hidden="true" className="size-4" />
          Cotar
        </Link>
      ) : null}
      <a href={linkPncp} target="_blank" rel="noopener noreferrer" className={SECUNDARIO}>
        Abrir no PNCP
        <ExternalLink aria-hidden="true" className="size-4" />
      </a>
      {linkOrigem ? (
        <a href={linkOrigem} target="_blank" rel="noopener noreferrer" className={SECUNDARIO}>
          Sistema de origem
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      ) : null}
    </>
  );
}

/**
 * Telefone: "Criar proposta" e "Salvar" ficam numa barra fixa acima da navegação inferior;
 * Cotar, PNCP e sistema de origem vêm numa linha na página. Desktop: tudo numa linha só.
 */
export function BarraAcoes({ chave, numeroControle, linkPncp, linkOrigem, oportunidade, salvo }: Props) {
  const compra = `${chave.cnpj}-${chave.ano}-${chave.sequencial}`;
  // Sem chave configurada o botão não existe e a barra fica como sempre foi.
  const assistente = assistenteDisponivel();
  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex items-start gap-2 border-t border-border bg-ground px-4 py-2 lg:static lg:z-auto lg:flex-wrap lg:items-center lg:border-t-0 lg:p-0">
        <Link href={`/propostas/nova?compra=${compra}`} className={PRIMARIO}>
          <FilePlus2 aria-hidden="true" className="size-4" />
          Criar proposta
        </Link>
        {assistente ? (
          <div className="hidden lg:block">
            <BotaoAssistente compra={compra} />
          </div>
        ) : null}
        {oportunidade ? <BotaoSalvarPipeline item={oportunidade} salvo={salvo} /> : null}
        <div className="hidden lg:contents">
          <Secundarias numeroControle={numeroControle} linkPncp={linkPncp} linkOrigem={linkOrigem} salvo={salvo} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 lg:hidden">
        {assistente ? <BotaoAssistente compra={compra} /> : null}
        <Secundarias numeroControle={numeroControle} linkPncp={linkPncp} linkOrigem={linkOrigem} salvo={salvo} />
      </div>
    </>
  );
}
