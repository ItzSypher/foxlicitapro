-- Histórico do resumo diário por e-mail. O último envio bem-sucedido diz quais oportunidades já foram mostradas.
create table if not exists resumo_envios (
  id          bigint generated always as identity primary key,
  enviado_em  timestamptz not null default now(),
  para        text[] not null default '{}',
  itens       integer not null default 0,
  ids         text[] not null default '{}',   -- ids (numeroControlePNCP) das oportunidades listadas no e-mail
  ok          boolean not null,
  erro        text
);
create index if not exists resumo_envios_em_idx on resumo_envios (enviado_em desc);

alter table resumo_envios enable row level security;
