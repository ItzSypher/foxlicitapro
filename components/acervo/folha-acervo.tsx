"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { salvarAcervoAction } from "@/app/(app)/acervo/actions";
import {
  AREAS_SUGERIDAS,
  LIMITE_ARQUIVO_ACERVO,
  ROTULO_TIPO_ACERVO,
  TIPOS_ACERVO,
  normalizarArea,
  rotuloArea,
  type DocumentoAcervo,
  type TipoAcervo,
} from "@/core/acervo";
import { formatarCnpj } from "@/core/brasilapi";
import { BOTAO_PRIMARIO, CONTROLE } from "@/components/fornecedores/estilo";
import { Seletor } from "@/components/ui/seletor";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const OPCOES_TIPO = TIPOS_ACERVO.map((t) => ({ valor: t, rotulo: ROTULO_TIPO_ACERVO[t] }));

const AREA_TEXTO =
  "h-11 w-full rounded-control border border-control bg-raised px-3 text-base text-ink placeholder:text-faint outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40";

function reais(valor: number | null): string {
  return valor === null ? "" : valor.toFixed(2).replace(".", ",");
}

function Rotulo({ para, children }: { para: string; children: string }) {
  return (
    <label htmlFor={para} className="text-[13px] font-medium text-ink">
      {children}
    </label>
  );
}

