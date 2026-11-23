# FoxLicita Pro

Documento interno. Atualizado em 19/11/2026. Parte 1 é o produto; parte 2 é a técnica.

---

# Parte 1 — Produto

## O que é

Serviço de **acompanhamento de licitações no CNPJ do cliente**. O sistema acha as licitações do ramo da empresa, organiza a disputa do começo ao resultado e avisa as pessoas certas pelo WhatsApp. Um gestor de licitação opera; o dono do CNPJ acompanha.

- **Endereço:** https://licitapro.foxtisolutions.com.br
- **Para quem:** MEIs e pequenas empresas que vendem para o governo (hoje: informática, escritório, papelaria, manutenção).
- **Modelo comercial:** acompanhamento contratado pelo cliente. Pilotos sem valor fixo; próximos clientes pagam.

## O que faz

| Área | O que entrega |
|---|---|
| **Radar** | Licitações abertas do ramo, com nota, filtros (estados, valor, modalidade, fonte), busca por palavra e busca direta no PNCP. Abas de novas, fechando e desertas. |
| **Pipeline** | Quadro por etapa até o resultado, ordenado por prazo, com alerta do que fecha hoje sem proposta e vista "Por prazo". Item novo já entra com o responsável padrão (gestor). Adicionar pelo link do PNCP (na tela ou mandando "analisar <link>" no WhatsApp). Item em Disputa conta para a meta da semana. |
| **Licitação** | Edital, itens, ficha resumida, semelhantes em outros órgãos, concorrentes. |
| **Propostas** | Proposta com dados e assinatura da empresa, revisão e aprovação, envio com comprovante, proposta feita fora do sistema, resultado lido do PNCP. Rascunho automático para as 3 melhores que fecham em até 5 dias. |
| **Resultados** | O que fechou: ganho, perdido, preços praticados. |
| **Conselheiro** | Assistente que responde sobre a tela aberta e guarda as conversas. |
| **WhatsApp** | Resumo das 7h e prazos urgentes. O gestor recebe o operacional; o dono, o acompanhamento. |

## Quem acessa

| Papel | Acesso |
|---|---|
| **Dono** | Tudo da própria empresa: configura ramo, estados, dados da proposta, equipe. |
| **Gestor** | Opera Pipeline e propostas. Pode cuidar de várias empresas com um login (seletor no menu). |
| **Membro** | O que o dono marcar em Equipe. |
| **Superadmin** | Cria empresas e liga gestores a elas (Admin). |

Cada empresa só enxerga os próprios dados. O gestor só entra nas empresas que o superadmin ligou a ele.

## Dados que o sistema guarda

- **Empresa:** CNPJ, razão social, endereço, CNAEs (consultados na Receita), foco (termos que mais quer vender), estados atendidos, meta.
- **Pessoas:** nome, e-mail, senha (cifrada, nunca legível), papel, WhatsApp.
- **Proposta:** representante (nome, CPF, RG), dados bancários, imagem da assinatura, propostas, comprovantes de envio.
- **Uso:** Pipeline, histórico de etapas, conversas do conselheiro, mensagens trocadas com o WhatsApp do sistema.
- **Licitações:** dados públicos do PNCP e do Alerta Licitação.

## Fontes de licitação

1. **PNCP** — coleta diária às 7h dos estados escolhidos (dispensa e pregão eletrônico). Inclui o que BNC, BLL, Licitanet, Portal de Compras Públicas e Compras RJ publicam no PNCP.
2. **Busca direta no PNCP** — em tempo real, pela palavra.
3. **Alerta Licitação** — diários oficiais e sites de prefeituras pequenas, que só serão obrigadas a usar o PNCP em abril de 2027.

## Regras do WhatsApp

- Só resumo das 7h e prazo urgente (2 h e 24 h). Gestor com várias empresas recebe uma mensagem com um bloco por empresa.
- O WhatsApp só permite texto livre até 24 h depois da última mensagem da pessoa. Com a janela fechada, o resumo das 7h sai como mensagem utilitária (cobrada pela Meta); se ela falhar, o resumo do dia vai na primeira mensagem que a pessoa mandar. A tela Alertas mostra a situação de cada um.
- O gestor recebe "Propostas para hoje" e responde *gerar 1* para receber o rascunho com link e botão Aprovar; o dono é avisado.

---

# Parte 2 — Técnica

## Arquitetura

