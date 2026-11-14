-- Fase 4: central de avisos no painel e canais de aviso por pessoa. Aditiva: nada existente muda.
-- RLS ligada e sem políticas: só o painel (conexão do servidor) lê e grava.

-- 1. Canais por pessoa: o painel é sempre; e-mail e WhatsApp dependem da escolha dela.
alter table usuarios add column if not exists whatsapp       text    check (whatsapp is null or whatsapp ~ '^55[0-9]{10,11}$');
alter table usuarios add column if not exists aviso_email    boolean not null default true;
alter table usuarios add column if not exists aviso_whatsapp boolean not null default false;

-- 2. Avisos. usuario_id nulo = todos da empresa (a leitura de cada pessoa fica em avisos_leituras).
create table if not exists avisos (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  usuario_id uuid references usuarios(id) on delete cascade,
  tipo       text not null,
  titulo     text not null,
  corpo      text not null default '',
  link       text,
  chave      text not null,                      -- identifica o fato (ex.: "disputa:<item>"), base da deduplicação
  dia        date not null,                      -- dia (America/Sao_Paulo) em que o aviso foi criado
  lido_em    timestamptz,
  criado_em  timestamptz not null default now()
);
create unique index if not exists avisos_dedup_idx
  on avisos (empresa_id, coalesce(usuario_id, '00000000-0000-0000-0000-000000000000'::uuid), chave, dia);
create index if not exists avisos_lista_idx on avisos (empresa_id, criado_em desc);
create index if not exists avisos_pessoa_idx on avisos (usuario_id, criado_em desc);

create table if not exists avisos_leituras (
  aviso_id   uuid not null references avisos(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  lido_em    timestamptz not null default now(),
  primary key (aviso_id, usuario_id)
);

alter table avisos enable row level security;
alter table avisos_leituras enable row level security;
