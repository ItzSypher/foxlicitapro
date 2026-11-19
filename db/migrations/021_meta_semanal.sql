-- Meta semanal de disputas: mínimo e ideal por empresa. Aditiva: nada existente muda.
-- Sem esta migration o sistema usa 5 e 10.
alter table empresas add column if not exists meta_disputas_min   int not null default 5  check (meta_disputas_min between 1 and 500);
alter table empresas add column if not exists meta_disputas_ideal int not null default 10 check (meta_disputas_ideal between 1 and 500);

alter table empresas drop constraint if exists empresas_meta_ideal_maior;
alter table empresas add constraint empresas_meta_ideal_maior check (meta_disputas_ideal >= meta_disputas_min);
