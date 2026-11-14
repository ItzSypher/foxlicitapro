import { connection } from "next/server";
import { formatarWhatsapp } from "@/core/whatsapp";
import { lerCanais } from "@/db/avisos";
import { rotuloPapel } from "@/lib/papel";
import { exigirSessao } from "@/lib/sessao";
import { whatsappConfigurado } from "@/lib/whatsapp";
import { FormCanais } from "./form-canais";
import { FormSenha } from "./form-senha";

export const metadata = { title: "Minha conta · FoxLicita Pro" };

export default async function ContaPage() {
  await connection();
  const sessao = await exigirSessao();
  const canais = await lerCanais(sessao.empresaId, sessao.usuarioId).catch(() => ({ whatsapp: null, email: true, avisoWhatsapp: false }));
  return (
    <div className="flex max-w-md min-w-0 flex-col gap-4 lg:gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Minha conta</h1>
        <p className="text-sm text-muted-foreground">
          {sessao.nome} · {rotuloPapel(sessao.papel)}
        </p>
      </header>
      <FormCanais
        whatsapp={canais.whatsapp === null ? "" : formatarWhatsapp(canais.whatsapp)}
        email={canais.email}
        avisoWhatsapp={canais.avisoWhatsapp}
        whatsappDisponivel={whatsappConfigurado()}
      />
      <FormSenha />
    </div>
  );
}
