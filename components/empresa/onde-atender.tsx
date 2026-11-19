"use client";

import { Interruptor } from "@/components/ui/interruptor";
import {
  REGIOES_METROPOLITANAS,
  municipiosDoAtalho,
  normalizarAreas,
  type Areas,
} from "@/core/areas";
import { UFS } from "@/core/ufs";
import { cn } from "@/lib/utils";

interface Props {
  areas: Areas;
  onAreas: (areas: Areas) => void;
  tudoDoRamo: boolean;
  onTudoDoRamo: (valor: boolean) => void;
}

const CHIP = "inline-flex h-10 items-center rounded-full border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand lg:h-8";

function classeChip(ativo: boolean): string {
  return cn(CHIP, ativo ? "border-transparent bg-brand-fill font-medium text-black" : "border-control bg-raised text-muted-foreground hover:text-ink");
}

/** Sem estado-base escolhido, o primeiro estado marcado passa a ser a base. */
function comBase(areas: Areas): Areas {
  if (areas.base.uf !== "") return areas;
  const primeira = areas.ufs[0] ?? REGIOES_METROPOLITANAS.find((r) => areas.municipiosIbge.includes(r.capitalIbge))?.uf ?? "";
  return { ...areas, base: { uf: primeira, municipioIbge: null } };
}

/** Seção "Onde atender": estados inteiros, atalhos de capital e região metropolitana e o interruptor de "tudo do meu ramo". */
export function OndeAtender({ areas, onAreas, tudoDoRamo, onTudoDoRamo }: Props) {
  function alternarUf(sigla: string) {
    const ufs = areas.ufs.includes(sigla) ? areas.ufs.filter((u) => u !== sigla) : [...areas.ufs, sigla];
    onAreas(comBase(normalizarAreas({ ...areas, ufs })));
  }

  function atalhoAtivo(uf: string): boolean {
    const codigos = municipiosDoAtalho(uf);
    return codigos.length > 0 && codigos.every((c) => areas.municipiosIbge.includes(c));
  }

  function alternarAtalho(uf: string) {
    const codigos = municipiosDoAtalho(uf);
    const municipiosIbge = atalhoAtivo(uf)
      ? areas.municipiosIbge.filter((m) => !codigos.includes(m))
      : [...areas.municipiosIbge, ...codigos];
    onAreas(comBase(normalizarAreas({ ...areas, municipiosIbge })));
  }

  const avulsos = areas.municipiosIbge.length;

  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-ink">Onde atender</h2>
        <p className="text-[13px] text-muted-foreground">
          O Radar busca e dá nota só para estes lugares. Quanto mais perto da sua base, maior a nota de local.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-ink">Capital e região metropolitana</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Atalhos de capital e região metropolitana">
          {REGIOES_METROPOLITANAS.map((rm) => (
            <button
              key={rm.id}
              type="button"
              aria-pressed={atalhoAtivo(rm.uf)}
              onClick={() => alternarAtalho(rm.uf)}
              className={classeChip(atalhoAtivo(rm.uf))}
            >
              {rm.nome}
            </button>
          ))}
        </div>
        {avulsos > 0 ? (
          <p className="text-xs text-muted-foreground">
            {avulsos} {avulsos === 1 ? "município marcado" : "municípios marcados"}.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-ink">Estados inteiros</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Estados">
          {UFS.map((uf) => {
            const ativo = areas.ufs.includes(uf.sigla);
            return (
              <button key={uf.sigla} type="button" aria-pressed={ativo} title={uf.nome} onClick={() => alternarUf(uf.sigla)} className={classeChip(ativo)}>
                {uf.sigla}
              </button>
            );
          })}
        </div>
      </div>

      <Interruptor
        rotulo="Tudo do meu ramo"
        descricao="O Radar mostra toda oportunidade que casa com as suas atividades ou palavras-chave, mesmo com nota baixa. A nota só ordena."
        checked={tudoDoRamo}
        onChange={(e) => onTudoDoRamo(e.target.checked)}
      />
    </section>
  );
}