- **App:** Next.js 16 (App Router, Server Components, Server Actions), TypeScript estrito, Tailwind. Hospedagem Vercel (região gru1), deploy a cada push na `main`.
- **Banco:** Postgres no Supabase, pelo pooler em **modo sessão (porta 5432)** — o modo transação travava com consultas paralelas. Driver `postgres`, `max: 3` por instância. Migrations manuais em `db/migrations`, aplicadas com `npm run db:migrar` e só com ok.
- **Camadas:** `core/` regras puras e testadas; `db/` consultas (sempre filtradas por `empresa_id`); `lib/` integrações e orquestração; `app/` telas e rotas; `components/` interface.
- **Testes:** Vitest (~920 testes), `tsc --noEmit` e ESLint antes de cada commit.

## Integrações

| Serviço | Uso | Acesso |
|---|---|---|
| PNCP consulta (`/api/consulta/v1/contratacoes/proposta`) | Coleta por UF e modalidade, até 60 páginas de 50 | Público |
| PNCP busca (`/api/search/`) | Busca por texto em tempo real | Público |
| PNCP itens/resultados | Detalhe do edital e resultado das propostas | Público |
| Alerta Licitação (`/api/v1/licitacoesAbertas`) | Segunda fonte; 100/dia grátis, depois R$ 0,01 | `ALERTA_LICITACAO_TOKEN` |
| BrasilAPI | Dados do CNPJ ao criar empresa | Público |
| Zernio | WhatsApp (envio, webhook com assinatura) | `ZERNIO_API_KEY`, segredo do webhook |
| Modelo de linguagem | Conselheiro, ficha do edital, rascunho de proposta | Chave em variável de ambiente |
| E-mail | Resumo diário | Variável de ambiente |

## Rotinas

| Quando | Rota | O quê |
|---|---|---|
| 7h | `/api/cron/radar` (Vercel Cron) | Coleta PNCP + Alerta, resumo por e-mail, avisos, resultados, desertas |
| 7h30 | `/api/cron/radar?so=prontas` | Rascunhos de proposta |
| 7h às 20h, hora em hora | `/api/cron/alertas` (pg_cron no Supabase) | WhatsApp |
| Sob demanda | `/api/cron/coleta?ufs=` | Coleta pedida pelo Radar ou estado novo, em chamada separada |

Cache do Radar em `radar_cache` por UF e modalidade; a tela só lê o cache (abre em ~1 s). Cache com mais de 30 min pede nova coleta em segundo plano.

## Rapidez

- Telas leem só o banco; nada chama o PNCP na hora de abrir (exceto a busca direta, sob pedido).
- Filtro, ordenação e paginação no servidor; só a página atual vai ao navegador.
- Coleta longa nunca roda dentro da visita.

## Segurança

**Em vigor**
- Senha com scrypt; sessão em cookie assinado (HMAC, `APP_SECRET`), `httpOnly`, `secure`, `sameSite=lax`, 30 dias, conferida no banco a cada pedido (pessoa ou empresa desativada perde o acesso na hora).
- Isolamento por empresa em toda consulta; empresa ativa do gestor validada contra `usuario_empresas` a cada pedido.
- Permissões por papel conferidas no servidor (`exigirPermissao`, `exigirDono`, `exigirSuperadmin`).
- Rotas de cron exigem `Authorization: Bearer <CRON_SECRET>`; webhook do WhatsApp confere a assinatura do corpo.
- Limite de 5 tentativas de login por e-mail a cada 15 min.
- Cabeçalhos: `X-Frame-Options DENY`, `frame-ancestors 'none'`, `nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy`.
- Segredos só nas variáveis da Vercel; RLS ligado nas tabelas.

**A melhorar (por prioridade)**
1. Limite de login guardado em memória vale por instância: mover para o banco.
2. RLS não protege o app (conexão com o dono do banco); o isolamento depende do código. Avaliar papel de banco com RLS por empresa.
3. CSP completa (scripts e estilos) ainda não definida.
4. Trocar o token do Alerta Licitação, que apareceu num print.
5. Registro de auditoria de quem viu e alterou dados sensíveis (CPF, RG, banco).
6. Recuperação de senha e verificação em duas etapas para dono e superadmin.

## Variáveis de ambiente

`DATABASE_URL`, `APP_SECRET`, `CRON_SECRET`, `ALERTAS_CRON_SECRET`, `APP_URL`, `ZERNIO_API_KEY` e segredo do webhook, `ALERTA_LICITACAO_TOKEN`, `ALERTA_LICITACAO_MAX_DIA`, `WA_LIMITE_ALERTAS`, `PROPOSTA_PRONTA_ATIVA`, `DESERTAS_ATIVA`, `WA_ENVIO_UTILIDADE` (as três últimas ligadas por padrão; `false` desliga). Lista completa em `.env.example`.

Histórico de decisões: `docs/LOG.md`.
