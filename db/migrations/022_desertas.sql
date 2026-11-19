-- F7: dispensas que terminaram sem vencedor (itens desertos ou fracassados), coletadas pelo cron diário.
-- Aditiva e idempotente. NÃO aplicada: rodar com `npm run db:migrar` só com o ok do usuário.

create table if not exists radar_desertas (
  id               text primary key,                 -- numeroControlePNCP da compra
  uf               text not null,
  codigo_ibge      text not null default '',
  municipio        text not null default '',
  orgao            text not null default '',
  orgao_cnpj       text not null default '',
  unidade          text not null default '',
  objeto           text not null,                    -- objeto da compra mais a descrição dos itens sem vencedor
  valor_estimado   numeric(16, 2),                   -- soma dos itens sem vencedor; null se sigiloso
  itens_sem_vencedor integer not null,
  total_itens      integer not null,
  situacao         text not null,                    -- 'deserta' | 'fracassada' | 'mista'
  deserta_em       timestamptz not null,             -- quando o item passou a constar sem vencedor (aproximado)
  ano_compra       integer not null,
  sequencial_compra integer not null,
  link_pncp        text not null,
  coletada_em      timestamptz not null default now()
);

create index if not exists radar_desertas_uf_data_idx on radar_desertas (uf, deserta_em desc);

-- Até que dia (inclusive) a coleta já olhou as dispensas publicadas, por UF.
create table if not exists radar_desertas_varredura (
  uf             text primary key,
  ate            date not null,
  atualizado_em  timestamptz not null default now()
);

alter table radar_desertas enable row level security;
alter table radar_desertas_varredura enable row level security;
