-- Acessos: papel jurídico, permissões por pessoa, limite diário do assistente e palavras-chave do Radar.

alter table usuarios drop constraint if exists usuarios_papel_check;
alter table usuarios add constraint usuarios_papel_check check (papel in ('dono','gestor','juridico'));

alter table usuarios add column if not exists permissoes text[] not null default '{}';
alter table usuarios add column if not exists limite_propostas_assistente_dia integer not null default 3
  check (limite_propostas_assistente_dia >= 0);

-- Quem já era gestor mantém o que fazia antes.
update usuarios
   set permissoes = array['mover_pipeline','editar_propostas','aprovar_propostas','usar_assistente']
 where papel = 'gestor' and permissoes = '{}';

create table if not exists palavras_chave (
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  termo       text not null,
  criado_em   timestamptz not null default now(),
  primary key (usuario_id, termo)
);

alter table palavras_chave enable row level security;
