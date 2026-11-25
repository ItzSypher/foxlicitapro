import { Search } from "lucide-react";
import { ROTULO_CURTO_TIPO_ACERVO, TIPOS_ACERVO, rotuloArea, type TipoAcervo } from "@/core/acervo";
import { CONTROLE } from "@/components/fornecedores/estilo";
import { Segmentado, type OpcaoSegmentada } from "@/components/ui/segmentado";

interface Props {
  tipo: TipoAcervo | null;
  area: string | null;
  busca: string;
  /** Áreas que aparecem em algum documento */
  areas: readonly string[];
  /** Quantos documentos há de cada tipo, sem filtro */
  porTipo: Readonly<Record<TipoAcervo, number>>;
  total: number;
}

function endereco(tipo: TipoAcervo | null, area: string | null, busca: string): string {
  const p = new URLSearchParams();
  if (tipo !== null) p.set("tipo", tipo);
  if (area !== null) p.set("area", area);
  if (busca !== "") p.set("q", busca);
  const texto = p.toString();
  return texto === "" ? "/acervo" : `/acervo?${texto}`;
}

/** Busca por texto e filtros por tipo e área. Tudo na URL: o servidor filtra e o link pode ser compartilhado. */
export function FiltrosAcervo({ tipo, area, busca, areas, porTipo, total }: Props) {
  const opcoesTipo: OpcaoSegmentada<string>[] = [
    { valor: "todos", rotulo: "Todos", contagem: total, href: endereco(null, area, busca) },
    ...TIPOS_ACERVO.filter((t) => porTipo[t] > 0 || t === tipo).map((t) => ({
      valor: t,
      rotulo: ROTULO_CURTO_TIPO_ACERVO[t],
      contagem: porTipo[t],
      href: endereco(t, area, busca),
    })),
  ];
  const opcoesArea: OpcaoSegmentada<string>[] = [
    { valor: "todas", rotulo: "Todas as áreas", href: endereco(tipo, null, busca) },
    ...areas.map((a) => ({ valor: a, rotulo: rotuloArea(a), href: endereco(tipo, a, busca) })),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <form role="search" action="/acervo" className="relative">
        {tipo !== null ? <input type="hidden" name="tipo" value={tipo} /> : null}
        {area !== null ? <input type="hidden" name="area" value={area} /> : null}
        <label htmlFor="busca-acervo" className="sr-only">
          Buscar no acervo
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
        <input
          id="busca-acervo"
          name="q"
          type="search"
          defaultValue={busca}
          maxLength={100}
          placeholder="Buscar por título, emissor ou o que comprova"
          autoComplete="off"
          className={`${CONTROLE} pl-9`}
        />
      </form>
      <Segmentado rotulo="Filtrar por tipo" valor={tipo ?? "todos"} opcoes={opcoesTipo} rolavel />
      {areas.length > 0 ? <Segmentado rotulo="Filtrar por área" valor={area ?? "todas"} opcoes={opcoesArea} rolavel /> : null}
    </div>
  );
}
