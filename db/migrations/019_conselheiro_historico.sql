-- Histórico do chat do assistente: cada pessoa guarda as próprias conversas e pode continuar ou apagar.
-- Aditiva: nada existente muda. RLS ligada e sem políticas: só o painel (conexão do servidor) lê e grava.

-- 1. Uma conversa por assunto; a lista mostra as mais recentes primeiro.
create table if not exists conselheiro_conversas (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  titulo        text not null check (length(titulo) between 1 and 120),   -- início da primeira pergunta
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists conselheiro_conversas_pessoa_idx
  on conselheiro_conversas (empresa_id, usuario_id, atualizado_em desc);

alter table conselheiro_conversas enable row level security;

-- 2. Cada troca grava a pergunta e a resposta, em ordem.
create table if not exists conselheiro_mensagens (
  id          bigint generated always as identity primary key,
  conversa_id uuid not null references conselheiro_conversas(id) on delete cascade,
  papel       text not null check (papel in ('usuario', 'assistente')),
  texto       text not null check (length(texto) between 1 and 20000),
  rota        text,                                                       -- página em que a pergunta foi feita
  criado_em   timestamptz not null default now()
);
create index if not exists conselheiro_mensagens_conversa_idx on conselheiro_mensagens (conversa_id, id);

alter table conselheiro_mensagens enable row level security;
