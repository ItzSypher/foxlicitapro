import { CNAES_POR_FRENTE, type CodigoCnae } from "./empresa";
import type { Frente } from "./types";

/**
 * Termos que aparecem em objetos de licitação, por CNAE.
 * Em minúsculas e sem acento. Os termos ficam no singular: o casamento aceita
 * plural simples ("computadores", "toners") em cada palavra. Evite palavras
 * soltas ambíguas ("servico", "material", "rede", "papel", "tomada").
 */
export const PALAVRAS_CHAVE: Readonly<Record<CodigoCnae, readonly string[]>> = {
  // Serviços
  "95.11-8-00": [
    "manutencao de computador",
    "manutencao de microcomputador",
    "manutencao de notebook",
    "manutencao de impressora",
    "manutencao de equipamento de informatica",
    "manutencao de equipamento de tecnologia da informacao",
    "manutencao preventiva de computador",
    "manutencao corretiva de computador",
    "manutencao de periferico",
    "manutencao de nobreak",
    "manutencao de scanner",
    "assistencia tecnica de informatica",
    "assistencia tecnica em informatica",
    "suporte tecnico de informatica",
    "suporte tecnico em informatica",
    "reparo de computador",
    "conserto de computador",
    "recarga de cartucho",
    "suporte de ti",
    "suporte tecnico de ti",
    "suporte tecnico em ti",
    "suporte de tecnologia da informacao",
    "suporte gerenciado",
    "servico de ti",
    "servico de tecnologia da informacao",
    "servico de informatica",
    "empresa especializada em informatica",
    "empresa especializada em tecnologia da informacao",
    "infraestrutura de tic",
    "outsourcing de impressao",
    "locacao de equipamento de informatica",
    "locacao de computador",
    "locacao de impressora",
    "service desk",
    "help desk",
  ],
  "43.21-5-00": [
    "instalacao eletrica",
    "instalacoes eletricas",
    "manutencao eletrica",
    "manutencao de instalacao eletrica",
    "manutencao de instalacoes eletricas",
    "rede eletrica",
    "quadro eletrico",
    "quadro de distribuicao",
    "cftv",
    "circuito fechado de televisao",
    "camera de seguranca",
    "camera de monitoramento",
    "videomonitoramento",
    "sistema de alarme",
    "cerca eletrica",
    "controle de acesso",
    "instalacao de interfone",
  ],
  "61.90-6-99": [
    "cabeamento estruturado",
    "rede estruturada",
    "rede de dados",
    "rede logica",
    "rede de computador",
    "rede wifi",
    "rede wi fi",
    "rede sem fio",
    "infraestrutura de rede",
    "ponto de rede",
    "certificacao de cabeamento",
    "patch panel",
    "fibra optica",
    "link dedicado",
    "link de internet",
    "acesso a internet",
    "provedor de internet",
    "roteador",
    "software",
    "licenca de software",
    "licenca de sistema",
    "licenca de uso",
    "aquisicao de licenca",
    "contratacao de licenca",
    "desenvolvimento de software",
    "desenvolvimento de sistema",
    "desenvolvimento de aplicativo",
    "locacao de software",
    "locacao de sistema",
    "implantacao de sistema",
    "sistema informatizado",
    "sistema de informacao",
    "sistema de gestao",
    "sistema integrado de gestao",
    "aplicativo",
    "solucao de ti",
    "solucao de tecnologia da informacao",
    "hospedagem de site",
    "computacao em nuvem",
    "seguranca da informacao",
    "google workspace",
    "microsoft 365",
    "office 365",
    "antivirus",
  ],
  "85.99-6-03": [
    "treinamento em informatica",
    "treinamento de informatica",
    "curso de informatica",
    "aula de informatica",
    "oficina de informatica",
    "capacitacao em informatica",
    "capacitacao em tecnologia da informacao",
    "inclusao digital",
    "letramento digital",
    "curso de excel",
    "treinamento em excel",
    "capacitacao em excel",
    "curso de word",
    "curso de pacote office",
    "treinamento em power bi",
    "curso de power bi",
  ],
  "82.19-9-99": [
    "apoio administrativo",
    "servico de apoio administrativo",
    "preparacao de documento",
    "digitacao de dado",
    "servico de digitacao",
    "digitacao de documento",
    "digitalizacao de documento",
    "digitalizacao de arquivo",
    "digitalizacao de processo",
    "transcricao de documento",
    "fotocopia",
    "reprografia",
    "servico de reprografia",
    "servico de copia reprografica",
  ],
  "58.19-1-00": [
    "edicao de cadastro",
    "edicao de lista",
    "edicao de catalogo",
    "edicao de guia",
    "edicao de manual",
    "edicao de cartilha",
    "elaboracao de cadastro",
    "elaboracao de catalogo",
    "elaboracao de cartilha",
    "atualizacao de cadastro",
    "recadastramento",
    "lista telefonica",
    "mala direta",
    "diagramacao",
    "diagramacao de publicacao",
  ],

  // Produtos
  "47.51-2-01": [
    "toner",
    "cartucho de toner",
    "cartucho de tinta",
    "cartucho de impressora",
    "refil de tinta",
    "tinta para impressora",
    "impressora multifuncional",
    "impressora laser",
    "notebook",
    "microcomputador",
    "computador desktop",
    "equipamento de informatica",
    "suprimento de informatica",
    "material de informatica",
    "nobreak",
    "estabilizador de tensao",
    "pen drive",
    "memoria ram",
    "ssd",
    "hd externo",
    "licenca de software",
    "antivirus",
  ],
  "47.52-1-00": [
    "aparelho telefonico",
    "telefone sem fio",
    "telefone ip",
    "telefone celular",
    "aparelho celular",
    "smartphone",
    "radio comunicador",
    "radio transmissor",
    "central telefonica",
    "pabx",
    "headset telefonico",
    "carregador de celular",
    "capa para celular",
    "cabo de rede",
    "cabo utp",
    "conector rj45",
  ],
  "47.42-3-00": [
    "material eletrico",
    "lampada",
    "luminaria",
    "reator eletronico",
    "disjuntor",
    "tomada eletrica",
    "interruptor",
    "cabo eletrico",
    "fio eletrico",
    "cabo flexivel",
    "extensao eletrica",
    "eletroduto",
    "fita isolante",
    "refletor led",
    "painel led",
    "filtro de linha",
  ],
  "47.53-9-00": [
    "eletrodomestico",
    "geladeira",
    "refrigerador",
    "freezer",
    "bebedouro",
    "ventilador",
    "aparelho de ar condicionado",
    "ar condicionado split",
    "micro ondas",
    "fogao",
    "liquidificador",
    "cafeteira",
    "televisor",
    "smart tv",
    "tv led",
    "caixa de som",
    "projetor multimidia",
    "microfone",
    "aspirador de po",
    "purificador de agua",
  ],
  "47.89-0-07": [
    "material de escritorio",
    "material de expediente",
    "suprimento de escritorio",
    "mobiliario de escritorio",
    "cadeira de escritorio",
    "cadeira giratoria",
    "mesa de escritorio",
    "armario de aco",
    "arquivo de aco",
    "gaveteiro",
    "grampeador",
    "perfurador de papel",
    "calculadora",
    "papel a4",
    "papel sulfite",
    "resma de papel",
    "pasta suspensa",
    "fita adesiva",
  ],
  "47.44-0-01": [
    "ferragem",
    "ferramenta manual",
    "ferramenta eletrica",
    "furadeira",
    "parafusadeira",
    "chave de fenda",
    "chave inglesa",
    "alicate",
    "martelo",
    "trena",
    "parafuso",
    "cadeado",
    "fechadura",
    "dobradica",
    "esmerilhadeira",
    "caixa de ferramenta",
    "kit de ferramenta",
  ],
  "47.57-1-00": [
    "peca para eletroeletronico",
    "peca de reposicao para informatica",
    "peca de reposicao para equipamento de informatica",
    "componente eletronico",
    "placa eletronica",
    "placa mae",
    "fonte de alimentacao",
    "fonte atx",
    "fonte para notebook",
    "carregador de notebook",
    "bateria de notebook",
    "tela de notebook",
    "teclado para notebook",
    "display lcd",
    "capacitor",
    "resistor",
    "circuito integrado",
  ],
  "47.41-5-00": [
    "tinta acrilica",
    "tinta latex",
    "tinta esmalte",
    "tinta para parede",
    "tinta para piso",
    "tinta spray",
    "tinta epoxi",
    "tinta pva",
    "tinta para pintura",
    "tinta de demarcacao viaria",
    "material de pintura",
    "material para pintura",
    "verniz",
    "massa corrida",
    "massa acrilica",
    "selador",
    "thinner",
    "aguarras",
    "rolo de la para pintura",
    "trincha",
  ],
  "47.89-0-05": [
    "produto de limpeza",
    "material de limpeza",
    "saneante",
    "desinfetante",
    "detergente",
    "agua sanitaria",
    "hipoclorito de sodio",
    "sabao em po",
    "sabonete liquido",
    "alcool em gel",
    "alcool 70",
    "papel higienico",
    "papel toalha",
    "saco de lixo",
    "esponja de limpeza",
    "limpa vidro",
    "desengordurante",
    "vassoura",
    "rodo",
    "pano de chao",
  ],
  "47.89-0-99": [
    "embalagem",
    "embalagem descartavel",
    "sacola plastica",
    "saco plastico",
    "copo descartavel",
    "prato descartavel",
    "talher descartavel",
    "descartavel",
    "caixa de papelao",
    "filme plastico",
    "fita de embalagem",
    "marmitex",
    "brinde",
    "brinde personalizado",
    "ecobag",
    "caneca",
    "squeeze",
    "garrafa termica",
    "pote plastico",
    "caixa organizadora",
  ],
};

