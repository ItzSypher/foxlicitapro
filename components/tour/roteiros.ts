import {
  Award,
  BookmarkPlus,
  Building2,
  CalendarClock,
  Columns3,
  FileCheck,
  FileText,
  Layers,
  LayoutDashboard,
  Link2,
  ListFilter,
  MapPin,
  MessageCircle,
  PenLine,
  Search,
  Send,
  Tags,
  Target,
  UserRound,
} from "lucide-react";
import type { PassoTour, RotaTour } from "./logica";

const RADAR: ReadonlyArray<PassoTour> = [
  {
    id: "radar-painel",
    alvo: "radar-painel",
    icone: LayoutDashboard,
    titulo: "Seu dia em um olhar",
    texto: "Quantas licitações são novas, quantas fecham logo e quanto dinheiro está em jogo. Toque num número para filtrar a lista.",
  },
  {
    id: "radar-meta",
    alvo: "radar-meta",
    icone: Target,
    titulo: "Meta da semana",
    texto: "Mostra quantas disputas você já colocou em andamento contra o mínimo e o ideal da empresa. Toque para ver as semanas anteriores.",
  },
  {
    id: "radar-abas",
    alvo: "radar-abas",
    icone: Layers,
    titulo: "Novas, Fechando e Desertas",
    texto: "Troque de aba para ver o que acabou de sair, o que está perto do prazo e as dispensas que ficaram sem vencedor.",
  },
  {
    id: "radar-busca",
    alvo: "radar-busca",
    icone: Search,
    titulo: "Busca e Buscar no PNCP",
    texto: "Digite um termo para filtrar a lista. Se não achar, o botão Buscar no PNCP procura direto no portal, em todos os editais abertos.",
  },
  {
    id: "radar-estados",
    alvo: "radar-estados",
    icone: MapPin,
    titulo: "Filtre por estado",
    texto: "Escolha os estados que interessam agora. O botão Estados adiciona novos lugares à busca diária da empresa.",
  },
  {
    id: "radar-card",
    alvo: "radar-card",
    icone: Award,
    titulo: "Nota e selos",
    texto: "A nota diz o quanto a licitação combina com a sua empresa. Os selos mostram se é nova, se fecha logo e se já tem proposta pronta.",
  },
  {
    id: "radar-salvar",
    alvo: "radar-card",
    icone: BookmarkPlus,
    titulo: "Salvar no pipeline",
    texto: "Abra um card e toque em Salvar no pipeline para acompanhar a licitação, definir responsável e não perder o prazo.",
  },
];

const PIPELINE: ReadonlyArray<PassoTour> = [
  {
    id: "pipeline-colunas",
    alvo: "pipeline-colunas",
    icone: Columns3,
    titulo: "Etapas do caminho",
    texto: "Cada coluna é uma etapa, do interesse até o resultado. Arraste o card ou use o menu dele para avançar.",
  },
  {
    id: "pipeline-card",
    alvo: "pipeline-card",
    icone: FileText,
    titulo: "O card da licitação",
    texto: "Mostra a nota, o prazo, o valor e o local. Toque em Detalhes para ver preço, notas e a revisão jurídica.",
  },
  {
    id: "pipeline-link",
    alvo: "pipeline-link",
    icone: Link2,
    titulo: "Adicionar pelo link",
    texto: "Cole o link de uma licitação do PNCP e ela entra no quadro. Pelo WhatsApp, envie o comando analisar seguido do link: analisar <link>.",
  },
  {
    id: "pipeline-responsavel",
    alvo: "pipeline-responsavel",
    icone: UserRound,
    titulo: "Quem cuida dela",
    texto: "Defina o responsável pela licitação. Assim cada pessoa da equipe vê o que é seu em Só os meus.",
  },
  {
    id: "pipeline-prazo",
    alvo: "pipeline-prazo",
    icone: CalendarClock,
    titulo: "Prazo à vista",
    texto: "O tempo que falta para o encerramento aparece em cada card. Licitações encerradas saem do quadro sozinhas.",
  },
];

const PROPOSTAS: ReadonlyArray<PassoTour> = [
  {
    id: "propostas-lista",
    alvo: "propostas-lista",
    icone: FileText,
    titulo: "Suas propostas",
    texto: "Todas as propostas da empresa, com órgão, total e a data da última alteração. Toque numa linha para abrir.",
  },
  {
    id: "propostas-status",
    alvo: "propostas-status",
    icone: Tags,
    titulo: "Status de cada uma",
    texto: "Rascunho, em revisão, aprovada ou enviada. Use as abas acima para ver só o que espera você ou o que ainda não teve resultado.",
  },
  {
    id: "propostas-enviar",
    icone: Send,
    titulo: "Enviar com comprovante",
    texto: "Ao abrir uma proposta aprovada, registre o envio e anexe o comprovante. Assim o histórico fica completo e o resultado pode ser acompanhado.",
  },
  {
    id: "propostas-pronta",
    icone: FileCheck,
    titulo: "Proposta pronta",
    texto: "Quando uma proposta já vem montada para uma licitação, o Radar mostra o selo Proposta pronta. Basta abrir, conferir e enviar para revisão.",
  },
];

const EMPRESA: ReadonlyArray<PassoTour> = [
  {
    id: "empresa-ramo",
    alvo: "empresa-ramo",
    icone: ListFilter,
    titulo: "Seu ramo de atividade",
    texto: "Os CNAEs definem o que o Radar considera do seu ramo. Quanto mais certos, melhores as notas e as recomendações.",
  },
  {
    id: "empresa-onde",
    alvo: "empresa-onde",
    icone: MapPin,
    titulo: "Onde atender",
    texto: "Escolha os estados e as regiões em que a empresa quer vender. É daí que vem a busca diária de oportunidades.",
  },
  {
    id: "empresa-proposta",
    alvo: "empresa-proposta",
    icone: Building2,
    titulo: "Dados da proposta",
    texto: "Representante legal, CPF, RG e dados bancários saem preenchidos em toda proposta nova.",
  },
  {
    id: "empresa-assinatura",
    alvo: "empresa-assinatura",
    icone: PenLine,
    titulo: "Assinatura",
    texto: "Envie a imagem da assinatura para ela sair na proposta. Ela não substitui a assinatura digital do gov.br.",
  },
];

/** Passos de quem gerencia várias empresas; somem sozinhos quando o seletor não está na tela. */
const GESTOR: ReadonlyArray<PassoTour> = [
  {
    id: "gestor-seletor",
    alvo: "gestor-seletor",
    icone: Building2,
    titulo: "Troque de empresa",
    texto: "Você gerencia mais de uma empresa. Escolha aqui qual delas aparece no Radar, no Pipeline e nas Propostas.",
  },
  {
    id: "gestor-resumo",
    alvo: "gestor-seletor",
    icone: MessageCircle,
    titulo: "Um resumo só no WhatsApp",
    texto: "As mensagens diárias chegam em um único resumo com todas as suas empresas, sem precisar trocar de tela.",
  },
];

const POR_ROTA: Record<RotaTour, ReadonlyArray<PassoTour>> = {
  radar: [...RADAR, ...GESTOR],
  pipeline: PIPELINE,
  propostas: PROPOSTAS,
  empresa: EMPRESA,
};

/** Roteiro completo da tela (os passos sem alvo na tela são descartados na hora de abrir). */
export function roteiroDaRota(rota: RotaTour): ReadonlyArray<PassoTour> {
  return POR_ROTA[rota];
}
