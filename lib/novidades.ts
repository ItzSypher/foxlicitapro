import type { Papel } from "@/core/types-equipe";

/** Muda a cada rodada de novidades: quem já viu a versão anterior vê o aviso de novo uma vez. */
export const VERSAO_NOVIDADES = "2026-11-16";

/** Evento de janela que abre o tour a partir da barra lateral ou do menu "Mais" do celular. */
export const EVENTO_ABRIR_TOUR = "foxlicita:abrir-tour";

export type NomeIcone =
  | "painel"
  | "pipeline"
  | "encerradas"
  | "preco"
  | "conselheiro"
  | "resultados"
  | "proposta"
  | "busca"
  | "equipe";

export type Matiz = "marca" | "positivo" | "alerta" | "neutro";

export interface Novidade {
  id: string;
  icone: NomeIcone;
  matiz: Matiz;
  titulo: string;
  /** Texto curto, mostrado na lista de novidades */
  descricao: string;
  /** Texto do passo do tour: 2 a 3 frases */
  explicacao: string;
  href: string;
  rotuloLink: string;
  /** Segunda tela relacionada, quando houver */
  extra?: { href: string; rotulo: string };
}

export const NOVIDADES: ReadonlyArray<Novidade> = [
  {
    id: "painel-radar",
    icone: "painel",
    matiz: "marca",
    titulo: "Painel do dia no Radar",
    descricao: "Veja o que é novo em 24 horas, o que fecha em 48 horas, o que é para você, o valor em jogo e as regiões.",
    explicacao:
      "No topo do Radar, um painel resume o seu dia: quantas licitações são novas, quantas fecham logo, quantas combinam com a sua empresa, quanto dinheiro está em jogo e de quais regiões elas são. Toque em um número para filtrar a lista.",
    href: "/radar",
    rotuloLink: "Abrir o Radar",
  },
  {
    id: "pipeline-desktop",
    icone: "pipeline",
    matiz: "neutro",
    titulo: "Pipeline mais prático no computador",
    descricao: "Colunas vazias ficam recolhidas, a roda do mouse rola o quadro, e há filtro e etiqueta de região.",
    explicacao:
      "As colunas sem nenhum card agora ficam recolhidas, para sobrar espaço. Use a roda do mouse para rolar o quadro de lado e filtre por região: cada card ganhou uma etiqueta mostrando de onde é a licitação.",
    href: "/pipeline",
    rotuloLink: "Abrir o Pipeline",
  },
  {
    id: "encerradas",
    icone: "encerradas",
    matiz: "alerta",
    titulo: "Encerradas",
    descricao: "Licitações com prazo vencido saem do Pipeline e ficam numa tela só delas.",
    explicacao:
      "Quando o prazo de uma licitação passa, ela sai do Pipeline sozinha e vai para a tela Encerradas. Assim o quadro mostra só o que ainda dá para disputar, e você continua podendo consultar o que ficou para trás.",
    href: "/encerradas",
    rotuloLink: "Abrir Encerradas",
  },
  {
    id: "preco-sugerido",
    icone: "preco",
    matiz: "positivo",
    titulo: "Preço sugerido",
    descricao: "Em cada card e na licitação: piso, alvo, teto e o veredito.",
    explicacao:
      "Cada card do Pipeline e a página da licitação mostram três valores: o piso (o menor preço que ainda compensa), o alvo (o que mais vale a pena propor) e o teto (o máximo aceito). Um veredito diz se o negócio vale a pena.",
    href: "/pipeline",
    rotuloLink: "Ver nos cards do Pipeline",
  },
  {
    id: "conselheiro",
    icone: "conselheiro",
    matiz: "marca",
    titulo: "Conselheiro",
    descricao: "Diz se vale a pena, como conseguir e explica o preço.",
    explicacao:
      "O Conselheiro responde, em linguagem simples, se uma licitação vale a pena, como conquistá-la e por que o preço sugerido é aquele. Ele fica no botão laranja da barra lateral, sempre à mão.",
    href: "/conselheiro",
    rotuloLink: "Falar com o Conselheiro",
  },
  {
    id: "resultados",
    icone: "resultados",
    matiz: "positivo",
    titulo: "Resultados",
    descricao: "Lucro, margem, relatório do mês, lista com filtros, planilha e PDF.",
    explicacao:
      "Acompanhe o lucro e a margem de cada licitação ganha, veja o relatório do mês e filtre a lista como preferir. Dá para baixar em planilha ou PDF. Ao marcar uma licitação como Ganha, informe o valor homologado e o custo para o cálculo ficar certo.",
    href: "/resultados",
    rotuloLink: "Abrir Resultados",
  },
  {
    id: "proposta-editavel",
    icone: "proposta",
    matiz: "neutro",
    titulo: "Proposta editável e legível no celular",
    descricao: "Corrija a proposta direto no documento, com leitura confortável no celular.",
    explicacao:
      "Agora você edita a proposta direto no próprio documento, sem abrir outra tela. No celular, o texto se ajusta à tela e fica fácil de ler e de conferir antes de enviar.",
    href: "/propostas",
    rotuloLink: "Abrir Propostas",
  },
  {
    id: "buscar-fora-rj",
    icone: "busca",
    matiz: "marca",
    titulo: "Buscar fora do RJ",
    descricao: "No Radar, procure serviços por estado e município.",
    explicacao:
      "O Radar agora também procura licitações de serviços fora do Rio de Janeiro. Escolha o estado e o município e veja as oportunidades de qualquer lugar do país.",
    href: "/radar",
    rotuloLink: "Buscar no Radar",
  },
  {
    id: "equipe-preferencias",
    icone: "equipe",
    matiz: "alerta",
    titulo: "Equipe e Preferências",
    descricao: "Defina a senha de alguém da equipe e cadastre exceções de pregão.",
    explicacao:
      "Em Equipe, o dono pode definir uma nova senha para alguém da equipe. Em Preferências, você cadastra exceções de pregão: situações em que o Radar deve tratar a licitação de forma diferente.",
    href: "/equipe",
    rotuloLink: "Abrir Equipe",
    extra: { href: "/preferencias", rotulo: "Abrir Preferências" },
  },
];

