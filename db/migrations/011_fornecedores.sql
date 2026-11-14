-- Fornecedores por empresa e o histórico de preços que cada um praticou. Aditiva: nada existente muda.

create table if not exists fornecedores (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id),
  nome          text not null,
  cnpj          text check (cnpj is null or cnpj ~ '^[0-9]{14}$'),   -- só dígitos, opcional
  contato       text not null default '',
  telefone      text not null default '',
  email         text not null default '',
  site          text not null default '',
  categorias    text not null default '',     -- categorias ou palavras separadas por vírgula
  observacao    text not null default '',
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, empresa_id)
);
create index if not exists fornecedores_empresa_idx on fornecedores (empresa_id, nome);

create table if not exists fornecedor_precos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id),
  fornecedor_id uuid not null,
  descricao     text not null,
  unidade       text not null default 'un',
  preco         numeric(14,2) not null check (preco >= 0),
  prazo_dias    integer check (prazo_dias is null or prazo_dias >= 0),
  data          date not null default current_date,
  origem        text not null default 'manual' check (origem in ('manual','cotacao')),
  criado_em     timestamptz not null default now(),
  -- o fornecedor precisa ser da mesma empresa do preço
  foreign key (fornecedor_id, empresa_id) references fornecedores (id, empresa_id) on delete cascade
);
create index if not exists fornecedor_precos_empresa_idx on fornecedor_precos (empresa_id, data desc);
create index if not exists fornecedor_precos_fornecedor_idx on fornecedor_precos (fornecedor_id, data desc);

alter table fornecedores enable row level security;
alter table fornecedor_precos enable row level security;
