# FoxLicita Pro — o que o sistema é

Documento interno. Atualizado em 19/11/2026.

## Em uma frase

Sistema do lado do fornecedor que acha licitações do ramo da empresa, organiza a disputa do começo ao resultado e avisa as pessoas certas pelo WhatsApp. É vendido como **serviço de acompanhamento**: o cliente contrata o acompanhamento das licitações no próprio CNPJ, operado por um gestor de licitação.

## Quem usa

| Papel | O que faz |
|---|---|
| **Dono** | Dono do CNPJ. Acompanha: Pipeline, meta da semana, propostas, resultados. Recebe o resumo de acompanhamento no WhatsApp. Configura a empresa (ramo, estados, dados da proposta, assinatura). |
| **Gestor** | Opera a licitação: escolhe as oportunidades, monta e revisa propostas, envia, registra comprovante e resultado. Recebe o resumo operacional e os prazos urgentes. Pode cuidar de várias empresas com um login só (seletor de empresa no menu). |
| **Outros membros** | Permissões marcadas em Equipe (mexer no Pipeline, editar ou aprovar propostas, usar o assistente). |
| **Superadmin** | Administração da plataforma: cria empresas (inclusive de teste, sem consulta à Receita), liga gestores às empresas. |

Exemplo atual: Arthur Silva Moura (MEI, dono), Paulo Henrique (gestor e jurídico, cuida do Arthur e do Daniel).

## Telas

- **Radar** — oportunidades abertas do ramo, com nota, filtros (estados, faixa de valor, modalidade, fonte, "tudo do meu ramo"), busca por palavra e busca direta no PNCP. Resumo do dia e meta da semana no topo.
- **Pipeline** — quadro por etapa (triagem, análise, proposta, disputa, resultado), com responsável, prazos e histórico. Item em Disputa conta para a meta.
- **Licitação** — detalhe do edital, itens, ficha do edital, semelhantes, concorrentes.
- **Propostas** — proposta com dados padrão da empresa, assinatura, revisão e aprovação, envio com comprovante, proposta enviada fora do sistema, linha do tempo e resultado lido do PNCP.
- **Resultados** e **Encerradas** — o que já fechou, ganho, perdido, preços praticados.
- **Conselheiro** — assistente que responde sobre a página aberta e guarda as conversas.
- **Calculadora**, **Fornecedores** — apoio para preço e cotação.
- **Alertas** — o que cada pessoa recebe no WhatsApp e a situação da conversa (aberta ou fechada, último resumo).
- **Empresa** — ramo (CNAEs), onde atende (estados, regiões, municípios), dados da proposta, assinatura, meta semanal.
- **Equipe** — pessoas, papéis, permissões, responsável padrão.
- **Admin** — empresas da plataforma e gestores ligados a cada uma (só superadmin).

## De onde vêm as licitações

1. **PNCP** (fonte principal): coleta diária às 7h por estado escolhido, dispensa e pregão eletrônico, até 3.000 por estado e modalidade. O PNCP já traz processos de BNC, BLL, Licitanet, Portal de Compras Públicas e Compras RJ, identificados pelo selo de fonte.
2. **Busca direta no PNCP**: pela palavra digitada, em tempo real, para o que a coleta ainda não trouxe.
3. **Alerta Licitação** (API paga por uso, 100 por dia grátis): cobre diários oficiais e sites de prefeitura que ainda não publicam no PNCP (municípios pequenos só são obrigados a partir de abril de 2027).

Estado novo marcado no filtro entra na coleta diária e é coletado na hora, em segundo plano.

## WhatsApp

- **Só o resumo das 7h e prazo urgente** (2 h e 24 h) dos itens do Pipeline. Teto de 150 alertas por mês por empresa.
- O gestor recebe o operacional; o dono recebe acompanhamento (movimentos do gestor, licitações grandes, entradas em disputa, meta).
- Gestor com várias empresas recebe **uma mensagem só**, com um bloco por empresa.
- **Regra do WhatsApp:** o sistema só pode mandar mensagem até 24 h depois da última mensagem da pessoa. Quem não responde há mais de 24 h não recebe o resumo. Basta responder qualquer coisa ou tocar em "Continuar recebendo". A tela Alertas mostra quem está com a conversa aberta.

## Rotinas automáticas

| Quando | O quê |
|---|---|
| 7h (diário) | Coleta do PNCP e do Alerta Licitação, resumo por e-mail, avisos, resultado das propostas enviadas |
| 7h às 20h, de hora em hora | Alertas de WhatsApp (resumo das 7h e prazos) |
| Ao abrir o Radar | Se o cache tem mais de 30 min, pede nova coleta em segundo plano |

## Em preparação (código pronto, desligado)

- **Desertas e fracassadas**: dispensas sem vencedor nos últimos 60 dias, que o órgão costuma repetir (`DESERTAS_ATIVA`).
- **Proposta pronta**: rascunho automático para as 3 melhores do ramo que fecham em até 5 dias (`PROPOSTA_PRONTA_ATIVA`).
- Faltam as telas (aba Desertas, Semelhantes no detalhe, selo "Proposta pronta").

## Técnico, em resumo

- Next.js 16 na Vercel; Postgres no Supabase pelo pooler em modo sessão (porta 5432).
- Migrations manuais (`npm run db:migrar`), aplicadas só com ok.
- WhatsApp pelo Zernio (conta em coexistência). Assistente com modelo de linguagem configurado por variável de ambiente.
- Segredos só nas variáveis da Vercel. Histórico de decisões em `docs/LOG.md`.
