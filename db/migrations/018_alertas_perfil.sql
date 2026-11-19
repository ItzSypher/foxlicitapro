-- WhatsApp por papel: perfil de alerta de cada pessoa e responsável padrão da empresa. Aditiva: nada existente muda.

-- 1. Perfil de alerta e escolhas da pessoa (tela Alertas).
--    Formato: {"perfil": "operacional" | "acompanhamento", "prazos": bool, "novas": bool, "fechando": bool,
--              "aguardando": bool, "pendencias": bool, "movimentos": bool, "disputa": bool, "grandes": bool,
--              "meta": bool, "valorGrande": number}
--    null = padrão do papel (dono acompanha; gestor e jurídico operam).
alter table usuarios add column if not exists wa_perfil_alerta jsonb;

-- 2. Pessoa que recebe o item quando alguém toca "Atribuir a ..." no alerta (tela Equipe).
--    null = quem tocou o botão.
alter table empresas add column if not exists wa_responsavel_padrao uuid references usuarios(id) on delete set null;
