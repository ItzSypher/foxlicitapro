-- Foco da empresa: termos que o dono escolhe e que valem como o melhor casamento de ramo na nota.
-- Aditiva: nada existente muda. SÓ RODA COM O OK DO DONO DO PROJETO.
-- O código novo lê esta coluna em todo select de empresas: aplique a migration antes de publicar o código.
alter table empresas add column if not exists foco text[] not null default '{}';
