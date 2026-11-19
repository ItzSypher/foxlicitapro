import { connection } from "next/server";
import { formatarWhatsapp } from "@/core/whatsapp";
import { janelaAberta, lerEscolhas, tituloAtribuir } from "@/core/whatsapp-alertas";
import {
  lerResponsavelPadrao,
  lerUltimosResumos,
  lerVinculoPorUsuario,
  listarAvisosRecentes,
  listarVinculosDaEmpresa,
} from "@/db/whatsapp";
import { exigirSessao } from "@/lib/sessao";
import { ControlesWhatsapp } from "./controles";
import { LigarWhatsapp } from "./ligar-whatsapp";
import { PerfilAlertaForm } from "./perfil-alerta";
import { SituacaoWhatsapp } from "./situacao-whatsapp";

const AVISOS_RECENTES = 5;

export const metadata = { title: "Alertas · FoxLicita Pro" };

const CARTAO = "flex flex-col gap-3 rounded-card border border-border bg-surface p-4";

export default async function AlertasPage() {
  await connection();
  const sessao = await exigirSessao();
  const [vinculo, padrao] = await Promise.all([
    lerVinculoPorUsuario(sessao.usuarioId).catch(() => null),
    lerResponsavelPadrao(sessao.empresaId).catch(() => null),
  ]);
  const escolhas = vinculo?.escolhas ?? lerEscolhas(null, sessao.papel);
  const botaoAtribuir = tituloAtribuir(padrao?.nome ?? null);
  const numero = vinculo?.whatsapp ?? null;
  const recebendo = vinculo !== null && vinculo.avisoWhatsapp;
  const agora = new Date();
  const conversaAtiva = vinculo !== null && janelaAberta(vinculo.ultimaEntrada, agora);
  const verSituacao = sessao.papel === "dono" || sessao.papel === "gestor";
  const situacao = verSituacao
    ? await Promise.all([
        listarVinculosDaEmpresa(sessao.empresaId),
        lerUltimosResumos(sessao.empresaId),
        listarAvisosRecentes(sessao.empresaId, AVISOS_RECENTES),
      ]).catch(() => null)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-[720px] min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-tight font-semibold text-ink">Alertas</h1>
        <p className="text-sm text-muted-foreground">Receba no WhatsApp o que precisa da sua atenção, sem abrir o painel.</p>
      </header>

      <section className={CARTAO}>
        <h2 className="text-base font-semibold text-ink">WhatsApp</h2>
        {numero !== null ? (
          <>
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Número:</dt>
                <dd className="font-medium text-ink">{formatarWhatsapp(numero)}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Situação:</dt>
                <dd className="font-medium text-ink">{recebendo ? "Recebendo" : "Pausado"}</dd>
              </div>
              {recebendo ? (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">Conversa:</dt>
                  <dd className="font-medium text-ink">{conversaAtiva ? "Conversa ativa" : "Conversa fechada"}</dd>
                </div>
              ) : null}
            </dl>
            {recebendo && !conversaAtiva ? (
              <p className="text-[13px] text-muted-foreground">
                Mande qualquer mensagem para o número para voltar a receber o resumo da manhã e os prazos urgentes.
              </p>
            ) : null}
            <ControlesWhatsapp recebendo={recebendo} />
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              O WhatsApp ainda não está ligado. Toque no botão, abra a conversa e envie a mensagem que aparecer pronta.
            </p>
            <LigarWhatsapp />
          </>
        )}
      </section>

      <section className={CARTAO}>
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-ink">O que chega por lá</h2>
          <p className="text-[13px] text-muted-foreground">
            Uma mensagem por dia, às 7h, com o que você escolher abaixo. Fora dela, só o prazo urgente, se estiver ligado. Cada coisa chega uma vez só.
          </p>
        </div>
        <PerfilAlertaForm inicial={escolhas} />
      </section>

      {situacao !== null ? (
        <SituacaoWhatsapp pessoas={situacao[0]} ultimosResumos={situacao[1]} avisos={situacao[2]} agora={agora} />
      ) : null}

      <section className={CARTAO}>
        <h2 className="text-base font-semibold text-ink">O que você pode pedir</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
          <li>
            <strong>pipeline</strong>: mostra como está o seu pipeline.
          </li>
          <li>
            <strong>prazos</strong>: lista os próximos prazos.
          </li>
          <li>
            <strong>parar</strong>: pausa os alertas.
          </li>
          <li>
            <strong>voltar</strong>: retoma os alertas.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Você também pode fazer perguntas sobre o seu pipeline e tocar nos botões &quot;Vou participar&quot;, &quot;{botaoAtribuir}&quot; e &quot;Descartar&quot; que vêm junto dos prazos urgentes.
        </p>
      </section>

      <section className={CARTAO}>
        <h2 className="text-base font-semibold text-ink">Se ficar um tempo sem responder</h2>
        <p className="text-sm text-muted-foreground">
          Se você ficar 24 horas sem mandar mensagem para o número, o resumo da manhã para de chegar. Quando você escrever de novo, chega só o prazo urgente que estiver valendo; o resto vem no próximo resumo. O resumo tem o botão &quot;Continuar recebendo&quot;, que mantém tudo chegando.
        </p>
      </section>
    </div>
  );
}
