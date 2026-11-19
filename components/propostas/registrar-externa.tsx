"use client";

import { useId, useState, useTransition } from "react";
import { FilePlus2 } from "lucide-react";
import { registrarExternaAction } from "@/app/(app)/propostas/actions";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CONTROLE } from "@/components/propostas/campos";
import { CamposEnvio, ENVIO_VAZIO, envioParaAction, type DadosEnvio } from "@/components/propostas/registrar-envio";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { numeroControleDoTexto } from "@/core/proposta-eventos";

interface Campos {
  orgao: string;
  numero: string;
  portal: string;
  valor: string;
  enviadaEm: string;
  objeto: string;
}

const VAZIO: Campos = { orgao: "", numero: "", portal: "", valor: "", enviadaEm: "", objeto: "" };

function Campo({
  id,
  rotulo,
  dica,
  ...props
}: { id: string; rotulo: string; dica?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {rotulo}
      </label>
      <input id={id} className={CONTROLE} {...props} />
      {dica && <p className="text-[13px] text-muted-foreground">{dica}</p>}
    </div>
  );
}

/** "Registrar proposta enviada fora do sistema": órgão, número, portal, valor e a prova do envio. */
export function RegistrarExterna() {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [campos, setCampos] = useState<Campos>(VAZIO);
  const [envio, setEnvio] = useState<DadosEnvio>(ENVIO_VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const mudar = (chave: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCampos((c) => ({ ...c, [chave]: e.target.value }));
  const doPncp = numeroControleDoTexto(campos.numero) !== null;

  function registrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await registrarExternaAction({ ...campos, ...envioParaAction(envio) });
      if (r && !r.ok) setErro(r.mensagem);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={BOTAO_SECUNDARIO}>
        <FilePlus2 aria-hidden className="size-4" />
        <span className="hidden sm:inline">Registrar envio externo</span>
        <span className="sm:hidden">Envio externo</span>
      </button>
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="right" className="gap-0">
          <SheetHeader className="pr-14">
            <SheetTitle>Proposta enviada fora do sistema</SheetTitle>
            <SheetDescription>Registre o que já foi enviado direto no portal, para a equipe acompanhar e o resultado aparecer aqui.</SheetDescription>
          </SheetHeader>
          <form onSubmit={registrar} className="flex flex-col gap-3 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <Campo id={`${id}-orgao`} rotulo="Órgão" value={campos.orgao} onChange={mudar("orgao")} maxLength={200} required />
            <Campo
              id={`${id}-numero`}
              rotulo="Número da licitação"
              value={campos.numero}
              onChange={mudar("numero")}
              maxLength={200}
              required
              dica={
                doPncp
                  ? "Número do PNCP reconhecido: o resultado será consultado todo dia."
                  : "Ex.: Pregão 90012/2026. Com o número ou o link do PNCP, o resultado é consultado sozinho."
              }
            />
            <Campo
              id={`${id}-portal`}
              rotulo="Portal"
              value={campos.portal}
              onChange={mudar("portal")}
              maxLength={80}
              required
              placeholder="Compras.gov.br, BLL, Licitanet…"
            />
            <Campo
              id={`${id}-valor`}
              rotulo="Valor da proposta (R$)"
              value={campos.valor}
              onChange={mudar("valor")}
              inputMode="decimal"
              maxLength={30}
              required
              placeholder="62.000,00"
            />
            <Campo
              id={`${id}-data`}
              rotulo="Enviada em"
              type="date"
              value={campos.enviadaEm}
              onChange={mudar("enviadaEm")}
              dica="Em branco: hoje."
            />
            <Campo id={`${id}-objeto`} rotulo="Objeto (opcional)" value={campos.objeto} onChange={mudar("objeto")} maxLength={500} />
            <CamposEnvio valor={envio} aoMudar={setEnvio} desabilitado={pendente} />
            <button
              type="submit"
              disabled={pendente || (envio.protocolo.trim() === "" && envio.comprovante === null)}
              className={BOTAO_PRIMARIO}
            >
              {pendente ? "Registrando…" : "Registrar proposta enviada"}
            </button>
            {erro && (
              <p role="alert" className="text-[13px] text-negative">
                {erro}
              </p>
            )}
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
