import { connection } from "next/server";
import { formatarWhatsapp } from "@/core/whatsapp";
import { janelaAberta } from "@/core/whatsapp-alertas";
import { lerVinculoPorUsuario } from "@/db/whatsapp";
import { exigirSessao } from "@/lib/sessao";
import { ControlesWhatsapp } from "./controles";
import { LigarWhatsapp } from "./ligar-whatsapp";

export const metadata = { title: "Alertas · FoxLicita Pro" };

const CARTAO = "flex flex-col gap-3 rounded-card border border-border bg-surface p-4";

export default async function AlertasPage() {
  await connection();
  const sessao = await exigirSessao();
  const vinculo = await lerVinculoPorUsuario(sessao.usuarioId).catch(() => null);
  const numero = vinculo?.whatsapp ?? null;
  const recebendo = vinculo !== null && vinculo.avisoWhatsapp;
  const conversaAtiva = vinculo !== null && janelaAberta(vinculo.ultimaEntrada, new Date());

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
                Mande qualquer mensagem para o número para voltar a receber na hora; o que chegar enquanto isso vai num resumo.
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
        <h2 className="text-base font-semibold text-ink">O que chega por lá</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
          <li>Prazos chegando, avisados 48 horas, 24 horas e 2 horas antes.</li>
          <li>Licitação nova com nota alta no Radar.</li>
          <li>Item do Pipeline sem responsável.</li>
          <li>Mudança de etapa nos itens do Pipeline.</li>
        </ul>
        <p className="text-[13px] text-muted-foreground">Os avisos vêm das 7h às 20h e cada um chega uma vez só, sem repetir.</p>
      </section>

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
          Você também pode fazer perguntas sobre o seu pipeline e tocar nos botões &quot;Vou participar&quot;, &quot;Atribuir a mim&quot; e &quot;Descartar&quot; que vêm junto dos avisos.
        </p>
      </section>

      <section className={CARTAO}>
        <h2 className="text-base font-semibold text-ink">Se ficar um tempo sem responder</h2>
        <p className="text-sm text-muted-foreground">
          Se você ficar 24 horas sem mandar mensagem para o número, os alertas esperam e chegam juntos quando você escrever de novo. O resumo da manhã tem o botão &quot;Continuar recebendo&quot;, que mantém tudo chegando na hora.
        </p>
      </section>
    </div>
  );
}
