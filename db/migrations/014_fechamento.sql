-- Fechamento: o que a licitação rendeu de fato (valor homologado, custo real) e por que se perdeu. Aditiva: nada existente muda.
-- Todas as colunas são opcionais; itens antigos seguem valendo pela proposta ou pelo valor estimado.
alter table pipeline_itens add column if not exists valor_homologado numeric;
alter table pipeline_itens add column if not exists custo_real       numeric;
alter table pipeline_itens add column if not exists fechado_em       timestamptz;  -- quando o fechamento foi registrado pela primeira vez
alter table pipeline_itens add column if not exists motivo_perda     text;         -- preco, documentacao, prazo, desclassificado ou outro
