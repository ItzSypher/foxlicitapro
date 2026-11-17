-- Dados padrão da proposta: documento do representante, dados bancários e imagem da assinatura.
-- Aditiva: nada existente muda. Também marca empresas de teste, criadas no Admin sem consulta à Receita.
alter table empresas add column if not exists representante_cpf text;
alter table empresas add column if not exists representante_rg  text;
alter table empresas add column if not exists dados_bancarios   text;   -- texto livre: banco, agência, conta, titular
alter table empresas add column if not exists assinatura        text;   -- data URL PNG ou JPEG, até ~200 KB
alter table empresas add column if not exists teste             boolean not null default false;

alter table empresas drop constraint if exists empresas_assinatura_tamanho;
alter table empresas add constraint empresas_assinatura_tamanho
  check (assinatura is null or (length(assinatura) <= 280000 and assinatura ~ '^data:image/(png|jpeg);base64,'));