function Formulario({ documento, aoFechar }: { documento: DocumentoAcervo | null; aoFechar: () => void }) {
  const [tipo, setTipo] = useState<TipoAcervo>(documento?.tipo ?? "atestado");
  const [areas, setAreas] = useState<string[]>(documento?.areas ?? []);
  const [areaLivre, setAreaLivre] = useState("");
  const [removerArquivo, setRemoverArquivo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  function alternarArea(area: string): void {
    setAreas((atuais) => (atuais.includes(area) ? atuais.filter((a) => a !== area) : [...atuais, area]));
  }

  function acrescentarAreaLivre(): void {
    const area = normalizarArea(areaLivre);
    setAreaLivre("");
    if (area !== "") setAreas((atuais) => (atuais.includes(area) ? atuais : [...atuais, area]));
  }

  function enviar(ev: FormEvent<HTMLFormElement>): void {
    ev.preventDefault();
    setErro(null);
    const dados = new FormData(ev.currentTarget);
    const arquivo = dados.get("arquivo");
    if (arquivo instanceof File && arquivo.size > LIMITE_ARQUIVO_ACERVO) {
      setErro("O arquivo passa de 4 MB. Envie um menor.");
      return;
    }
    if (areaLivre.trim() !== "") {
      const pendente = normalizarArea(areaLivre);
      if (pendente !== "" && !areas.includes(pendente)) dados.append("areas", pendente);
    }
    for (const area of areas) dados.append("areas", area);
    if (removerArquivo) dados.set("removerArquivo", "1");
    iniciar(async () => {
      const r = await salvarAcervoAction(documento?.id ?? null, dados);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      aoFechar();
    });
  }

  const areasLivres = areas.filter((a) => !AREAS_SUGERIDAS.some((s) => s.valor === a));
  const temArquivo = documento?.arquivoNome != null && !removerArquivo;

  return (
    <form noValidate onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
      <fieldset disabled={salvando} className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        <div className="flex flex-col gap-1.5">
          <Rotulo para="acervo-tipo">Tipo</Rotulo>
          <Seletor id="acervo-tipo" name="tipo" valor={tipo} aoMudar={setTipo} opcoes={OPCOES_TIPO} rotuloAcessivel="Tipo do documento" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Rotulo para="acervo-titulo">Título</Rotulo>
          <input
            id="acervo-titulo"
            name="titulo"
            defaultValue={documento?.titulo ?? ""}
            maxLength={200}
            autoComplete="off"
            placeholder="Ex.: Atestado da Prefeitura de Niterói"
            className={CONTROLE}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
          <div className="flex flex-col gap-1.5">
            <Rotulo para="acervo-emissor">Quem emitiu</Rotulo>
            <input
              id="acervo-emissor"
              name="emissor"
              defaultValue={documento?.emissor ?? ""}
              maxLength={200}
              autoComplete="off"
              placeholder="Cliente ou órgão"
              className={CONTROLE}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Rotulo para="acervo-cnpj">CNPJ de quem emitiu (opcional)</Rotulo>
            <input
              id="acervo-cnpj"
              name="emissorCnpj"
              inputMode="numeric"
              defaultValue={documento?.emissorCnpj ? formatarCnpj(documento.emissorCnpj) : ""}
              maxLength={30}
              autoComplete="off"
              placeholder="00.000.000/0000-00"
              className={CONTROLE}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Rotulo para="acervo-descricao">O que ele comprova</Rotulo>
          <textarea
            id="acervo-descricao"
            name="descricao"
            defaultValue={documento?.descricao ?? ""}
            rows={3}
            maxLength={2000}
            placeholder="Serviços ou produtos fornecidos. Ajuda a achar o documento quando uma licitação pedir."
            className="w-full resize-y rounded-control border border-control bg-raised p-3 text-base leading-snug text-ink placeholder:text-faint outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span id="acervo-areas" className="text-[13px] font-medium text-ink">
            Áreas
          </span>
          <div role="group" aria-labelledby="acervo-areas" className="flex flex-wrap gap-2">
            {AREAS_SUGERIDAS.map((a) => {
              const marcada = areas.includes(a.valor);
              return (
                <button
                  key={a.valor}
                  type="button"
                  aria-pressed={marcada}
                  onClick={() => alternarArea(a.valor)}
                  className={cn(
                    "min-h-10 rounded-full px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    marcada ? "bg-brand-fill font-medium text-black" : "bg-raised text-muted-foreground ring-1 ring-inset ring-border hover:text-ink",
                  )}
                >
                  {a.rotulo}
                </button>
              );
            })}
            {areasLivres.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => alternarArea(a)}
                aria-label={`Tirar a área ${rotuloArea(a)}`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand-fill px-3 text-sm font-medium text-black outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {rotuloArea(a)}
                <X aria-hidden="true" className="size-3.5" />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <label htmlFor="acervo-area-livre" className="sr-only">
              Outra área
            </label>
            <input
              id="acervo-area-livre"
              value={areaLivre}
              onChange={(e) => setAreaLivre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  acrescentarAreaLivre();
                }
              }}
              maxLength={40}
              autoComplete="off"
              placeholder="Outra área, ex.: jardinagem"
              className={AREA_TEXTO}
            />
            <button
              type="button"
              onClick={acrescentarAreaLivre}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-control bg-raised px-3 text-sm text-ink ring-1 ring-inset ring-border outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Plus aria-hidden="true" className="size-4" />
              Incluir
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
          <div className="flex flex-col gap-1.5">
            <Rotulo para="acervo-valor">Valor (opcional)</Rotulo>
            <input
              id="acervo-valor"
              name="valor"
              inputMode="decimal"
              defaultValue={reais(documento?.valor ?? null)}
              maxLength={20}
              autoComplete="off"
              placeholder="Ex.: 15.000,00"
              className={CONTROLE}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Rotulo para="acervo-emitido">Emitido em</Rotulo>
            <input id="acervo-emitido" name="emitidoEm" type="date" defaultValue={documento?.emitidoEm ?? ""} className={CONTROLE} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Rotulo para="acervo-inicio">Período: início</Rotulo>
            <input id="acervo-inicio" name="periodoInicio" type="date" defaultValue={documento?.periodoInicio ?? ""} className={CONTROLE} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Rotulo para="acervo-fim">Período: fim</Rotulo>
            <input id="acervo-fim" name="periodoFim" type="date" defaultValue={documento?.periodoFim ?? ""} className={CONTROLE} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Rotulo para="acervo-validade">Validade (certidões vencem)</Rotulo>
          <input id="acervo-validade" name="validade" type="date" defaultValue={documento?.validade ?? ""} className={CONTROLE} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Rotulo para="acervo-arquivo">{temArquivo ? "Trocar o arquivo" : "Arquivo (PDF ou imagem, até 4 MB)"}</Rotulo>
          {temArquivo ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
              <span className="min-w-0 truncate">Atual: {documento?.arquivoNome}</span>
              <button
                type="button"
                onClick={() => setRemoverArquivo(true)}
                className="min-h-8 text-[13px] text-negative underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                Remover
              </button>
            </p>
          ) : null}
          {removerArquivo ? (
            <p className="text-[13px] text-muted-foreground">
              O arquivo atual será removido ao salvar.{" "}
              <button
                type="button"
                onClick={() => setRemoverArquivo(false)}
                className="text-ink underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                Desfazer
              </button>
            </p>
          ) : null}
          <input
            id="acervo-arquivo"
            name="arquivo"
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="block w-full rounded-control border border-control bg-raised p-2 text-sm text-muted-foreground file:mr-3 file:h-9 file:rounded-control file:border-0 file:bg-active file:px-3 file:text-sm file:text-ink"
          />
        </div>

        {erro ? (
          <p role="alert" className="rounded-xl border border-border px-3 py-2 text-sm text-negative">
            {erro}
          </p>
        ) : null}
      </fieldset>

      <div className="flex gap-2 border-t border-border bg-popover px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button type="submit" disabled={salvando} className={`${BOTAO_PRIMARIO} flex-1`}>
          {salvando ? "Salvando..." : documento === null ? "Guardar no acervo" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={aoFechar}
          disabled={salvando}
          className="inline-flex h-11 items-center justify-center rounded-control px-4 text-base text-ink outline-none ring-1 ring-inset ring-border hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Folha lateral (tela cheia no celular) para guardar um documento novo ou editar um existente. */
export function FolhaAcervo({
  aberto,
  aoMudar,
  documento,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  documento: DocumentoAcervo | null;
}) {
  return (
    <Sheet open={aberto} onOpenChange={aoMudar}>
      <SheetContent side="right" className="gap-0">
        <SheetHeader className="pr-14">
          <SheetTitle>{documento === null ? "Adicionar ao acervo" : "Editar documento"}</SheetTitle>
          <SheetDescription>Guarde o que prova a qualificação da empresa para achar rápido quando uma licitação pedir.</SheetDescription>
        </SheetHeader>
        <Formulario documento={documento} aoFechar={() => aoMudar(false)} />
      </SheetContent>
    </Sheet>
  );
}
