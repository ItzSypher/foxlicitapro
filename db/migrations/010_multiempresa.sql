-- Fase 3: multiempresa em banco único. Aditiva e segura com os dados existentes: nada é apagado.
-- A empresa que já usa o painel vira a primeira linha de empresas e recebe todas as linhas existentes.
-- radar_cache, radar_trava, fichas_edital, concorrentes_cache e concorrentes_buscas continuam compartilhadas (dados públicos).

create table if not exists empresas (
  id            uuid primary key default gen_random_uuid(),
  cnpj          text not null unique check (cnpj ~ '^[0-9]{14}$'),   -- só dígitos
  razao_social  text not null,
  nome_fantasia text,
  porte         text not null default 'demais' check (porte in ('mei','me','epp','demais')),
  uf            text not null default '',
  municipio     text not null default '',
  cnaes         jsonb not null default '[]'::jsonb,    -- [{codigo, descricao, frente, principal}]
  regioes       jsonb not null default '[]'::jsonb,    -- ["nova-iguacu","baixada","capital","rj","fora-rj"]
  ativa         boolean not null default true,
  criada_em     timestamptz not null default now(),
  data_abertura date,
  endereco      text,
  cep           text,
  telefone      text,
  email_contato text,
  responsavel   text
);
alter table empresas enable row level security;

insert into empresas (cnpj, razao_social, porte, uf, municipio, cnaes, regioes, data_abertura, endereco, cep, telefone, email_contato, responsavel)
values (
  '70048886000129',
  '70.048.886 ARTHUR SILVA MOURA',
  'mei',
  'RJ',
  'Nova Iguaçu',
  '[{"codigo":"95.11-8-00","descricao":"Manutenção de computadores e periféricos","frente":"servicos","principal":true},{"codigo":"43.21-5-00","descricao":"Instalação e manutenção elétrica, segurança eletrônica e CFTV","frente":"servicos","principal":false},{"codigo":"61.90-6-99","descricao":"Redes de computadores e telecomunicações","frente":"servicos","principal":false},{"codigo":"85.99-6-03","descricao":"Treinamento em informática","frente":"servicos","principal":false},{"codigo":"82.19-9-99","descricao":"Apoio administrativo, preparação de documentos e digitação","frente":"servicos","principal":false},{"codigo":"58.19-1-00","descricao":"Edição de cadastros e listas","frente":"servicos","principal":false},{"codigo":"47.51-2-01","descricao":"Equipamentos e suprimentos de informática","frente":"produtos","principal":false},{"codigo":"47.52-1-00","descricao":"Telefonia e comunicação","frente":"produtos","principal":false},{"codigo":"47.42-3-00","descricao":"Material elétrico","frente":"produtos","principal":false},{"codigo":"47.53-9-00","descricao":"Eletrodomésticos e áudio/vídeo","frente":"produtos","principal":false},{"codigo":"47.89-0-07","descricao":"Equipamentos para escritório","frente":"produtos","principal":false},{"codigo":"47.44-0-01","descricao":"Ferragens e ferramentas","frente":"produtos","principal":false},{"codigo":"47.57-1-00","descricao":"Peças para aparelhos eletroeletrônicos","frente":"produtos","principal":false},{"codigo":"47.41-5-00","descricao":"Tintas e materiais para pintura","frente":"produtos","principal":false},{"codigo":"47.89-0-05","descricao":"Saneantes e produtos de limpeza","frente":"produtos","principal":false},{"codigo":"47.89-0-99","descricao":"Outros produtos e embalagens","frente":"produtos","principal":false}]'::jsonb,
  '["nova-iguacu","baixada","capital","rj"]'::jsonb,
  '2026-11-09',
  'Rua João Batista Rodrigues, 70, Casa, Da Luz',
  '26260-340',
  '(21) 9942-9781',
  'arthurfoxinfo@gmail.com',
  'Arthur Silva Moura'
)
on conflict (cnpj) do nothing;

-- Usuários: empresa e flag de superadmin (o dono mais antigo administra as empresas).
alter table usuarios add column if not exists superadmin boolean not null default false;

-- empresa_id em todas as tabelas de dados da empresa: preenche com a empresa de origem e só então exige.
do $$
declare
  origem uuid;
  tabela text;
begin
  select id into origem from empresas where cnpj = '70048886000129';
  foreach tabela in array array['usuarios','pipeline_itens','pipeline_historico','pipeline_comentarios','cotacoes',
                                'propostas','preferencias','palavras_chave','revisao_juridica_passos','resumo_envios']
  loop
    execute format('alter table %I add column if not exists empresa_id uuid references empresas(id)', tabela);
    execute format('update %I set empresa_id = %L where empresa_id is null', tabela, origem);
    execute format('alter table %I alter column empresa_id set not null', tabela);
    execute format('create index if not exists %I on %I (empresa_id)', tabela || '_empresa_idx', tabela);
  end loop;
end $$;

update usuarios set superadmin = true
 where id = (select id from usuarios where papel = 'dono' order by criado_em asc limit 1);

-- pipeline_itens: o id é o numeroControlePNCP e duas empresas podem salvar a mesma licitação.
-- A chave passa a ser (empresa_id, id) e as tabelas filhas apontam para o par.
do $$
declare
  c record;
begin
  for c in select conrelid::regclass as tabela, conname from pg_constraint
            where contype = 'f' and confrelid = 'pipeline_itens'::regclass
  loop
    execute format('alter table %s drop constraint %I', c.tabela, c.conname);
  end loop;
end $$;

alter table pipeline_itens drop constraint if exists pipeline_itens_pkey;
alter table pipeline_itens add primary key (empresa_id, id);

alter table pipeline_historico add constraint pipeline_historico_item_fk
  foreign key (empresa_id, item_id) references pipeline_itens (empresa_id, id) on delete cascade;
alter table pipeline_comentarios add constraint pipeline_comentarios_item_fk
  foreign key (empresa_id, item_id) references pipeline_itens (empresa_id, id) on delete cascade;

alter table revisao_juridica_passos drop constraint if exists revisao_juridica_passos_pkey;
alter table revisao_juridica_passos add primary key (empresa_id, item_id, passo);
alter table revisao_juridica_passos add constraint revisao_juridica_passos_item_fk
  foreign key (empresa_id, item_id) references pipeline_itens (empresa_id, id) on delete cascade;

alter table cotacoes add constraint cotacoes_item_fk
  foreign key (empresa_id, item_id) references pipeline_itens (empresa_id, id) on delete set null (item_id);
alter table propostas add constraint propostas_pipeline_fk
  foreign key (empresa_id, pipeline_id) references pipeline_itens (empresa_id, id) on delete set null (pipeline_id);

-- Preferências: uma linha por empresa (antes, linha única com id = 1; a coluna id fica como legado).
alter table preferencias drop constraint if exists preferencias_id_check;
alter table preferencias drop constraint if exists preferencias_pkey;
alter table preferencias alter column id drop not null;
alter table preferencias add primary key (empresa_id);
