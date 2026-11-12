/**
 * Resumo do objeto de uma contratação: tira a abertura burocrática, corta a cauda
 * ("conforme o Termo de Referência...") e arruma a caixa. Função pura.
 * O texto original continua disponível no detalhe ("Texto do edital").
 */

const MAPA_ACENTOS: Readonly<Record<string, string>> = {
  á: "a", à: "a", â: "a", ã: "a", ä: "a",
  é: "e", è: "e", ê: "e", ë: "e",
  í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ò: "o", ô: "o", õ: "o", ö: "o",
  ú: "u", ù: "u", û: "u", ü: "u",
  ç: "c", ñ: "n",
};

/** Minúsculas e sem acento, mantendo o mesmo comprimento do texto para cortar o original pelo índice. */
function dobrar(texto: string): string {
  let saida = "";
  for (const caractere of texto) {
    const minusculo = caractere.toLowerCase();
    const base = minusculo.length === caractere.length ? minusculo : caractere;
    saida += MAPA_ACENTOS[base] ?? base;
  }
  return saida;
}

const SUBSTANTIVO =
  "(?:contratacao|licitacao|dispensa|compra|aquisicao|selecao|processo|pregao|procedimento|edital|termo|ata|certame|registro|instrumento|contrato)";
const ADJETIVO =
  "(?: (?:eletronic[oa]|presencial|publica|licitatori[oa]|de referencia|srp|de precos|de licitacao|de dispensa))*";
const ARTIGO = "(?: (?:a|o|as|os|um|uma))?";
const EVENTUAL = "(?:eventual(?:\\(is\\)|is)?|futura(?:\\(s\\)|s)?)";
const FUTURO = `(?:${EVENTUAL}(?: e ${EVENTUAL})?)`;

/** Aberturas burocráticas, comparadas sobre o texto dobrado (sem acento, minúsculo). */
const ABERTURAS: ReadonlyArray<RegExp> = [
  // marcas e códigos de sistema: "[LICITANET] - ", "RSD-020116/006321/2026 - ", "Processo 12/2025 - "
  /^\[[^\]]{1,40}\]\s*[-–:]?\s*/,
  /^(?:(?:processo|proc\.?|pregao|dispensa)\s*)?(?:n[o.º°]*\s*)?[a-z]{0,6}-?\d[\d./-]*\s+[-–:]\s*/,
  // "A presente contratação tem por finalidade/objeto ...", "O presente pregão visa ..."
  new RegExp(
    `^(?:a |o )?presente ${SUBSTANTIVO}${ADJETIVO} (?:(?:tem|possui)(?: por| como)? (?:finalidade|objeto|objetivo)|visa|objetiva|pretende|destina-se a)${ARTIGO}[:,;]?\\s+`,
  ),
  // "O objeto da presente contratação é ..."
  new RegExp(
    `^(?:o )?objeto (?:d[aeo]|dest[ae])s?(?: presente)? ${SUBSTANTIVO}${ADJETIVO} (?:e|sera|consiste(?: em| na| no)?|compreende|abrange)${ARTIGO}[:,;]?\\s+`,
  ),
  // "Constitui objeto da presente licitação ..."
  new RegExp(
    `^constitu(?:i|em) (?:o )?objeto (?:d[aeo]|dest[ae])s?(?: presente)? ${SUBSTANTIVO}${ADJETIVO}[:,;]?\\s+`,
  ),
  // "a escolha da proposta mais vantajosa para ..."
  new RegExp(
    `^(?:a |o )?(?:escolha|selecao) d[ae] (?:melhor )?(?:proposta|empresa|fornecedor)(?: mais vantajosa)?(?: (?:para|visando|de))?${ARTIGO}\\s+`,
  ),
  // "Registro de preços para a eventual ..."
  new RegExp(
    `^(?:(?:sistema|ata|formacao de ata) de )?registro de precos?,? (?:para|visando|destinado a|com vistas a|objetivando)${ARTIGO}(?: ${FUTURO})*\\s+`,
  ),
  // "Contratação de empresa (especializada) (para|em|na|no) ..." e "Contratação de ..."
  new RegExp(
    `^(?:a |uma )?(?:${FUTURO} )*contratacao(?: direta)?(?: de| da| do| dos| das)\\s+(?:(?:uma )?(?:empresa|pessoa juridica|empresas|firma)(?: (?:especializad[ao]s?|do ramo|capacitad[ao]|habilitad[ao]|credenciad[ao]|qualificad[ao]))*(?: (?:fornecedor|prestador|executor)[ao]s? (?:de|do|da|dos|das))?(?: (?:para|em|na|no|nas|nos|de|do|da|a|o|ao|visando|que))?\\s+)?`,
  ),
  // "eventual aquisição", "futura e eventual compra"
  new RegExp(`^(?:a |o )?(?:${FUTURO} )+`),
  // "A aquisição de ...", "A prestação de ..." sem o artigo
  new RegExp(
    "^(?:a|o|as|os)\\s+(?=(?:aquisicao|compra|prestacao|execucao|fornecimento|locacao|manutencao|realizacao|elaboracao|instalacao|construcao|reforma|obra|servicos?)\\b)",
  ),
  // "visando a ...", "com a finalidade de ...", "a fim de ..."
  /^visando(?: (?:a|o|as|os))?\s+/,
  /^com (?:a |o )?(?:finalidade|objetivo|intuito|fim) de\s+/,
  /^a fim de\s+/,
  // "Trata-se de ..."
  /^trata-se (?:de|da|do)(?: (?:uma|um|a|o))?\s+/,
  // "Objeto: ..."
  /^(?:do )?objeto\s*[:\-–]\s*/,
  // "Dispensa de licitação para ...", "Pregão eletrônico n. 12/2025 para ..."
  new RegExp(
    `^(?:pregao|dispensa|licitacao|processo)(?: eletronic[oa]| presencial| licitatori[oa])*(?: de licitacao)?(?: n[o.º°]*\\s*[\\d./-]+)?\\s+(?:para|visando|destinad[oa] a|referente a|relativ[oa] a|objetivando)${ARTIGO}\\s+`,
  ),
  // "Referente a ..."
  /^(?:referente|relativ[oa])\s+(?:a|ao|aos|as)\s+/,
];

