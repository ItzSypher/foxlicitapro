import { cookies } from "next/headers";
import { connection } from "next/server";
import type { LimitesCaixa } from "@/core/caixa";
import type { RespostaRadar } from "@/core/types";
import { RadarComPipeline } from "@/components/pipeline/radar-com-pipeline";
import { temPermissao } from "@/core/permissoes";
import { idsNoPipeline } from "@/db/pipeline";
import { listarPalavrasChave } from "@/db/palavras-chave";
import { lerSessao } from "@/lib/sessao";
import { lerPreferencias } from "@/db/preferencias";
import { obterRadar } from "@/lib/radar-dados";
import { COOKIE_FRENTE, lerFrente } from "@/lib/frente";
import { COOKIE_VISAO, lerVisao } from "@/lib/radar-filtros";

export default async function RadarPage() {
  await connection();
  const jar = await cookies();
  const frente = lerFrente(jar.get(COOKIE_FRENTE)?.value);
  const visaoInicial = lerVisao(jar.get(COOKIE_VISAO)?.value);

  // Radar e pipeline em paralelo; se o banco falhar, o Radar segue sem marcar os salvos.
  const sessao = await lerSessao();
  const preferencias = await lerPreferencias();
  const limites: LimitesCaixa = { capitalMaximo: preferencias.capitalMaximo, diasMaximosParado: preferencias.diasMaximosParado };
  const [resposta, ids, palavras] = await Promise.all([
    obterRadar(frente, limites).catch((): RespostaRadar | null => null),
    idsNoPipeline().catch((): Set<string> => new Set()),
    sessao ? listarPalavrasChave(sessao.usuarioId).catch((): string[] => []) : Promise.resolve<string[]>([]),
  ]);

  return (
    <RadarComPipeline
      frente={frente}
      resposta={resposta}
      visaoInicial={visaoInicial}
      idsSalvos={[...ids]}
      preferencias={preferencias}
      palavrasSalvas={palavras}
      podeSalvar={sessao !== null && temPermissao(sessao, "mover_pipeline")}
    />
  );
}
