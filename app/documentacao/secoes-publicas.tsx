import {
  BellRing,
  Briefcase,
  CalendarClock,
  Clock,
  Columns3,
  FileText,
  Gauge,
  MessageCircle,
  Radar,
  Target,
  Trophy,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import { Cartao, Codigo, Grade, Grade3, Lista, Secao } from "./blocos";

export function VisaoGeral() {
  return (
    <Secao
      id="visao-geral"
      titulo="Visão geral"
      resumo="O que é o FoxLicita Pro, para quem serve e quem faz o quê."
      icone={Briefcase}
    >
      <Cartao titulo="O que é" icone={Radar}>
        <p>
          O FoxLicita Pro é um serviço de <strong className="font-semibold text-ink">acompanhamento de licitações no CNPJ do cliente</strong>.
          O sistema acha as licitações do ramo da empresa, organiza a disputa do começo ao resultado e avisa as pessoas certas pelo
          WhatsApp. Um gestor de licitação opera o dia a dia; o dono da empresa acompanha.
        </p>
      </Cartao>

      <Grade3>
        <Cartao titulo="Radar" icone={Radar}>
          <p>Licitações abertas do ramo, com nota de 0 a 100, filtros por estado, valor e modalidade, e busca por palavra.</p>
        </Cartao>
        <Cartao titulo="Pipeline" icone={Columns3}>
          <p>Quadro com cada disputa por etapa até o resultado, ordenado pelo prazo, com alerta do que fecha hoje.</p>
        </Cartao>
        <Cartao titulo="Propostas" icone={FileText}>
          <p>Proposta com os dados e a assinatura da empresa, revisão, aprovação do dono e comprovante de envio.</p>
        </Cartao>
      </Grade3>

      <Cartao titulo="Para quem é" icone={Target}>
        <p>
          Para <strong className="font-semibold text-ink">MEIs e pequenas empresas que vendem ao governo</strong>: quem fornece informática,
          material de escritório, papelaria e manutenção, e não tem tempo nem equipe para vasculhar portais todos os dias.
        </p>
      </Cartao>

      <Cartao titulo="Quem acessa" icone={Users}>
        <Grade>
          <Cartao titulo="Dono">
            <p>Vê tudo da própria empresa: configura o ramo, os estados atendidos, os dados da proposta e a equipe, e aprova propostas.</p>
          </Cartao>
          <Cartao titulo="Gestor">
            <p>
              Opera o Pipeline e as propostas. Pode cuidar de várias empresas com um único login, escolhendo a empresa no menu.
            </p>
          </Cartao>
          <Cartao titulo="Membro">
            <p>Acessa o que o dono liberar na área de Equipe.</p>
          </Cartao>
          <Cartao titulo="Separação entre empresas">
            <p>Cada empresa enxerga só os próprios dados. O gestor entra apenas nas empresas que foram ligadas a ele.</p>
          </Cartao>
        </Grade>
      </Cartao>

      <Cartao titulo="Quem faz" icone={UserCog}>
        <p>
          Criado e mantido pela{" "}
          <a
            href="https://foxtisolutions.com.br"
            target="_blank"
            rel="noopener"
            className="font-medium text-brand underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Fox TI Solutions
          </a>
          , de Nova Iguaçu, no Rio de Janeiro.
        </p>
      </Cartao>
    </Secao>
  );
}

export function Logica() {
  return (
    <Secao
      id="logica"
      titulo="Lógica"
      resumo="Como o sistema decide o que vale a pena disputar e quando avisar."
      icone={Gauge}
    >
      <Cartao titulo="De onde vêm as licitações" icone={Radar}>
        <Lista
          itens={[
            <>
              <strong className="font-semibold text-ink">PNCP</strong>, o portal nacional de contratações públicas: coleta todo dia às 7h
              dos estados escolhidos (dispensa e pregão eletrônico), incluindo o que as plataformas de compras publicam nele.
            </>,
            <>
              <strong className="font-semibold text-ink">Busca direta no PNCP</strong>, na hora, pela palavra que você digitar.
            </>,
            <>
              <strong className="font-semibold text-ink">Diários oficiais e sites de prefeituras</strong> pequenas, que só serão obrigadas a
              usar o PNCP em abril de 2027. Entram por um serviço que reúne essas publicações.
            </>,
          ]}
        />
      </Cartao>

      <Cartao titulo="Nota de 0 a 100" icone={Gauge}>
        <p>Cada licitação recebe uma nota que soma cinco critérios:</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            ["Ramo e foco", "30", "O objeto combina com a atividade da empresa. Os termos do foco da empresa valem mais."],
            ["Modalidade", "25", "Dispensa e pregão eletrônico são mais acessíveis a quem é pequeno."],
            ["Local", "20", "Estado e região atendidos pela empresa."],
            ["Documentação", "15", "O que o edital pede de habilitação e a empresa consegue cumprir."],
            ["Valor x teto do MEI", "10", "O valor estimado cabe no limite de faturamento do MEI."],
          ].map(([nome, pontos, texto]) => (
            <li key={nome} className="flex gap-3 rounded-xl bg-raised p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-sm font-semibold text-ink tabular-nums">
                {pontos}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{nome}</span>
                <span className="block text-xs leading-relaxed">{texto}</span>
              </span>
            </li>
          ))}
        </ul>
        <Lista
          itens={[
            <>
              <strong className="font-semibold text-ink">Foco da empresa:</strong> os termos que o dono mais quer vender pesam no critério
              de ramo. Se nenhuma atividade cadastrada cobre o foco, o sistema avisa.
            </>,
            <>
              <strong className="font-semibold text-ink">Serviço feito à distância</strong> (site, sistema, suporte remoto): o local da
              entrega deixa de pesar contra a empresa.
            </>,
          ]}
        />
      </Cartao>

      <Cartao titulo="Faixas da nota" icone={Target}>
        <ul className="grid gap-2 sm:grid-cols-3">
          <li className="rounded-xl bg-raised p-3">
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-go" />
              75 a 100
            </span>
            <span className="text-xs">Bom: vale disputar.</span>
          </li>
          <li className="rounded-xl bg-raised p-3">
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-atencao" />
              50 a 74
            </span>
            <span className="text-xs">Atenção: confira os pontos fracos antes.</span>
          </li>
          <li className="rounded-xl bg-raised p-3">
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-nogo" />
              Abaixo de 50
            </span>
            <span className="text-xs">Evitar: fora do perfil da empresa.</span>
          </li>
        </ul>
        <p>
          Valor acima do teto do MEI ou prazo muito curto para montar a proposta rebaixam a licitação de “vale disputar” para “atenção”.
        </p>
      </Cartao>

      <Grade>
        <Cartao titulo="Prazos" icone={CalendarClock}>
          <p>
            O Pipeline destaca o que <strong className="font-semibold text-ink">fecha hoje</strong> e o que{" "}
            <strong className="font-semibold text-ink">fecha amanhã</strong> sem proposta pronta, para ninguém perder a data.
          </p>
        </Cartao>
        <Cartao titulo="Meta semanal" icone={Trophy}>
          <p>
            A empresa define um <strong className="font-semibold text-ink">mínimo</strong> e um{" "}
            <strong className="font-semibold text-ink">ideal</strong> de disputas por semana (por padrão, 5 e 10). Cada item em Disputa conta
            para a meta, e a tela mostra quanto falta.
          </p>
        </Cartao>
      </Grade>

      <Cartao titulo="Regra de 24 horas do WhatsApp" icone={Clock}>
        <p>
          O WhatsApp só permite texto livre até 24 horas depois da última mensagem da pessoa. Por isso, com a conversa fechada, o resumo
          das 7h sai como um aviso curto; se ele não for entregue, o resumo do dia vai junto na primeira mensagem que a pessoa mandar.
          A tela Alertas mostra a situação de cada pessoa.
        </p>
        <p>
          Só há dois tipos de aviso: o resumo das 7h e o prazo urgente (2 horas e 24 horas antes). Quem cuida de várias empresas recebe
          uma mensagem só, com um bloco por empresa.
        </p>
      </Cartao>
    </Secao>
  );
}

