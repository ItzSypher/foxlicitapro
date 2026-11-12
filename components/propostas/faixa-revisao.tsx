import { Pilula } from "@/components/radar/pilula";
import { PilulaStatus, dataHoraCurta } from "@/components/propostas/status";
import { estaAprovada } from "@/core/revisao";
import type { AutorProposta, StatusPropostaEquipe } from "@/core/types-equipe";

export interface DadosFaixa {
  status: StatusPropostaEquipe;
  autor: AutorProposta;
  criadoPorNome: string | null;
  revisadoPorNome: string | null;
  revisaoNota: string | null;
  revisadoEm: string | null;
}

/** Faixa no alto da proposta: status, quem criou, quem revisou e a nota do revisor. */
export function FaixaRevisao({ dados }: { dados: DadosFaixa }) {
  const { status } = dados;
  const mostraRevisor =
    dados.revisadoPorNome !== null && (status === "devolvida" || estaAprovada(status) || status === "enviada");
  const verbo = status === "devolvida" ? "Devolvida" : "Aprovada";
  const mostraNota = status === "devolvida" && dados.revisaoNota !== null && dados.revisaoNota.trim() !== "";

  return (
    <section aria-label="Situação da proposta" className="flex flex-col gap-2 rounded-card border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <PilulaStatus status={status} />
        {dados.autor === "assistente" ? <Pilula tom="neutro">Criada pelo assistente</Pilula> : null}
        <p className="text-[13px] text-muted-foreground">
          {dados.criadoPorNome ? `Criada por ${dados.criadoPorNome}` : "Criador não registrado"}
        </p>
        {mostraRevisor ? (
          <p className="text-[13px] text-muted-foreground">
            {status === "enviada" ? "Revisada" : verbo} por {dados.revisadoPorNome}
            {dados.revisadoEm ? ` em ${dataHoraCurta(dados.revisadoEm)}` : ""}
          </p>
        ) : null}
        {status === "em_revisao" ? (
          <p className="text-[13px] text-muted-foreground">Aguardando revisão.</p>
        ) : null}
      </div>
      {mostraNota ? (
        <blockquote className="border-l-2 border-brand-fill pl-3 text-sm leading-snug whitespace-pre-line text-ink">
          {dados.revisaoNota}
        </blockquote>
      ) : null}
    </section>
  );
}
