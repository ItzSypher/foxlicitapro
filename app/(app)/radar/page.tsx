import { cookies } from "next/headers";
import { connection } from "next/server";
import type { RespostaRadar } from "@/core/types";
import { RadarComPipeline } from "@/components/pipeline/radar-com-pipeline";
import { idsNoPipeline } from "@/db/pipeline";
import { obterRadar } from "@/lib/radar-dados";
import { COOKIE_FRENTE, lerFrente } from "@/lib/frente";
import { COOKIE_VISAO, lerVisao } from "@/lib/radar-filtros";

export default async function RadarPage() {
  await connection();
  const jar = await cookies();
  const frente = lerFrente(jar.get(COOKIE_FRENTE)?.value);
  const visaoInicial = lerVisao(jar.get(COOKIE_VISAO)?.value);

  // Radar e pipeline em paralelo; se o banco falhar, o Radar segue sem marcar os salvos.
  const [resposta, ids] = await Promise.all([
    obterRadar(frente).catch((): RespostaRadar | null => null),
    idsNoPipeline().catch((): Set<string> => new Set()),
  ]);

  return (
    <RadarComPipeline frente={frente} resposta={resposta} visaoInicial={visaoInicial} idsSalvos={[...ids]} />
  );
}