const ARTIGO_SOLTO = /^(?:a|o|as|os|um|uma|para|de|do|da)\s+/;

const INICIO_CAUDA = "(?:[,;.]\\s*|\\s+)";

/** Caudas que não dizem o que se compra: tudo dali em diante sai. */
const CAUDAS: ReadonlyArray<RegExp> = [
  new RegExp(`${INICIO_CAUDA}(?:conforme|consoante)\\b`),
  new RegExp(`${INICIO_CAUDA}nos termos (?:d[aeo]s?|do|da|dos|das|de)\\b`),
  new RegExp(`${INICIO_CAUDA}de acordo com\\b`),
  new RegExp(`${INICIO_CAUDA}(?:em conformidade|com base n[aoe]s?)\\b`),
  new RegExp(`${INICIO_CAUDA}(?:e |com )?(?:seus|suas) (?:anexos|especificacoes)\\b`),
  new RegExp(
    `${INICIO_CAUDA}(?:constante|descrit[oa]s?|detalhad[oa]s?|especificad[oa]s?|previst[oa]s?|estabelecid[oa]s?) (?:n[oa]s?|em|no|nas|nos)\\s+(?:edital|termo|anexo|projeto|planilha|memorial)`,
  ),
  new RegExp(`${INICIO_CAUDA}(?:vide|ver) (?:anexo|edital|termo)`),
  /\s*\(\s*(?:conforme|vide|anexo)/,
];

/** Siglas que ficam em maiúsculas quando o texto inteiro vem em caixa alta. */
const SIGLAS: ReadonlySet<string> = new Set([
  "RJ", "TI", "TIC", "CFTV", "PREVINI", "SUS", "UPA", "CRAS", "CREAS", "EPI", "EPIS", "GLP", "LED",
  "PVC", "ABNT", "NBR", "ANVISA", "ME", "EPP", "MEI", "CNPJ", "CPF", "TV", "PC", "ETA", "ETE",
  "IPTU", "ISS", "ICMS", "UTI", "SAMU", "CEP", "GPS", "USB", "HD", "SSD", "RAM", "CPU", "SRP",
  "PMRJ", "UERJ", "UFRJ", "IFRJ", "CEDAE", "COMLURB", "FIOCRUZ", "INSS", "FGTS", "EJA", "PNAE",
  "PNATE", "FUNDEB", "CAPS", "UBS", "PSF", "ESF", "CMEI", "CIEP", "GCM", "PM", "CBMERJ", "DETRAN",
  "DNIT", "SEEDUC", "SMS", "SME", "UF", "OS", "NF", "ONG", "COVID", "SIGA", "PNCP", "BR", "RS", "SP",
  "MG", "ES", "CNH", "IPVA", "DPVAT", "GNV", "ECG", "RX", "TC", "RM", "UVA", "PAV", "CCTV", "LGPD",
]);

const NUMERAL_ROMANO = /^(?:I{2,3}|IV|VI{1,3}|IX|X{1,3})$/;
const SO_CONSOANTES = /^[BCDFGHJKLMNPQRSTVWXYZ]{2,5}$/;
const LETRA_NUMERO = /^[A-Z]\d+$/;

/** Nomes próprios da região, para recuperar a maiúscula depois de baixar a caixa. */
const LUGARES: ReadonlyArray<string> = [
  "Nova Iguaçu", "Rio de Janeiro", "Duque de Caxias", "Belford Roxo", "Mesquita", "Nilópolis",
  "São João de Meriti", "Queimados", "Japeri", "Seropédica", "Itaguaí", "Magé", "Guapimirim",
  "Niterói", "São Gonçalo", "Maricá", "Paracambi", "Mangaratiba", "Petrópolis", "Volta Redonda",
];

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const REGEX_LUGARES: ReadonlyArray<{ regex: RegExp; nome: string }> = LUGARES.map((nome) => ({
  regex: new RegExp(`(?<![\\p{L}\\p{N}])${escaparRegex(nome)}(?![\\p{L}\\p{N}])`, "giu"),
  nome,
}));

function estaTodoEmMaiusculas(texto: string): boolean {
  const letras = texto.match(/\p{L}/gu)?.length ?? 0;
  if (letras === 0) return false;
  const minusculas = texto.match(/\p{Ll}/gu)?.length ?? 0;
  return minusculas / letras < 0.05;
}

function normalizarCaixaAlta(texto: string): string {
  const baixado = texto.replace(/[\p{L}\p{N}]+/gu, (palavra) => {
    if (SIGLAS.has(palavra)) return palavra;
    if (SO_CONSOANTES.test(palavra) || NUMERAL_ROMANO.test(palavra) || LETRA_NUMERO.test(palavra)) {
      return palavra;
    }
    return palavra.toLowerCase();
  });
  return REGEX_LUGARES.reduce((atual, { regex, nome }) => atual.replace(regex, nome), baixado);
}

function maiusculaNaPrimeiraLetra(texto: string): string {
  const posicao = texto.search(/\p{L}/u);
  if (posicao < 0) return texto;
  return texto.slice(0, posicao) + texto.charAt(posicao).toUpperCase() + texto.slice(posicao + 1);
}

function aparar(texto: string): string {
  return texto.replace(/^[\s,;:.\-–]+/, "");
}

function removerAbertura(texto: string): string {
  let atual = texto;
  let mudou = false;
  for (let volta = 0; volta < 8; volta += 1) {
    const dobrado = dobrar(atual);
    let cortou = false;
    for (const abertura of ABERTURAS) {
      const achado = abertura.exec(dobrado);
      if (!achado || achado[0].length === 0) continue;
      const resto = aparar(atual.slice(achado[0].length));
      if (resto.length < 5) continue;
      atual = resto;
      cortou = true;
      mudou = true;
      break;
    }
    if (cortou) continue;
    if (!mudou) break;
    const solto = ARTIGO_SOLTO.exec(dobrar(atual));
    mudou = false;
    if (solto && atual.length - solto[0].length >= 10) {
      atual = atual.slice(solto[0].length);
      continue;
    }
    break;
  }
  return atual;
}

const MENOR_CORTE = 12;

function removerCauda(texto: string): string {
  const dobrado = dobrar(texto);
  let corte = texto.length;
  for (const cauda of CAUDAS) {
    const achado = cauda.exec(dobrado);
    if (achado && achado.index >= MENOR_CORTE && achado.index < corte) corte = achado.index;
  }
  return texto.slice(0, corte);
}

const CONECTIVO_SOLTO = /\s+(?:de|da|do|das|dos|e|para|com|a|o|em|na|no|nas|nos|ao)$/i;

function limparFim(texto: string): string {
  let atual = texto.replace(/[\s,;:.\-–(]+$/, "");
  for (let volta = 0; volta < 3; volta += 1) {
    const semConectivo = atual.replace(CONECTIVO_SOLTO, "").replace(/[\s,;:.\-–(]+$/, "");
    if (semConectivo === atual) break;
    atual = semConectivo;
  }
  return atual;
}

/**
 * Devolve o objeto numa frase curta e direta: sem abertura burocrática, sem cauda,
 * com a primeira letra maiúscula e sem ponto final. Nunca devolve vazio.
 */
export function resumirObjeto(texto: string): string {
  const original = texto.normalize("NFC").replace(/\s+/g, " ").trim();
  if (original.length === 0) return texto.trim();

  const semAbertura = removerAbertura(original);
  const semCauda = removerCauda(semAbertura);
  let resumo = limparFim(semCauda);
  if (resumo.length < 3) resumo = limparFim(semAbertura);
  if (resumo.length < 3) return original;

  if (estaTodoEmMaiusculas(resumo)) resumo = normalizarCaixaAlta(resumo);
  return maiusculaNaPrimeiraLetra(resumo);
}
