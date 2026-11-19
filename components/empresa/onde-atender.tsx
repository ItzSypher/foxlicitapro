"use client";

import { useEffect, useMemo, useState } from "react";
import { Interruptor } from "@/components/ui/interruptor";
import {
  REGIOES_METROPOLITANAS,
  municipiosDoAtalho,
  nomeDoMunicipioConhecido,
  normalizarAreas,
  type Areas,
} from "@/core/areas";
import { UFS, ufDoCodigoIbge } from "@/core/ufs";
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

interface MunicipioLista {
  codigo: string;
  nome: string;
}

const CAMPO = "h-10 rounded-control border border-control bg-raised px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand lg:h-8";

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function lerLista(corpo: unknown): MunicipioLista[] {
  if (!Array.isArray(corpo)) return [];
  return corpo.flatMap((item): MunicipioLista[] => {
    if (typeof item !== "object" || item === null) return [];
    const { codigo, nome } = item as Record<string, unknown>;
    return typeof codigo === "string" && typeof nome === "string" ? [{ codigo, nome }] : [];
  });
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
  const [listas, setListas] = useState<Record<string, MunicipioLista[]>>({});
  const [ufBusca, setUfBusca] = useState<string>(areas.base.uf || areas.ufs[0] || "RJ");
  const [busca, setBusca] = useState("");
  const [erroLista, setErroLista] = useState(false);

  const chaveUfs = useMemo(() => {
    const siglas = new Set<string>([ufBusca]);
    for (const m of areas.municipiosIbge) {
      const uf = ufDoCodigoIbge(m);
      if (uf) siglas.add(uf.sigla);
    }
    return [...siglas].sort().join(",");
  }, [ufBusca, areas.municipiosIbge]);

  useEffect(() => {
    let cancelado = false;
    for (const sigla of chaveUfs.split(",")) {
      if (listas[sigla]) continue;
      fetch(`/api/ibge/municipios?uf=${sigla}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
        .then((corpo: unknown) => {
          if (cancelado) return;
          setErroLista(false);
          setListas((atual) => ({ ...atual, [sigla]: lerLista(corpo) }));
        })
        .catch(() => {
          if (!cancelado) setErroLista(true);
        });
    }
    return () => {
      cancelado = true;
    };
  }, [chaveUfs, listas]);

  function nomeDe(codigo: string): string {
    const uf = ufDoCodigoIbge(codigo);
    const achado = uf ? listas[uf.sigla]?.find((m) => m.codigo === codigo)?.nome : undefined;
    const nome = achado ?? nomeDoMunicipioConhecido(codigo) ?? codigo;
    return uf ? `${nome}/${uf.sigla}` : nome;
  }

  const termo = semAcento(busca);
  const resultados =
    termo.length < 2
      ? []
      : (listas[ufBusca] ?? []).filter((m) => semAcento(m.nome).includes(termo) && !areas.municipiosIbge.includes(m.codigo)).slice(0, 8);

  function adicionarMunicipio(codigo: string) {
    onAreas(comBase(normalizarAreas({ ...areas, municipiosIbge: [...areas.municipiosIbge, codigo] })));
    setBusca("");
  }

  function removerMunicipio(codigo: string) {
    const base = areas.base.municipioIbge === codigo ? { ...areas.base, municipioIbge: null } : areas.base;
    onAreas(normalizarAreas({ ...areas, municipiosIbge: areas.municipiosIbge.filter((m) => m !== codigo), base }));
  }

  function escolherBase(codigo: string) {
    if (codigo === "") {
      onAreas({ ...areas, base: { ...areas.base, municipioIbge: null } });
      return;
    }
    onAreas(normalizarAreas({ ...areas, base: { uf: areas.base.uf, municipioIbge: codigo } }));
  }

  const opcoesBase = [...new Set([...areas.municipiosIbge, ...(areas.base.municipioIbge ? [areas.base.municipioIbge] : [])])];

  return (
    <section data-tour="empresa-onde" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
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
        <h3 className="text-sm font-medium text-ink">Município avulso</h3>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Estado do município" value={ufBusca} onChange={(e) => setUfBusca(e.target.value)} className={CAMPO}>
            {UFS.map((uf) => (
              <option key={uf.sigla} value={uf.sigla}>
                {uf.sigla}
              </option>
            ))}
          </select>
          <input
            type="search"
            aria-label="Buscar município pelo nome"
            placeholder="Digite o nome do município"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className={cn(CAMPO, "min-w-0 flex-1")}
          />
        </div>
        {erroLista ? <p className="text-xs text-negative">Não foi possível carregar os municípios agora.</p> : null}
        {resultados.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Resultados da busca">
            {resultados.map((m) => (
              <li key={m.codigo}>
                <button type="button" onClick={() => adicionarMunicipio(m.codigo)} className={classeChip(false)}>
                  + {m.nome}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {areas.municipiosIbge.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Municípios marcados">
            {areas.municipiosIbge.map((codigo) => (
              <li key={codigo}>
                <button type="button" onClick={() => removerMunicipio(codigo)} aria-label={`Remover ${nomeDe(codigo)}`} className={classeChip(true)}>
                  {nomeDe(codigo)} <span aria-hidden="true" className="ml-1.5">×</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-ink">Município-base</h3>
        <p className="text-xs text-muted-foreground">
          Atual: <span className="font-medium text-ink">{areas.base.municipioIbge ? nomeDe(areas.base.municipioIbge) : "nenhum escolhido"}</span>
        </p>
        <select aria-label="Município-base" value={areas.base.municipioIbge ?? ""} onChange={(e) => escolherBase(e.target.value)} className={cn(CAMPO, "max-w-sm")}>
          <option value="">Nenhum</option>
          {opcoesBase.map((codigo) => (
            <option key={codigo} value={codigo}>
              {nomeDe(codigo)}
            </option>
          ))}
        </select>
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
