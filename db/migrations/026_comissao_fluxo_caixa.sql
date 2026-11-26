-- Comissão do gestor sobre o bruto e dados do fluxo de caixa das licitações ganhas.
-- Aditiva: só acrescenta colunas. Aplicada com o ok do dono do projeto (26/11/2026).

-- Comissão padrão de quem opera as licitações (percentual sobre o valor bruto).
alter table empresas add column if not exists comissao_percentual numeric(5, 2) not null default 12;
alter table empresas drop constraint if exists empresas_comissao_percentual_faixa;
alter table empresas add constraint empresas_comissao_percentual_faixa check (comissao_percentual between 0 and 30);

-- Ajuste da comissão numa licitação (null usa o padrão da empresa).
alter table pipeline_itens add column if not exists comissao_percentual numeric(5, 2);
alter table pipeline_itens drop constraint if exists pipeline_itens_comissao_percentual_faixa;
alter table pipeline_itens add constraint pipeline_itens_comissao_percentual_faixa
  check (comissao_percentual is null or comissao_percentual between 0 and 30);

-- Fluxo de caixa: previsão (null usa o prazo de pagamento do edital) e o que de fato entrou.
alter table pipeline_itens add column if not exists pagamento_previsto date;
alter table pipeline_itens add column if not exists recebido_em date;
alter table pipeline_itens add column if not exists valor_recebido numeric(14, 2);
alter table pipeline_itens drop constraint if exists pipeline_itens_valor_recebido_positivo;
alter table pipeline_itens add constraint pipeline_itens_valor_recebido_positivo
  check (valor_recebido is null or valor_recebido >= 0);