const PASSOS: ReadonlyArray<{ titulo: string; icone: typeof Radar; itens: ReadonlyArray<React.ReactNode> }> = [
  {
    titulo: "1. Radar",
    icone: Radar,
    itens: [
      "Abra as abas Novas, Fechando e Desertas e filtre por estado, valor, modalidade ou palavra.",
      "Priorize as notas altas. Abra a licitação para ver edital, itens, ficha resumida, semelhantes em outros órgãos e concorrentes.",
      "Mande para o Pipeline as que valem a disputa.",
    ],
  },
  {
    titulo: "2. Pipeline",
    icone: Columns3,
    itens: [
      "Item novo já entra com o responsável padrão da empresa (o gestor).",
      "A faixa no topo mostra o que fecha hoje ou amanhã sem proposta.",
      "Alterne para a vista Por prazo para ver tudo em ordem de data.",
      <>
        Para adicionar uma licitação que você já conhece, cole o link do PNCP na tela ou mande <Codigo>analisar &lt;link&gt;</Codigo> no
        WhatsApp.
      </>,
    ],
  },
  {
    titulo: "3. Proposta",
    icone: FileText,
    itens: [
      "O sistema deixa um rascunho pronto para as três melhores licitações que fecham em até 5 dias; você também pode gerar na hora.",
      "O gestor revisa e sobe para aprovação. O dono recebe no WhatsApp um aviso com o link para leitura e o botão Aprovar.",
      "Aprovada, o gestor envia e guarda o comprovante de envio. Quando a proposta foi feita fora do sistema, registre como proposta externa.",
    ],
  },
  {
    titulo: "4. Resultado",
    icone: Trophy,
    itens: [
      "O resultado é lido do PNCP e o item vai para Resultados: ganho, perdido e preços praticados.",
      "Use os preços praticados para calibrar as próximas propostas.",
    ],
  },
];

