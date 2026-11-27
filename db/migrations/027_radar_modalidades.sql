-- Radar: o cache passa a aceitar mais modalidades do PNCP, além do pregão eletrônico (6) e da dispensa (8).
-- Novos códigos: 4 concorrência eletrônica, 5 concorrência presencial, 7 pregão presencial, 12 credenciamento.
-- Aditiva e idempotente: só troca o CHECK por um que aceita os códigos antigos e os novos; nenhuma linha muda.
-- Sem esta migração a coleta segue funcionando só com 6 e 8 (a gravação das novas é ignorada).

alter table radar_cache drop constraint if exists radar_cache_modalidade_id_check;
alter table radar_cache add constraint radar_cache_modalidade_id_check
  check (modalidade_id = any (array[4, 5, 6, 7, 8, 12]));