/**
 * Termos inequívocos da atividade: um só deles basta para o casamento valer 30 pontos.
 * Os demais (fracos) precisam de um segundo termo do mesmo CNAE para chegar a 30.
 * Cada termo daqui precisa existir em PALAVRAS_CHAVE do mesmo CNAE.
 */
export const TERMOS_FORTES: Readonly<Record<CodigoCnae, readonly string[]>> = {
  "95.11-8-00": [
    "manutencao de computador",
    "manutencao de microcomputador",
    "manutencao de notebook",
    "manutencao de impressora",
    "manutencao de equipamento de informatica",
    "manutencao de equipamento de tecnologia da informacao",
    "manutencao preventiva de computador",
    "manutencao corretiva de computador",
    "manutencao de nobreak",
    "assistencia tecnica de informatica",
    "assistencia tecnica em informatica",
    "reparo de computador",
    "conserto de computador",
    "recarga de cartucho",
    "suporte de ti",
    "suporte tecnico de ti",
    "suporte tecnico em ti",
    "suporte de tecnologia da informacao",
    "suporte gerenciado",
    "servico de ti",
    "servico de tecnologia da informacao",
    "servico de informatica",
    "empresa especializada em informatica",
    "empresa especializada em tecnologia da informacao",
    "infraestrutura de tic",
    "outsourcing de impressao",
    "locacao de equipamento de informatica",
    "locacao de computador",
    "locacao de impressora",
    "service desk",
    "help desk",
  ],
  "43.21-5-00": [
    "cftv",
    "circuito fechado de televisao",
    "camera de seguranca",
    "camera de monitoramento",
    "videomonitoramento",
    "sistema de alarme",
    "cerca eletrica",
    "instalacao de interfone",
    "quadro de distribuicao",
  ],
  "61.90-6-99": [
    "cabeamento estruturado",
    "rede estruturada",
    "rede de dados",
    "rede logica",
    "rede wifi",
    "rede wi fi",
    "ponto de rede",
    "certificacao de cabeamento",
    "patch panel",
    "licenca de software",
    "licenca de sistema",
    "desenvolvimento de software",
    "desenvolvimento de sistema",
    "desenvolvimento de aplicativo",
    "locacao de software",
    "locacao de sistema",
    "implantacao de sistema",
    "sistema informatizado",
    "sistema de informacao",
    "solucao de ti",
    "solucao de tecnologia da informacao",
    "hospedagem de site",
    "computacao em nuvem",
    "seguranca da informacao",
    "google workspace",
    "microsoft 365",
    "office 365",
    "antivirus",
  ],
  "85.99-6-03": [
    "treinamento em informatica",
    "treinamento de informatica",
    "curso de informatica",
    "aula de informatica",
    "oficina de informatica",
    "capacitacao em informatica",
    "curso de excel",
    "treinamento em excel",
    "curso de power bi",
    "treinamento em power bi",
  ],
  "82.19-9-99": [
    "digitacao de dado",
    "servico de digitacao",
    "digitacao de documento",
    "digitalizacao de documento",
    "digitalizacao de arquivo",
    "digitalizacao de processo",
    "servico de reprografia",
    "servico de copia reprografica",
  ],
  "58.19-1-00": [
    "edicao de catalogo",
    "edicao de cartilha",
    "elaboracao de catalogo",
    "elaboracao de cartilha",
    "diagramacao de publicacao",
  ],
  "47.51-2-01": [
    "toner",
    "cartucho de toner",
    "cartucho de tinta",
    "cartucho de impressora",
    "refil de tinta",
    "tinta para impressora",
    "impressora multifuncional",
    "impressora laser",
    "notebook",
    "microcomputador",
    "nobreak",
    "estabilizador de tensao",
    "memoria ram",
    "ssd",
    "hd externo",
    "licenca de software",
    "antivirus",
  ],
  "47.52-1-00": [
    "aparelho telefonico",
    "telefone ip",
    "telefone celular",
    "aparelho celular",
    "smartphone",
    "central telefonica",
    "pabx",
    "headset telefonico",
    "cabo utp",
    "cabo de rede",
    "conector rj45",
  ],
  "47.42-3-00": [
    "material eletrico",
    "lampada",
    "luminaria",
    "reator eletronico",
    "disjuntor",
    "eletroduto",
    "refletor led",
    "painel led",
    "filtro de linha",
  ],
  "47.53-9-00": [
    "eletrodomestico",
    "geladeira",
    "refrigerador",
    "freezer",
    "bebedouro",
    "aparelho de ar condicionado",
    "ar condicionado split",
    "micro ondas",
    "televisor",
    "smart tv",
    "tv led",
    "projetor multimidia",
    "purificador de agua",
  ],
  "47.89-0-07": [
    "material de escritorio",
    "material de expediente",
    "suprimento de escritorio",
    "mobiliario de escritorio",
    "cadeira de escritorio",
    "mesa de escritorio",
    "armario de aco",
    "gaveteiro",
    "grampeador",
    "papel a4",
    "papel sulfite",
    "resma de papel",
  ],
  "47.44-0-01": [
    "ferragem",
    "ferramenta manual",
    "ferramenta eletrica",
    "furadeira",
    "parafusadeira",
    "esmerilhadeira",
    "caixa de ferramenta",
    "kit de ferramenta",
  ],
  "47.57-1-00": [
    "peca para eletroeletronico",
    "peca de reposicao para informatica",
    "peca de reposicao para equipamento de informatica",
    "componente eletronico",
    "placa mae",
    "fonte atx",
    "fonte para notebook",
    "carregador de notebook",
    "bateria de notebook",
    "tela de notebook",
    "teclado para notebook",
  ],
  "47.41-5-00": [
    "tinta acrilica",
    "tinta latex",
    "tinta esmalte",
    "tinta para parede",
    "tinta para piso",
    "tinta spray",
    "tinta epoxi",
    "tinta pva",
    "tinta para pintura",
    "tinta de demarcacao viaria",
    "material de pintura",
    "material para pintura",
  ],
  "47.89-0-05": [
    "produto de limpeza",
    "material de limpeza",
    "saneante",
    "desinfetante",
    "detergente",
    "agua sanitaria",
    "hipoclorito de sodio",
    "sabao em po",
    "sabonete liquido",
    "alcool em gel",
    "alcool 70",
    "papel higienico",
    "papel toalha",
    "saco de lixo",
    "limpa vidro",
    "desengordurante",
  ],
  "47.89-0-99": [
    "embalagem descartavel",
    "sacola plastica",
    "saco plastico",
    "copo descartavel",
    "prato descartavel",
    "talher descartavel",
    "caixa de papelao",
    "filme plastico",
    "fita de embalagem",
    "marmitex",
  ],
};

