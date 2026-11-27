-- Conta de serviço: preço do lance e horas próprias por mês.
-- Aditiva e idempotente. Aplicar com `npm run db:migrar` só com o ok do dono do projeto.

-- Preço que a empresa vai dar no lance (null = ninguém disse; a conta usa o preço mínimo).
alter table pipeline_itens add column if not exists preco_lance numeric(14, 2);
-- Horas por mês que o próprio dono gasta quando não terceiriza (cada hora custa R$ 175 na conta).
alter table pipeline_itens add column if not exists horas_mes smallint;

alter table pipeline_itens drop constraint if exists pipeline_itens_preco_lance_positivo;
alter table pipeline_itens add constraint pipeline_itens_preco_lance_positivo check (preco_lance is null or preco_lance >= 0);
alter table pipeline_itens drop constraint if exists pipeline_itens_horas_mes_faixa;
alter table pipeline_itens add constraint pipeline_itens_horas_mes_faixa check (horas_mes is null or horas_mes between 1 and 744);
