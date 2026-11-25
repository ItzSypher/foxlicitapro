-- Acervo de qualificações e atestados de capacidade técnica assinados pelo cliente.
-- Aditiva: só cria tabelas novas. Aplicada com o ok do dono do projeto (25/11/2026).

-- Acervo: atestados, notas fiscais, contratos, certidões e outros documentos que provam a qualificação da empresa.
create table if not exists acervo_documentos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  tipo          text not null check (tipo in ('atestado', 'nota_fiscal', 'contrato', 'certidao', 'outro')),
  titulo        text not null check (length(titulo) between 1 and 200),
  emissor       text,                      -- cliente ou órgão que emitiu
  emissor_cnpj  text,
  descricao     text,                      -- serviços ou produtos que o documento comprova
  areas         text[] not null default '{}', -- ex.: site, manutencao, redes, suprimentos
  valor         numeric(14, 2),
  periodo_inicio date,
  periodo_fim    date,
  emitido_em    date,
  validade      date,                      -- certidões vencem
  arquivo       bytea,
  arquivo_tipo  text check (arquivo_tipo is null or arquivo_tipo in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  arquivo_nome  text,
  arquivo_tamanho integer check (arquivo_tamanho is null or arquivo_tamanho <= 4194304),
  atestado_id   uuid,                      -- quando veio de um atestado assinado no sistema
  criado_por    uuid references usuarios(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists acervo_documentos_empresa_idx on acervo_documentos (empresa_id, criado_em desc);
alter table acervo_documentos enable row level security;

-- Atestado de capacidade técnica: a empresa redige, o cliente lê, assina na tela e confirma pelo link.
create table if not exists atestados (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references empresas(id) on delete cascade,
  cliente_nome        text not null check (length(cliente_nome) between 1 and 200),
  cliente_cnpj        text,
  cliente_endereco    text,
  responsavel_nome    text,                -- quem assina pelo cliente (pode ser preenchido por ele)
  responsavel_cargo   text,
  responsavel_contato text,                -- e-mail ou telefone, só para referência
  objeto              text not null,       -- serviços prestados
  areas               text[] not null default '{}',
  periodo_inicio      date,
  periodo_fim         date,
  valor               numeric(14, 2),
  texto               text not null,       -- corpo do atestado (redigido pela empresa ou pelo assistente)
  status              text not null default 'rascunho' check (status in ('rascunho', 'aguardando', 'assinado', 'cancelado')),
  token               text unique,
  token_expira        timestamptz,
  codigo              text unique,         -- código curto de verificação impresso no PDF
  assinado_em         timestamptz,
  assinante_nome      text,
  assinante_cargo     text,
  assinante_documento text,                -- CPF de quem assina, opcional
  assinatura          text check (assinatura is null or length(assinatura) <= 400000), -- data URL PNG
  assinatura_ip       text,
  assinatura_agente   text,
  conteudo_hash       text,                -- SHA-256 do texto e dados assinados
  arquivo_assinado    bytea,               -- PDF assinado fora (gov.br), opcional
  arquivo_assinado_tipo text,
  criado_por          uuid references usuarios(id) on delete set null,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

create index if not exists atestados_empresa_idx on atestados (empresa_id, criado_em desc);
alter table atestados enable row level security;

alter table acervo_documentos drop constraint if exists acervo_documentos_atestado_fk;
alter table acervo_documentos add constraint acervo_documentos_atestado_fk
  foreign key (atestado_id) references atestados(id) on delete set null;
