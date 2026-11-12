-- Propostas comerciais salvas, com link público opcional para enviar a terceiros.
create table if not exists propostas (
  id            uuid primary key default gen_random_uuid(),
  compra_id     text,                              -- numeroControlePNCP
  pipeline_id   text references pipeline_itens(id) on delete set null,
  modelo        text not null,                     -- id do modelo em core/proposta-modelos.ts
  titulo        text not null,
  dados         jsonb not null,                    -- DadosProposta (core/types-detalhe.ts)
  total         numeric(14,2) not null default 0,
  status        text not null default 'rascunho' check (status in ('rascunho','pronta','enviada')),
  token_publico text unique,                       -- preenchido ao compartilhar
  token_expira  timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists propostas_compra_idx on propostas (compra_id, atualizado_em desc);
alter table propostas enable row level security;
