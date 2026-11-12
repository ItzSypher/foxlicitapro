-- Última consulta boa do PNCP, por modalidade. O Radar lê daqui e atualiza em segundo plano,
-- então o painel abre na hora mesmo com o PNCP lento ou recusando consultas (HTTP 429).
create table if not exists radar_cache (
  modalidade_id  integer primary key check (modalidade_id in (6, 8)),
  oportunidades  jsonb not null,                   -- Oportunidade[] já normalizadas, sem score
  total          integer not null,
  atualizado_em  timestamptz not null,             -- última coleta completa ou mesclada
  falhou_em      timestamptz                       -- última tentativa que falhou
);

-- Trava simples para não disparar duas coletas ao mesmo tempo.
create table if not exists radar_trava (
  id   integer primary key check (id = 1),
  em   timestamptz not null
);

alter table radar_cache enable row level security;
alter table radar_trava enable row level security;
