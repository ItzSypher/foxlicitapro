-- Ficha do edital gerada pelo assistente: uma por edital, compartilhada por toda a equipe.
create table if not exists fichas_edital (
  id_pncp        text primary key,                                  -- numeroControlePNCP
  ficha          jsonb not null,                                    -- FichaEdital (core/ficha.ts)
  gerada_em      timestamptz not null default now(),
  gerada_por     uuid references usuarios(id) on delete set null,
  confirmada_por uuid references usuarios(id) on delete set null,
  confirmada_em  timestamptz
);

alter table fichas_edital enable row level security;