export interface PassoTour {
  id: string;
  tipo: "inicio" | "novidade" | "fim";
  icone: NomeIcone | "boas-vindas" | "fim";
  matiz: Matiz;
  titulo: string;
  texto: string;
  href?: string;
  rotuloLink?: string;
  extra?: { href: string; rotulo: string };
}

/** Só o dono e o gestor fazem o tour. */
export function podeFazerTour(papel: Papel): boolean {
  return papel === "dono" || papel === "gestor";
}

/** Passos do tour: boas-vindas, uma novidade por passo e o fim. Quem não é dono não vê a tela de Equipe. */
export function passosDoTour(papel: Papel): PassoTour[] {
  const meio: PassoTour[] = NOVIDADES.map((n) => {
    const semEquipe = n.id === "equipe-preferencias" && papel !== "dono";
    return {
      id: n.id,
      tipo: "novidade",
      icone: n.icone,
      matiz: n.matiz,
      titulo: n.titulo,
      texto: n.explicacao,
      href: semEquipe ? "/preferencias" : n.href,
      rotuloLink: semEquipe ? "Abrir Preferências" : n.rotuloLink,
      extra: semEquipe ? undefined : n.extra,
    };
  });
  return [
    {
      id: "inicio",
      tipo: "inicio",
      icone: "boas-vindas",
      matiz: "marca",
      titulo: "Bem-vindo às novidades",
      texto: `Em poucos passos você conhece o que mudou no FoxLicita Pro: ${NOVIDADES.length} novidades pensadas para ganhar tempo e disputar melhor. Pode abrir cada tela pelo caminho ou só ler.`,
    },
    ...meio,
    {
      id: "fim",
      tipo: "fim",
      icone: "fim",
      matiz: "positivo",
      titulo: "Tudo pronto",
      texto: "Esse foi o tour. Para rever quando quiser, use o item Tour do sistema na barra lateral ou no menu Mais do celular.",
    },
  ];
}

/** Chave do aparelho onde se lembra a última versão de novidades vista por esta pessoa. */
export function chaveNovidadesVistas(usuarioId: string): string {
  return `foxlicita:novidades-vistas:${usuarioId}`;
}

/** Chave do aparelho onde se lembra o passo do tour em que esta pessoa parou. */
export function chaveProgressoTour(usuarioId: string): string {
  return `foxlicita:tour-passo:${usuarioId}`;
}

/** Já viu esta versão? `salvo` é o que estava guardado (ou null). */
export function jaViuNovidades(salvo: string | null, versao: string = VERSAO_NOVIDADES): boolean {
  return salvo === versao;
}

/** Passo salvo, limitado ao tamanho do tour. Valor ausente, quebrado ou do passo final volta ao início. */
export function passoSalvo(salvo: string | null, total: number): number {
  if (salvo === null || !/^\d+$/.test(salvo)) return 0;
  const passo = Number(salvo);
  return passo >= 0 && passo < total - 1 ? passo : 0;
}
