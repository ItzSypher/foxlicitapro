import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { MarcaNome } from "@/app/login/marca-nome";
import { Entrada } from "@/components/ui/movimento";
import { SecaoTecnica } from "./secao-tecnica";
import { Logica, Operacao, VisaoGeral } from "./secoes-publicas";
import { SeletorSecoes } from "./seletor-secoes";

const SITE = "https://licitapro.foxtisolutions.com.br";
const URL_PAGINA = `${SITE}/documentacao`;
const TITULO = "FoxLicita Pro — acompanhamento de licitações para pequenas empresas";
const DESCRICAO =
  "O FoxLicita Pro acompanha licitações no CNPJ da sua empresa: acha as do seu ramo, organiza a disputa até o resultado e avisa no WhatsApp. Feito para MEIs e pequenas empresas que vendem ao governo.";

export const metadata: Metadata = {
  title: { absolute: TITULO },
  description: DESCRICAO,
  alternates: { canonical: URL_PAGINA },
  // O layout raiz bloqueia a indexação; só esta página é pública.
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: URL_PAGINA,
    siteName: "FoxLicita Pro",
    title: TITULO,
    description: DESCRICAO,
  },
};

const DADOS_ESTRUTURADOS = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FoxLicita Pro",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: URL_PAGINA,
  description: DESCRICAO,
  inLanguage: "pt-BR",
  creator: { "@type": "Organization", name: "Fox TI Solutions", url: "https://foxtisolutions.com.br" },
  publisher: { "@type": "Organization", name: "Fox TI Solutions", url: "https://foxtisolutions.com.br" },
};

/** "<" escapado para que nenhum texto feche a tag de script. */
const JSON_LD = JSON.stringify(DADOS_ESTRUTURADOS).replace(/</g, "\\u003c");

function EsqueletoTecnica() {
  return (
    <section id="tecnica" aria-label="Técnica" className="scroll-mt-20 py-8 sm:py-10">
      <div className="h-32 animate-pulse rounded-xl bg-raised" />
    </section>
  );
}

export default function DocumentacaoPage() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-ground text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD }} />
      <header>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <MarcaNome />
          <Link
            href="/login"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand-fill px-4 text-sm font-semibold text-black outline-none hover:bg-brand-fill/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
          >
            <LogIn className="size-4" aria-hidden="true" />
            Entrar
          </Link>
        </div>
        <Entrada className="mx-auto w-full max-w-5xl px-4 pt-4 pb-6 sm:px-6 sm:pt-8">
          <h1 className="max-w-3xl text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
            Acompanhamento de licitações para pequenas empresas
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            O FoxLicita Pro acha as licitações do seu ramo, organiza a disputa até o resultado e avisa no WhatsApp. Tudo no CNPJ da sua
            empresa, com um gestor cuidando da rotina.
          </p>
        </Entrada>
      </header>

      <SeletorSecoes />

      <main className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6">
        <VisaoGeral />
        <Logica />
        <Operacao />
        <Suspense fallback={<EsqueletoTecnica />}>
          <SecaoTecnica />
        </Suspense>
      </main>

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-faint">
        © <a href="https://foxtisolutions.com.br" target="_blank" rel="noopener" className="underline underline-offset-2">Fox TI Solutions</a>
        {" · "}Nova Iguaçu, RJ
      </footer>
    </div>
  );
}
