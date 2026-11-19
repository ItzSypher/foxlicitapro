-- Proposta com prova e resultado: linha do tempo (quem fez o quê e quando), comprovante de envio,
-- proposta enviada fora do sistema e resultado lido do PNCP. Aditiva: nada existente muda.
-- RLS ligada e sem políticas: só o painel (conexão do servidor) lê e grava.

-- 1. Linha do tempo da proposta, visível para todos da empresa.
create table if not exists proposta_eventos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id),
  proposta_id uuid not null references propostas(id) on delete cascade,
  tipo        text not null check (tipo in ('criada', 'revisao', 'devolvida', 'aprovada', 'enviada', 'resultado')),
  por         uuid references usuarios(id) on delete set null,   -- null = rotina automática (resultado do PNCP)
  em          timestamptz not null default now(),
  nota        text check (nota is null or length(nota) <= 1000),
  protocolo   text check (protocolo is null or length(protocolo) <= 120),  -- número do protocolo no portal
  comprovante text,                                               -- data URL (imagem ou PDF), até ~600 KB
  dados       jsonb                                               -- resultado: situação, vencedor e valor
);
create index if not exists proposta_eventos_proposta_idx on proposta_eventos (empresa_id, proposta_id, em);

alter table proposta_eventos drop constraint if exists proposta_eventos_comprovante_formato;
alter table proposta_eventos add constraint proposta_eventos_comprovante_formato
  check (comprovante is null or (length(comprovante) <= 850000
         and comprovante ~ '^data:(image/(png|jpeg|webp)|application/pdf);base64,'));

-- 2. Envio e resultado na própria proposta (para a lista e o filtro "Enviadas sem resultado").
alter table propostas add column if not exists enviada_em              timestamptz;
alter table propostas add column if not exists enviada_por             uuid references usuarios(id) on delete set null;
alter table propostas add column if not exists externa                 boolean not null default false;  -- registrada depois de enviada fora do sistema
alter table propostas add column if not exists portal                  text;
alter table propostas add column if not exists resultado               text check (resultado is null or resultado in ('aguardando', 'ganhou', 'perdeu'));
alter table propostas add column if not exists resultado_vencedor      text;
alter table propostas add column if not exists resultado_valor         numeric(14,2);
alter table propostas add column if not exists resultado_em            timestamptz;   -- quando o resultado final foi gravado
alter table propostas add column if not exists resultado_consultado_em timestamptz;   -- última consulta ao PNCP

create index if not exists propostas_sem_resultado_idx
  on propostas (empresa_id, enviada_em)
  where status = 'enviada' and (resultado is null or resultado = 'aguardando');

-- Propostas já enviadas antes desta migration: a data do envio é a última atualização.
update propostas set enviada_em = atualizado_em where status = 'enviada' and enviada_em is null;

alter table proposta_eventos enable row level security;
