-- Fase 2: limites de caixa, revisão jurídica no Kanban e preço dos concorrentes.
-- Aditiva. RLS ligada e sem políticas: só o painel (conexão do servidor) lê e grava.

-- 1. Limites de caixa do dono (nulos = sem limite).
alter table preferencias add column if not exists capital_maximo      numeric(14,2) check (capital_maximo is null or capital_maximo >= 0);
alter table preferencias add column if not exists dias_maximos_parado integer       check (dias_maximos_parado is null or dias_maximos_parado >= 0);

-- 2. Nova etapa "revisao_juridica" (antes de "proposta").
alter table pipeline_itens drop constraint if exists pipeline_itens_etapa_check;
alter table pipeline_itens add constraint pipeline_itens_etapa_check
  check (etapa in ('radar','analisando','cotando','revisao_juridica','proposta','disputa','ganha','perdida'));

-- 3. Checklist jurídico: uma linha por passo marcado, com quem marcou e quando.
create table if not exists revisao_juridica_passos (
  item_id    text not null references pipeline_itens(id) on delete cascade,
  passo      text not null check (passo in ('habilitacao','clausulas_risco','garantia_multas','prazos')),
  marcado_por uuid references usuarios(id) on delete set null,
  marcado_em  timestamptz not null default now(),
  primary key (item_id, passo)
);

-- 4. Preço dos concorrentes: contratações homologadas vistas no PNCP (cache de 7 dias, por id do PNCP).
create table if not exists concorrentes_cache (
  id_pncp          text primary key,                  -- numeroControlePNCP da contratação encontrada
  objeto           text not null,
  uf               text not null default '',
  orgao            text not null default '',
  modalidade_id    integer,
  valor_estimado   numeric(16,2),
  valor_homologado numeric(16,2) not null,
  publicada_em     timestamptz,
  link             text not null,
  buscado_em       timestamptz not null default now()
);

create index if not exists concorrentes_cache_buscado_idx on concorrentes_cache (buscado_em);

-- Última busca feita para cada licitação (evita refazer as chamadas ao PNCP dentro de 7 dias).
create table if not exists concorrentes_buscas (
  id_pncp      text primary key,                      -- licitação que originou a busca
  buscado_em   timestamptz not null default now(),
  requisicoes  integer not null default 0,
  falhas       integer not null default 0
);

alter table revisao_juridica_passos enable row level security;
alter table concorrentes_cache      enable row level security;
alter table concorrentes_buscas     enable row level security;
