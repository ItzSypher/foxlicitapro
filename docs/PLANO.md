# Próximas fases

Atualizado em 19/11/2026. Cada fase é um commit e um deploy.

## V1 — Tela de login
- Tela dividida: à esquerda (no PC) a marca e 3 benefícios com ícones animados ("Licitações do seu ramo todo dia", "Proposta pronta em minutos", "Aviso no WhatsApp"); à direita o formulário.
- No celular, só o formulário com o cabeçalho de marca e um fundo animado leve.
- Mostrar/ocultar senha, aviso de Caps Lock, "esqueci minha senha" (envio por e-mail), mensagem de erro clara e bloqueio após tentativas.

## V2 — Vida na tela
- Biblioteca `motion` (Framer Motion) para entradas, listas e números. É uma dependência nova.
- Entrada escalonada dos cards; contadores que sobem; selos pulsando para "Nova", "Fecha hoje", "Deserta" e "Proposta pronta".
- Central de novidades no sino: novas do ramo, desertas, proposta pronta, movimento do gestor. Contador em badge e toast ao chegar algo novo (verificação a cada 2 min com a tela aberta).
- Respeitar "reduzir movimento" do sistema.

## V3 — Tour guiado
- Tour por tela (Radar, Pipeline, Propostas, Empresa), com balão apontando o elemento, ícone e uma frase. O tour roda na primeira visita e pode ser reaberto pelo menu.
- Tour do gestor: seletor de empresa e resumo único no WhatsApp.

## V4 — Celular e gestor
- Revisar Radar, Pipeline, Licitação e Admin a 375 px (Propostas já revisada).
- Painel do gestor:
  - visão "Minhas empresas" com cartão por cliente (meta da semana, itens em disputa, prazos de hoje, última atividade);
  - troca de empresa com um toque;
  - visão do dono simplificada, só acompanhamento.

## S1 — Segurança
Ver "A melhorar" em `docs/SISTEMA.md`:
- limite de login no banco;
- CSP completa;
- troca do token do Alerta Licitação;
- auditoria;
- recuperação de senha.

## Comercial (planejamento, sem código agora)
- Acompanhamento no CNPJ do cliente.
- Pilotos sem valor fixo.
- Preço e contrato dos próximos clientes a definir.