const COMANDOS: ReadonlyArray<readonly [string, string]> = [
  ["pipeline", "Mostra o que está em andamento."],
  ["prazos", "Lista o que fecha em breve."],
  ["analisar <link>", "Analisa a licitação do link do PNCP e adiciona ao Pipeline."],
  ["gerar N", "Gera o rascunho da proposta de número N da lista “Propostas para hoje”, com link e botão Aprovar."],
  ["parar", "Interrompe os avisos."],
];

export function Operacao() {
  return (
    <Secao
      id="operacao"
      titulo="Operação"
      resumo="A rotina do gestor e do dono, passo a passo."
      icone={Wrench}
    >
      <Grade>
        {PASSOS.map((passo) => {
          const Icone = passo.icone;
          return (
            <Cartao key={passo.titulo} titulo={passo.titulo} icone={Icone}>
              <Lista itens={passo.itens} />
            </Cartao>
          );
        })}
      </Grade>

      <Cartao titulo="Rotina do dia" icone={BellRing}>
        <Lista
          itens={[
            <>
              <strong className="font-semibold text-ink">Gestor:</strong> lê o resumo das 7h, responde <Codigo>gerar 1</Codigo> para
              receber o rascunho, revisa, sobe para aprovação e acompanha a faixa do que fecha hoje.
            </>,
            <>
              <strong className="font-semibold text-ink">Dono:</strong> recebe o aviso de cada proposta com o link, lê, aprova com um toque e
              acompanha a meta da semana e os resultados.
            </>,
          ]}
        />
      </Cartao>

      <Cartao titulo="Comandos do WhatsApp" icone={MessageCircle}>
        <ul className="flex flex-col gap-2">
          {COMANDOS.map(([comando, texto]) => (
            <li key={comando} className="flex flex-col gap-1 rounded-xl bg-raised p-3 sm:flex-row sm:items-center sm:gap-3">
              <span className="shrink-0 sm:w-44">
                <Codigo>{comando}</Codigo>
              </span>
              <span className="text-sm">{texto}</span>
            </li>
          ))}
        </ul>
      </Cartao>
    </Secao>
  );
}
