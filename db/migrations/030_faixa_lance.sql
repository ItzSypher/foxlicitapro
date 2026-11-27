-- Faixa do lance: preco_lance passa a ser o "de" (menor valor que a empresa aceita dar) e preco_lance_max o "até".
-- Aditiva e idempotente. Aplicar com `npm run db:migrar` só com o ok do dono do projeto.
alter table pipeline_itens add column if not exists preco_lance_max numeric(14, 2);
alter table pipeline_itens drop constraint if exists pipeline_itens_preco_lance_max_positivo;
alter table pipeline_itens add constraint pipeline_itens_preco_lance_max_positivo check (preco_lance_max is null or preco_lance_max >= 0);
