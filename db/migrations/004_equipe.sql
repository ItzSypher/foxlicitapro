-- Equipe (dono e gestor), autoria no pipeline, revisão de propostas e preferências do "Para você".

create table if not exists usuarios (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  email       text not null unique,
  senha_hash  text not null,                      -- scrypt: "scrypt$N$r$p$salt$hash" (base64url)
  papel       text not null check (papel in ('dono','gestor')),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

alter table pipeline_itens add column if not exists criado_por  uuid references usuarios(id) on delete set null;
alter table pipeline_itens add column if not exists responsavel uuid references usuarios(id) on delete set null;
alter table pipeline_historico add column if not exists usuario_id uuid references usuarios(id) on delete set null;

create table if not exists pipeline_comentarios (
  id          bigint generated always as identity primary key,
  item_id     text not null references pipeline_itens(id) on delete cascade,
  usuario_id  uuid references usuarios(id) on delete set null,
  texto       text not null,
  em          timestamptz not null default now()
);
create index if not exists pipeline_comentarios_item_idx on pipeline_comentarios (item_id, em);

alter table propostas drop constraint if exists propostas_status_check;
alter table propostas add constraint propostas_status_check
  check (status in ('rascunho','em_revisao','aprovada','devolvida','pronta','enviada'));
alter table propostas add column if not exists autor         text not null default 'usuario' check (autor in ('usuario','assistente'));
alter table propostas add column if not exists criado_por    uuid references usuarios(id) on delete set null;
alter table propostas add column if not exists revisado_por  uuid references usuarios(id) on delete set null;
alter table propostas add column if not exists revisao_nota  text;
alter table propostas add column if not exists revisado_em   timestamptz;
alter table propostas add column if not exists analise       jsonb;   -- AnaliseAssistente (core/types-equipe.ts)

create table if not exists preferencias (
  id                          integer primary key check (id = 1),
  termos_prioritarios         text[] not null,
  termos_bloqueados_para_voce text[] not null,
  emails_resumo               text[] not null default '{}',
  resumo_ativo                boolean not null default true,
  atualizado_em               timestamptz not null default now()
);

insert into preferencias (id, termos_prioritarios, termos_bloqueados_para_voce, emails_resumo)
values (
  1,
  array['sistema','software','licenca de software','desenvolvimento de sistema','sistema de gestao',
        'empresa especializada em servicos de ti','servicos de tecnologia da informacao','suporte tecnico',
        'manutencao de computadores','rede logica','cabeamento estruturado','outsourcing de impressao'],
  array['cftv','camera','cameras','videomonitoramento','video monitoramento','monitoramento eletronico','alarme'],
  array['arthurfoxinfo@gmail.com']
)
on conflict (id) do nothing;

alter table usuarios             enable row level security;
alter table pipeline_comentarios enable row level security;
alter table preferencias         enable row level security;
