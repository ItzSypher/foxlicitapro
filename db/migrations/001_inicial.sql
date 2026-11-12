-- Esquema inicial do FoxLicita Pro.
-- O painel conecta pelo servidor com o usuário dono das tabelas.
-- RLS fica ligado e sem políticas: a Data API pública do Supabase não lê nem grava nada.

create table if not exists pipeline_itens (
  id            text primary key,                 -- numeroControlePNCP
  etapa         text not null default 'radar'
                check (etapa in ('radar','analisando','cotando','proposta','disputa','ganha','perdida')),
  ordem         double precision not null default 0,
  dados         jsonb not null,                   -- OportunidadeComScore no momento em que foi salva
  score         integer not null,
  faixa         text not null check (faixa in ('go','atencao','nogo')),
  valor_estimado numeric(14,2),
  data_encerramento timestamptz not null,
  notas         text not null default '',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists pipeline_itens_etapa_idx on pipeline_itens (etapa, ordem);

create table if not exists pipeline_historico (
  id            bigint generated always as identity primary key,
  item_id       text not null references pipeline_itens(id) on delete cascade,
  de            text,
  para          text not null,
  em            timestamptz not null default now()
);

create table if not exists cotacoes (
  id            uuid primary key default gen_random_uuid(),
  item_id       text references pipeline_itens(id) on delete set null,
  descricao     text not null,
  frente        text not null check (frente in ('servicos','produtos')),
  cnae          text,
  regime        text not null check (regime in ('mei','simples')),
  entrada       jsonb not null,                   -- EntradaPrecificacao
  resultado     jsonb not null,                   -- CalculoPrecificacao
  preco_minimo  numeric(14,2) not null,
  preco_alvo    numeric(14,2) not null,
  criado_em     timestamptz not null default now()
);

create index if not exists cotacoes_item_idx on cotacoes (item_id, criado_em desc);

create table if not exists _migracoes (
  nome          text primary key,
  aplicada_em   timestamptz not null default now()
);

alter table pipeline_itens     enable row level security;
alter table pipeline_historico enable row level security;
alter table cotacoes           enable row level security;
alter table _migracoes         enable row level security;
