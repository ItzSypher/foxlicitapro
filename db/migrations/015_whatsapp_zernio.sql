-- Fase 5: alertas de WhatsApp pelo Zernio, sempre em conversa individual. Aditiva: nada existente muda.
-- RLS ligada e sem políticas: só o painel (conexão do servidor) lê e grava.

-- 1. Vínculo da pessoa com a conversa do WhatsApp.
alter table usuarios add column if not exists wa_conversa_id     text;         -- conversationId do Zernio
alter table usuarios add column if not exists wa_ultima_entrada  timestamptz;  -- última mensagem recebida da pessoa (abre a janela de 24 h)
alter table usuarios add column if not exists wa_codigo          text;         -- código de ativação ("ATIVAR <código>")
alter table usuarios add column if not exists wa_codigo_expira   timestamptz;
alter table usuarios add column if not exists wa_ultimo_template date;         -- dia (America/Sao_Paulo) do último template pago

create unique index if not exists usuarios_whatsapp_unico on usuarios (whatsapp) where whatsapp is not null;
create unique index if not exists usuarios_wa_codigo_unico on usuarios (wa_codigo) where wa_codigo is not null;

-- 2. Alertas por pessoa: deduplicação (chave única por pessoa) e fila enquanto a janela está fechada.
create table if not exists wa_alertas (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  tipo       text not null,
  chave      text not null,                          -- identifica o fato (ex.: "prazo24:<item>")
  texto      text not null,
  item_id    text,                                   -- item do pipeline, quando houver (botões)
  status     text not null default 'pendente' check (status in ('pendente', 'enviado', 'descartado')),
  validade   timestamptz,                            -- depois disso o alerta não vale mais (prazo vencido)
  criado_em  timestamptz not null default now(),
  enviado_em timestamptz,
  unique (usuario_id, chave)
);
create index if not exists wa_alertas_fila_idx on wa_alertas (usuario_id, status, criado_em);

-- 3. Eventos do webhook já processados (o Zernio reenvia até 7 vezes).
create table if not exists wa_eventos (
  id          text primary key,
  recebido_em timestamptz not null default now()
);

-- 4. Ação que espera "Confirma?" (uma por pessoa).
create table if not exists wa_pendencias (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  acao       jsonb not null,
  expira_em  timestamptz not null
);

-- 5. Configuração do canal (ex.: webhook registrado no Zernio).
create table if not exists wa_config (
  chave         text primary key,
  valor         text not null,
  atualizado_em timestamptz not null default now()
);

alter table wa_alertas    enable row level security;
alter table wa_eventos    enable row level security;
alter table wa_pendencias enable row level security;
alter table wa_config     enable row level security;
