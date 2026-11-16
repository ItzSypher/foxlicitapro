-- Conselheiro: análises do assistente por item do pipeline e exceções de pregão nas preferências. Aditiva: nada existente muda.
-- RLS ligada e sem políticas: só o painel (conexão do servidor) lê e grava.

-- 1. Cada pedido de análise vira uma linha; a tela mostra a mais recente do item.
create table if not exists conselheiro_analises (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  item_id    text not null,                                                   -- numeroControlePNCP do item do pipeline
  criado_em  timestamptz not null default now(),
  criado_por uuid references usuarios(id) on delete set null,
  modelo     text not null,
  resultado  jsonb not null,                                                  -- SaidaConselheiro (lib/conselheiro/esquema.ts)
  foreign key (empresa_id, item_id) references pipeline_itens (empresa_id, id) on delete cascade
);
create index if not exists conselheiro_analises_item_idx on conselheiro_analises (empresa_id, item_id, criado_em desc);
create index if not exists conselheiro_analises_pessoa_idx on conselheiro_analises (criado_por, criado_em desc);

alter table conselheiro_analises enable row level security;

-- 2. Pregão fica fora do foco, salvo objetos que casam com estes termos (sem acento, minúsculos).
alter table preferencias add column if not exists excecoes_pregao text[] not null default array['suporte gerenciado'];
