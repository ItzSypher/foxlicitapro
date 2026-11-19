-- Gestor de várias empresas: uma pessoa (usuarios.empresa_id é a "própria") passa a acessar outras empresas com o mesmo login.
-- Aditiva e idempotente. NÃO aplicada: rodar com `npm run db:migrar` só com o ok do usuário.
-- Empresa sem dono: nenhuma restrição no banco exige um usuário 'dono' por empresa (a regra "sempre um dono ativo"
-- vive só nas funções de db/usuarios.ts, que protegem a troca/desativação de donos existentes). Nada a alterar aqui.

create table if not exists usuario_empresas (
  usuario_id uuid not null references usuarios(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (usuario_id, empresa_id)
);

create index if not exists usuario_empresas_empresa_idx on usuario_empresas (empresa_id);

alter table usuario_empresas enable row level security;
