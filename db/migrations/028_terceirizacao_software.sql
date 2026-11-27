-- Comissão opcional e conta de software (terceirização do dev).
-- Aditiva e idempotente. Aplicada com o ok do dono do projeto (27/11/2026).

-- A comissão deixa de entrar sozinha: no item, null passa a ser "sem comissão".
-- Na empresa, o campo vira o percentual que aparece ao marcar "Tem comissão" (10%, não 12%).
alter table empresas alter column comissao_percentual set default 10;
update empresas set comissao_percentual = 10 where comissao_percentual = 12;

-- Terceirização em site, sistema e software: null enquanto ninguém respondeu.
alter table pipeline_itens add column if not exists terceirizavel boolean;
-- Total combinado com o dev e em quantas parcelas ele recebe.
alter table pipeline_itens add column if not exists dev_custo numeric(14, 2);
alter table pipeline_itens add column if not exists dev_parcelas smallint;
-- Meses de contrato (null = entrega única).
alter table pipeline_itens add column if not exists contrato_meses smallint;

alter table pipeline_itens drop constraint if exists pipeline_itens_dev_custo_positivo;
alter table pipeline_itens add constraint pipeline_itens_dev_custo_positivo check (dev_custo is null or dev_custo >= 0);
alter table pipeline_itens drop constraint if exists pipeline_itens_dev_parcelas_faixa;
alter table pipeline_itens add constraint pipeline_itens_dev_parcelas_faixa check (dev_parcelas is null or dev_parcelas between 1 and 60);
alter table pipeline_itens drop constraint if exists pipeline_itens_contrato_meses_faixa;
alter table pipeline_itens add constraint pipeline_itens_contrato_meses_faixa check (contrato_meses is null or contrato_meses between 1 and 120);
