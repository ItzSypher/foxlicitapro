import type { CodigoCnae } from "./empresa";

export interface MargemSugerida {
  /** Margem mínima aceitável, fração do preço de venda (0,12 = 12%) */
  minima: number;
  /** Margem alvo, fração do preço de venda */
  alvo: number;
  justificativa: string;
}

/**
 * Margens sugeridas por CNAE, como fração do preço de venda.
 * Commodities de informática têm concorrência alta e margem curta;
 * serviços têm custo baixo de insumo e margem maior.
 */
export const MARGENS_POR_CNAE: Readonly<Record<CodigoCnae, MargemSugerida>> = {
  "47.51-2-01": { minima: 0.12, alvo: 0.18, justificativa: "Commodity de informática, muitos fornecedores e preço comparável: margem curta." },
  "47.52-1-00": { minima: 0.12, alvo: 0.18, justificativa: "Telefonia e comunicação têm preço de referência público e disputa acirrada." },
  "47.53-9-00": { minima: 0.1, alvo: 0.15, justificativa: "Eletrodomésticos e áudio/vídeo têm marcas conhecidas e grandes varejistas disputando." },
  "47.89-0-07": { minima: 0.15, alvo: 0.22, justificativa: "Material de escritório é comum, mas o item variado permite uma margem um pouco maior." },
  "47.41-5-00": { minima: 0.15, alvo: 0.22, justificativa: "Tintas têm peso e frete relevantes, e a margem cobre perdas e variação de cor." },
  "47.42-3-00": { minima: 0.18, alvo: 0.25, justificativa: "Material elétrico tem variedade de itens e menos disputa por especificação técnica." },
  "47.89-0-05": { minima: 0.18, alvo: 0.25, justificativa: "Saneantes têm giro alto e volume, e a margem cobre frete e validade." },
  "47.89-0-99": { minima: 0.18, alvo: 0.25, justificativa: "Embalagens e itens diversos têm mercado fragmentado e preço menos comparável." },
  "47.44-0-01": { minima: 0.2, alvo: 0.28, justificativa: "Ferragens e ferramentas têm muitos itens pequenos e pouca comparação direta de preço." },
  "47.57-1-00": { minima: 0.2, alvo: 0.3, justificativa: "Peças de reposição exigem busca e compatibilidade, com poucos concorrentes por item." },
  "95.11-8-00": { minima: 0.35, alvo: 0.5, justificativa: "Serviço com custo de insumo baixo: o valor está na mão de obra e na experiência." },
  "43.21-5-00": { minima: 0.3, alvo: 0.45, justificativa: "Serviço técnico com deslocamento e material pequeno, margem alta sobre a mão de obra." },
  "61.90-6-99": { minima: 0.3, alvo: 0.45, justificativa: "Serviço técnico de rede com material pequeno e mão de obra especializada." },
  "82.19-9-99": { minima: 0.3, alvo: 0.4, justificativa: "Serviço administrativo com custo quase todo em tempo, e concorrência maior que a técnica." },
  "58.19-1-00": { minima: 0.35, alvo: 0.5, justificativa: "Serviço intelectual sem insumo físico relevante: o custo é só o tempo de trabalho." },
  "85.99-6-03": { minima: 0.45, alvo: 0.6, justificativa: "Treinamento tem custo marginal baixo por aluno e alto valor percebido." },
};