/** Termo negativo: texto simples ou lista de textos que precisam aparecer todos juntos. */
type Negativo = string | readonly string[];

/**
 * Termos que anulam o casamento de qualquer CNAE quando aparecem no objeto.
 * Casam por prefixo de palavra ("odontologic" pega odontológico e odontológica).
 */
const NEGATIVOS_GERAIS: readonly Negativo[] = [
  "media tensao",
  "alta tensao",
  "subestac",
  "hospitalar",
  "odontologic",
  "elevador",
  "transporte escolar",
  "banda larga",
  "servico telefonico",
  ["engenharia", "obra"],
  ["predial", "obra"],
];

/** Nestas atividades, objeto de veículo é outro mercado (baterias, lâmpadas, rádios, som automotivo). */
const NEGATIVOS_VEICULO: readonly Negativo[] = ["veiculo", "automotiv"];

/**
 * "Sistema" também é ar condicionado, incêndio, viário, hidráulico e consultoria de norma ISO:
 * nesses casos o objeto não é software.
 */
const NEGATIVOS_SISTEMA_NAO_TI: readonly Negativo[] = [
  "ar condicionado",
  "climatizacao",
  "incendio",
  "viario",
  "hidraulic",
  "sanitari",
  "esgoto",
  "drenagem",
  "impermeabilizacao",
  "suspensao",
  "abnt nbr iso",
  "cadeia de suprimento",
];

