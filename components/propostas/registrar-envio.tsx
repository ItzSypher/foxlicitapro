"use client";

import { useId, useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { BOTAO_SECUNDARIO, CONTROLE } from "@/components/propostas/campos";
import {
  TAMANHO_MAXIMO_COMPROVANTE,
  TAMANHO_MAXIMO_NOTA_EVENTO,
  TAMANHO_MAXIMO_PROTOCOLO,
  lerComprovante,
} from "@/core/proposta-eventos";
import { dimensoesLimitadas } from "@/lib/assinatura-imagem";
import { cn } from "@/lib/utils";

/** Maior lado da imagem do comprovante depois de reduzida. */
const LADO_MAXIMO = 1600;

function lerComoDataUrl(arquivo: Blob): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => (typeof leitor.result === "string" ? resolver(leitor.result) : rejeitar(new Error("leitura")));
    leitor.onerror = () => rejeitar(new Error("leitura"));
    leitor.readAsDataURL(arquivo);
  });
}

/** Reduz o print para JPEG até caber no limite (tenta tamanhos e qualidades menores). */
async function imagemReduzida(arquivo: File): Promise<string> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  try {
    for (const [lado, qualidade] of [
      [LADO_MAXIMO, 0.82],
      [1280, 0.72],
      [1024, 0.62],
    ] as const) {
      const { largura, altura } = dimensoesLimitadas(bitmap.width, bitmap.height, lado);
      const tela = document.createElement("canvas");
      tela.width = largura;
      tela.height = altura;
      const ctx = tela.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, largura, altura);
      ctx.drawImage(bitmap, 0, 0, largura, altura);
      const url = tela.toDataURL("image/jpeg", qualidade);
      if (lerComprovante(url).ok) return url;
    }
  } finally {
    bitmap.close();
  }
  throw new Error("grande");
}

export interface Comprovante {
  dataUrl: string;
  nome: string;
  tipo: "imagem" | "pdf";
}

/** Escolha do comprovante: print (reduzido no aparelho) ou PDF de até 600 KB. */
export function CampoComprovante({
  valor,
  aoMudar,
  desabilitado,
}: {
  valor: Comprovante | null;
  aoMudar: (c: Comprovante | null) => void;
  desabilitado?: boolean;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setLendo(true);
    try {
      if (arquivo.type === "application/pdf") {
        if (arquivo.size > TAMANHO_MAXIMO_COMPROVANTE) {
          setErro("O PDF passou de 600 KB. Mande um print da tela de confirmação.");
          return;
        }
        const url = await lerComoDataUrl(arquivo);
        const lido = lerComprovante(url);
        if (!lido.ok) {
          setErro(lido.erro);
          return;
        }
        aoMudar({ dataUrl: url, nome: arquivo.name, tipo: "pdf" });
      } else if (arquivo.type.startsWith("image/")) {
        aoMudar({ dataUrl: await imagemReduzida(arquivo), nome: arquivo.name, tipo: "imagem" });
      } else {
        setErro("Mande uma imagem (print) ou um PDF.");
      }
    } catch {
      setErro("Não deu para ler o arquivo. Tente outro print ou PDF.");
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink">Comprovante</span>
      {valor ? (
        <div className="flex items-center gap-3 rounded-control border border-control bg-raised p-2">
          {valor.tipo === "imagem" ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local em data URL
            <img src={valor.dataUrl} alt="Prévia do comprovante" className="size-12 shrink-0 rounded object-cover" />
          ) : (
            <FileText aria-hidden className="size-6 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate text-sm text-ink">{valor.nome}</span>
          <button
            type="button"
            onClick={() => aoMudar(null)}
            disabled={desabilitado}
            aria-label="Tirar o comprovante"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted-foreground outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={desabilitado || lendo}
          className={cn(BOTAO_SECUNDARIO, "justify-start")}
        >
          <Paperclip aria-hidden className="size-4" />
          {lendo ? "Lendo o arquivo…" : "Anexar print ou PDF"}
        </button>
      )}
      <input
        ref={entrada}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => void escolher(e.target.files?.[0])}
      />
      {erro ? (
        <p role="alert" className="text-[13px] text-negative">
          {erro}
        </p>
      ) : (
        <p className="text-[13px] text-muted-foreground">Print da tela de confirmação do portal ou o recibo em PDF (até 600 KB).</p>
      )}
    </div>
  );
}

export interface DadosEnvio {
  protocolo: string;
  comprovante: Comprovante | null;
  nota: string;
}

export const ENVIO_VAZIO: DadosEnvio = { protocolo: "", comprovante: null, nota: "" };

/** Campos da prova do envio: protocolo, comprovante e observação. */
export function CamposEnvio({
  valor,
  aoMudar,
  desabilitado,
}: {
  valor: DadosEnvio;
  aoMudar: (v: DadosEnvio) => void;
  desabilitado?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-protocolo`} className="text-[13px] font-medium text-ink">
          Número do protocolo no portal
        </label>
        <input
          id={`${id}-protocolo`}
          value={valor.protocolo}
          onChange={(e) => aoMudar({ ...valor, protocolo: e.target.value })}
          maxLength={TAMANHO_MAXIMO_PROTOCOLO}
          disabled={desabilitado}
          autoComplete="off"
          className={CONTROLE}
        />
      </div>
      <CampoComprovante valor={valor.comprovante} aoMudar={(c) => aoMudar({ ...valor, comprovante: c })} desabilitado={desabilitado} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-nota`} className="text-[13px] font-medium text-ink">
          Observação (opcional)
        </label>
        <textarea
          id={`${id}-nota`}
          value={valor.nota}
          onChange={(e) => aoMudar({ ...valor, nota: e.target.value })}
          rows={2}
          maxLength={TAMANHO_MAXIMO_NOTA_EVENTO}
          disabled={desabilitado}
          className={cn(CONTROLE, "h-auto min-h-11 resize-y py-2.5 leading-snug")}
        />
      </div>
    </div>
  );
}

/** O que vai para a action: só texto (o comprovante já em data URL). */
export function envioParaAction(v: DadosEnvio): { protocolo: string; comprovante: string | null; nota: string } {
  return { protocolo: v.protocolo, comprovante: v.comprovante?.dataUrl ?? null, nota: v.nota };
}
