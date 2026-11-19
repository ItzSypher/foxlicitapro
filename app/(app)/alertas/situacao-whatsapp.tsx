import { Pilula } from "@/components/radar/pilula";
import { ROTULO_PAPEL } from "@/core/permissoes";
import {
  EXPLICACAO_CONVERSA,
  dataHoraCurta,
  rotuloStatusAviso,
  rotuloTipoAviso,
  situacaoDaConversa,
  textoUltimoResumo,
} from "@/core/whatsapp-situacao";
import type { AvisoRecente, VinculoWa } from "@/db/whatsapp";

const ROTULOS_PAPEL: Readonly<Record<string, string>> = ROTULO_PAPEL;

function tomDoStatus(status: string): "positivo" | "negativo" | "neutro" {
  if (status === "enviado") return "positivo";
  if (status === "descartado") return "negativo";
  return "neutro";
}

/** Por que alguém não recebeu o resumo das 7h: último resumo, estado da conversa e últimos avisos da empresa. */
export function SituacaoWhatsapp({
  pessoas,
  ultimosResumos,
  avisos,
  agora,
}: {
  pessoas: ReadonlyArray<VinculoWa>;
  ultimosResumos: ReadonlyMap<string, string>;
  avisos: ReadonlyArray<AvisoRecente>;
  agora: Date;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-ink">Situação do WhatsApp</h2>
        <p className="text-[13px] text-muted-foreground">Veja quem está recebendo o resumo das 7h e quem precisa responder para voltar a receber.</p>
      </div>

      {pessoas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ninguém da equipe ligou o WhatsApp ainda.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {pessoas.map((p) => {
            const conversa = situacaoDaConversa(p.ultimaEntrada, agora);
            const fechada = p.avisoWhatsapp && !conversa.aberta;
            return (
              <li key={p.usuarioId} className="flex min-w-0 flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 break-words text-sm font-medium text-ink">{p.nome}</span>
                  <Pilula tom="neutro">{ROTULOS_PAPEL[p.papel] ?? p.papel}</Pilula>
                  {!p.avisoWhatsapp ? <Pilula tom="aviso">Pausado</Pilula> : null}
                </div>
                <p className="text-[13px] text-muted-foreground">{textoUltimoResumo(ultimosResumos.get(p.usuarioId) ?? null, agora)}</p>
                <p className="text-[13px] text-ink">
                  <span className="text-muted-foreground">Conversa: </span>
                  {conversa.texto}
                </p>
                {fechada ? <p className="text-[13px] text-muted-foreground">{EXPLICACAO_CONVERSA}</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <h3 className="text-sm font-semibold text-ink">Últimos avisos</h3>
        {avisos.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nenhum aviso ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {avisos.map((a) => (
              <li key={a.id} className="flex min-w-0 flex-col gap-1 text-[13px] sm:flex-row sm:items-center sm:gap-3">
                <span className="shrink-0 text-muted-foreground">{dataHoraCurta(a.quando)}</span>
                <span className="min-w-0 flex-1 break-words text-ink">
                  {rotuloTipoAviso(a.tipo)} para {a.usuarioNome}
                </span>
                <span className="shrink-0">
                  <Pilula tom={tomDoStatus(a.status)}>{rotuloStatusAviso(a.status)}</Pilula>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
