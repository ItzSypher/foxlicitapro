-- F4: Radar por áreas escolhidas. Aditiva e idempotente: nada é apagado.
-- 1) empresas.areas = { ufs: [], municipiosIbge: [], base: { uf, municipioIbge } } e radar_tudo_do_ramo.
-- 2) radar_cache passa a ser por (uf, modalidade_id). As linhas antigas viram uf = 'RJ'.
-- Ordem de deploy: aplicar esta migration e publicar o código novo juntos. O código antigo grava com
-- "on conflict (modalidade_id)", que deixa de existir aqui; a coleta antiga falharia até o deploy.

alter table empresas add column if not exists areas jsonb;
alter table empresas add column if not exists radar_tudo_do_ramo boolean not null default false;

-- Empresas existentes: áreas derivadas das regiões atuais.
-- "rj" (interior) vale o estado inteiro; nova-iguacu, capital e baixada viram municípios (códigos IBGE).
-- Município-base: Nova Iguaçu ou Rio de Janeiro quando o nome bate; senão null (a empresa escolhe na tela).
update empresas
   set areas = jsonb_build_object(
     'ufs',
       case
         when regioes @> '["rj"]'::jsonb then '["RJ"]'::jsonb
         when uf <> 'RJ' and uf <> '' and regioes @> '["fora-rj"]'::jsonb then jsonb_build_array(upper(uf))
         else '[]'::jsonb
       end,
     'municipiosIbge',
       case
         when regioes @> '["rj"]'::jsonb then '[]'::jsonb
         else coalesce((
           select jsonb_agg(c)
             from unnest(
               (case when regioes @> '["nova-iguacu"]'::jsonb then array['3303500'] else array[]::text[] end)
               || (case when regioes @> '["capital"]'::jsonb then array['3304557'] else array[]::text[] end)
               || (case when regioes @> '["baixada"]'::jsonb then array[
                    '3301702','3305109','3300456','3303203','3302858','3304144',
                    '3302270','3302502','3301850','3305554','3302007','3303609'
                  ] else array[]::text[] end)
             ) as c
         ), '[]'::jsonb)
       end,
     'base', jsonb_build_object(
       'uf', upper(uf),
       'municipioIbge',
         case
           when upper(municipio) like 'NOVA IGUA%' then '3303500'
           when upper(municipio) = 'RIO DE JANEIRO' then '3304557'
           else null
         end
     )
   )
 where areas is null;

-- Cache por UF e modalidade. A chave primária deixa de ser só a modalidade.
alter table radar_cache add column if not exists uf text not null default 'RJ';
alter table radar_cache drop constraint if exists radar_cache_pkey;
create unique index if not exists radar_cache_uf_modalidade_idx on radar_cache (uf, modalidade_id);