const NEGATIVOS_POR_CNAE: Readonly<Partial<Record<CodigoCnae, readonly Negativo[]>>> = {
  "61.90-6-99": NEGATIVOS_SISTEMA_NAO_TI,
  "43.21-5-00": [...NEGATIVOS_VEICULO, "iluminacao publica", "rede de distribuicao"],
  "47.52-1-00": NEGATIVOS_VEICULO,
  "47.42-3-00": NEGATIVOS_VEICULO,
  "47.53-9-00": NEGATIVOS_VEICULO,
  "47.57-1-00": NEGATIVOS_VEICULO,
};

/** Minúsculas, sem acento, só letras e dígitos separados por um espaço. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Diretoria de Sistemas de Informação", "Superintendência de Sistemas": é o setor do órgão, não o objeto. */
const SETOR_DE_SISTEMAS =
  /(?<![a-z0-9])(?:diretoria|departamento|coordenacao|gerencia|divisao|setor|superintendencia|secretaria|subsecretaria|assessoria|centro|nucleo|unidade) (?:de |do |da |dos |das )?(?:sistemas?|tecnologia da informacao|informatica)(?: de informacao| e \w+)?/g;

/** Tira do texto já normalizado os nomes de setor que citam sistemas ou tecnologia. */
export function removerSetorDeSistemas(textoNormalizado: string): string {
  return textoNormalizado.replace(SETOR_DE_SISTEMAS, " ");
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Monta a expressão de um termo: limite de palavra nas pontas e plural simples
 * ("s" ou "es") em palavras com 4 letras ou mais.
 */
export function regexDoTermo(termo: string): RegExp {
  const palavras = normalizarTexto(termo)
    .split(" ")
    .map((p) => (p.length >= 4 ? `${escaparRegex(p)}(?:e?s)?` : escaparRegex(p)));
  return new RegExp(`(?<![a-z0-9])${palavras.join(" ")}(?![a-z0-9])`);
}

/** Termo negativo: limite de palavra só no começo, para aceitar flexões. */
function montarRegexPrefixo(termo: string): RegExp {
  return new RegExp(`(?<![a-z0-9])${escaparRegex(normalizarTexto(termo))}`);
}

interface TermoCompilado {
  termo: string;
  regex: RegExp;
  forte: boolean;
}

const TERMOS_POR_CNAE: ReadonlyMap<string, readonly TermoCompilado[]> = new Map(
  Object.entries(PALAVRAS_CHAVE).map(([codigo, termos]) => {
    const fortes = new Set<string>(TERMOS_FORTES[codigo as CodigoCnae]);
    return [codigo, termos.map((termo) => ({ termo, regex: regexDoTermo(termo), forte: fortes.has(termo) }))];
  }),
);

const NEGATIVOS_COMPILADOS: ReadonlyMap<string, readonly (readonly RegExp[])[]> = new Map(
  Object.keys(PALAVRAS_CHAVE).map((codigo) => {
    const lista = [...NEGATIVOS_GERAIS, ...(NEGATIVOS_POR_CNAE[codigo as CodigoCnae] ?? [])];
    return [codigo, lista.map((n) => (typeof n === "string" ? [n] : n).map(montarRegexPrefixo))];
  }),
);

/** Como um CNAE casou com o objeto. */
export interface CasamentoCnae {
  codigo: string;
  /** Termos distintos que casaram (um termo contido em outro mais longo não conta em dobro) */
  termos: string[];
  /** true quando algum termo casado é inequívoco da atividade */
  forte: boolean;
}

export type CasamentosPorFrente = Record<Frente, CasamentoCnae[]>;

function casarUm(texto: string, codigo: string): CasamentoCnae | null {
  const compilados = TERMOS_POR_CNAE.get(codigo) ?? [];
  const casados = compilados.filter((t) => t.regex.test(texto));
  if (casados.length === 0) return null;
  const anulado = (NEGATIVOS_COMPILADOS.get(codigo) ?? []).some((exigidos) =>
    exigidos.every((re) => re.test(texto)),
  );
  if (anulado) return null;
  const distintos = casados
    .map((t) => t.termo)
    .filter((termo) => !casados.some((outro) => outro.termo !== termo && outro.termo.includes(termo)));
  return { codigo, termos: distintos, forte: casados.some((t) => t.forte) };
}

/** Casamentos por frente, com a força de cada um: quantos termos e se há termo forte. */
export function casarCnaesComForca(objeto: string): CasamentosPorFrente {
  const texto = removerSetorDeSistemas(normalizarTexto(objeto));
  const resultado: CasamentosPorFrente = { servicos: [], produtos: [] };
  for (const frente of ["servicos", "produtos"] as const) {
    for (const cnae of CNAES_POR_FRENTE[frente]) {
      const casamento = casarUm(texto, cnae.codigo);
      if (casamento) resultado[frente].push(casamento);
    }
  }
  return resultado;
}

export type CnaesCasados = Record<Frente, string[]>;

/** Devolve os códigos CNAE cujos termos aparecem no objeto, separados por frente. */
export function casarCnaes(objeto: string): CnaesCasados {
  const detalhado = casarCnaesComForca(objeto);
  return {
    servicos: detalhado.servicos.map((c) => c.codigo),
    produtos: detalhado.produtos.map((c) => c.codigo),
  };
}
