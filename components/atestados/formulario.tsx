"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { consultarCnpjClienteAction, redigirAtestadoAction, salvarAtestadoAction } from "@/app/(app)/atestados/actions";
import { lerValor, textoPadraoAtestado } from "@/core/atestados";
import { somenteDigitos } from "@/core/brasilapi";
import { BOTAO_PRIMARIO, CONTROLE } from "@/components/fornecedores/estilo";

const BOTAO_SECUNDARIO =
  "inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-ink outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-60";

export interface ValoresAtestado {
  clienteNome: string;
  clienteCnpj: string;
  clienteEndereco: string;
  responsavelNome: string;
  responsavelCargo: string;
  responsavelContato: string;
  objeto: string;
  /** Áreas separadas por vírgula */
  areas: string;
  periodoInicio: string;
  periodoFim: string;
  valor: string;
  texto: string;
}

export const VALORES_VAZIOS: ValoresAtestado = {
  clienteNome: "",
  clienteCnpj: "",
  clienteEndereco: "",
  responsavelNome: "",
  responsavelCargo: "",
  responsavelContato: "",
  objeto: "",
  areas: "",
  periodoInicio: "",
  periodoFim: "",
  valor: "",
  texto: "",
};

interface Props {
  /** null: atestado novo */
  id: string | null;
  inicial: ValoresAtestado;
  emissora: { razaoSocial: string; cnpj: string };
  podeEditar: boolean;
  podeAssistente: boolean;
}

type Aviso = { tom: "ok" | "erro"; texto: string } | null;

function Campo({
  id,
  rotulo,
  valor,
  onMudar,
  tipo = "text",
  placeholder,
  modo,
  max = 300,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onMudar: (v: string) => void;
  tipo?: "text" | "date";
  placeholder?: string;
  modo?: "text" | "numeric" | "tel" | "email";
  max?: number;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {rotulo}
      </label>
      <input
        id={id}
        type={tipo}
        inputMode={modo}
        value={valor}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={max}
        onChange={(e) => onMudar(e.target.value)}
        className={CONTROLE}
      />
    </div>
  );
}

export function FormularioAtestado({ id, inicial, emissora, podeEditar, podeAssistente }: Props) {
  const router = useRouter();
  const [v, setV] = useState<ValoresAtestado>(inicial);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [salvando, iniciarSalvar] = useTransition();
  const [trabalhando, iniciarTrabalho] = useTransition();

  const [maisAberto, setMaisAberto] = useState(
    inicial.clienteCnpj !== "" ||
      inicial.clienteEndereco !== "" ||
      inicial.responsavelContato !== "" ||
      inicial.areas !== "" ||
      inicial.periodoInicio !== "" ||
      inicial.periodoFim !== "" ||
      inicial.valor !== "",
  );

  const ocupado = salvando || trabalhando;
  const mudar = (campo: keyof ValoresAtestado) => (valor: string) => setV((a) => ({ ...a, [campo]: valor }));

  function textoModelo(): string {
    const valor = lerValor(v.valor);
    const digitos = somenteDigitos(v.clienteCnpj);
    return textoPadraoAtestado({
      emissoraRazaoSocial: emissora.razaoSocial,
      emissoraCnpj: emissora.cnpj,
      clienteNome: v.clienteNome.trim() || "contratante",
      clienteCnpj: digitos.length === 14 ? digitos : null,
      objeto: v.objeto.trim() || "[descreva os serviços]",
      periodoInicio: v.periodoInicio || null,
      periodoFim: v.periodoFim || null,
      valor: valor !== null && Number.isFinite(valor) ? valor : null,
    });
  }

  function usarModelo(): void {
    if (v.texto.trim() !== "" && !window.confirm("Substituir o texto atual pelo modelo padrão?")) return;
    setV((a) => ({ ...a, texto: textoModelo() }));
    setAviso(null);
  }

  function buscarCnpj(): void {
    setAviso(null);
    iniciarTrabalho(async () => {
      const r = await consultarCnpjClienteAction(v.clienteCnpj);
      if (!r.ok) {
        setAviso({ tom: "erro", texto: r.erro });
        return;
      }
      setV((a) => ({ ...a, clienteNome: r.razaoSocial, clienteEndereco: r.endereco ?? a.clienteEndereco }));
      setAviso({ tom: "ok", texto: "Dados do CNPJ preenchidos. Confira antes de salvar." });
    });
  }

  function redigir(): void {
    if (v.texto.trim() !== "" && !window.confirm("O assistente vai escrever um texto novo no lugar do atual. Continuar?")) return;
    setAviso(null);
    iniciarTrabalho(async () => {
      const r = await redigirAtestadoAction({
        clienteNome: v.clienteNome,
        clienteCnpj: v.clienteCnpj,
        objeto: v.objeto,
        descricao: v.objeto,
        periodoInicio: v.periodoInicio,
        periodoFim: v.periodoFim,
        valor: v.valor,
      });
      if (!r.ok) {
        setAviso({ tom: "erro", texto: r.erro });
        return;
      }
      setV((a) => ({ ...a, texto: r.texto }));
      setAviso({ tom: r.aviso ? "erro" : "ok", texto: r.aviso ?? "Texto redigido. Leia e ajuste o que precisar antes de salvar." });
    });
  }

  function salvar(): void {
    if (!podeEditar) return;
    setAviso(null);
    const dados = { ...v, areas: v.areas.split(",").map((a) => a.trim()).filter((a) => a !== ""), texto: v.texto.trim() === "" ? textoModelo() : v.texto };
    iniciarSalvar(async () => {
      const r = await salvarAtestadoAction(id, dados);
      if (!r.ok) {
        setMaisAberto(true);
        setAviso({ tom: "erro", texto: r.erro });
        return;
      }
      if (id === null) {
        router.push(`/atestados/${r.id}`);
        return;
      }
      setV((a) => ({ ...a, texto: dados.texto }));
      setAviso({ tom: "ok", texto: "Atestado salvo. Se ele já tinha sido enviado, gere o link de novo para o cliente." });
      router.refresh();
    });
  }

  return (
    <form
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        salvar();
      }}
      className="flex flex-col gap-4"
    >
      <fieldset disabled={!podeEditar || ocupado} className="flex min-w-0 flex-col gap-4">
        <Campo id="at-cliente" rotulo="Cliente" valor={v.clienteNome} onMudar={mudar("clienteNome")} max={200} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="at-objeto" className="text-[13px] font-medium text-ink">
            Serviços prestados
          </label>
          <textarea
            id="at-objeto"
            value={v.objeto}
            onChange={(e) => mudar("objeto")(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Ex.: desenvolvimento do site institucional e manutenção mensal"
            className="w-full resize-y rounded-control border border-control bg-raised p-3 text-base leading-snug text-ink outline-none placeholder:text-faint focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-70"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
          <Campo id="at-resp" rotulo="Quem assina pelo cliente" valor={v.responsavelNome} onMudar={mudar("responsavelNome")} max={120} />
          <Campo id="at-cargo" rotulo="Cargo" valor={v.responsavelCargo} onMudar={mudar("responsavelCargo")} max={80} />
        </div>

        <details
          open={maisAberto}
          onToggle={(ev) => setMaisAberto(ev.currentTarget.open)}
          className="group rounded-card border border-border"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
            <span>
              Mais detalhes <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="flex min-w-0 flex-col gap-4 px-3 pt-1 pb-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <Campo id="at-cnpj" rotulo="CNPJ do cliente" valor={v.clienteCnpj} onMudar={mudar("clienteCnpj")} modo="numeric" placeholder="00.000.000/0000-00" max={18} />
              <button type="button" onClick={buscarCnpj} disabled={somenteDigitos(v.clienteCnpj).length !== 14} className={BOTAO_SECUNDARIO}>
                Buscar pelo CNPJ
              </button>
            </div>
            <Campo id="at-endereco" rotulo="Endereço do cliente" valor={v.clienteEndereco} onMudar={mudar("clienteEndereco")} />
            <Campo id="at-contato" rotulo="WhatsApp ou e-mail de quem assina" valor={v.responsavelContato} onMudar={mudar("responsavelContato")} max={120} />
            <Campo id="at-areas" rotulo="Áreas (separadas por vírgula)" valor={v.areas} onMudar={mudar("areas")} placeholder="site, manutenção, redes" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-3">
              <Campo id="at-inicio" rotulo="Início do período" tipo="date" valor={v.periodoInicio} onMudar={mudar("periodoInicio")} />
              <Campo id="at-fim" rotulo="Fim do período" tipo="date" valor={v.periodoFim} onMudar={mudar("periodoFim")} />
              <Campo id="at-valor" rotulo="Valor (R$)" valor={v.valor} onMudar={mudar("valor")} modo="numeric" placeholder="12.500,00" max={20} />
            </div>
          </div>
        </details>

        <div className="flex flex-col gap-2">
          <label htmlFor="at-texto" className="text-[13px] font-medium text-ink">
            Texto do atestado
          </label>
          <div className="flex flex-wrap gap-2">
            {podeAssistente ? (
              <button type="button" onClick={redigir} disabled={v.clienteNome.trim() === "" || v.objeto.trim().length < 3} className={BOTAO_SECUNDARIO}>
                {trabalhando ? "Redigindo…" : "Redigir com o assistente"}
              </button>
            ) : null}
            <button type="button" onClick={usarModelo} className={BOTAO_SECUNDARIO}>
              Usar modelo padrão
            </button>
          </div>
          <textarea
            id="at-texto"
            value={v.texto}
            onChange={(e) => mudar("texto")(e.target.value)}
            rows={12}
            maxLength={8000}
            placeholder="Escreva o texto ou use o modelo padrão. Deixe uma linha em branco entre os parágrafos."
            className="w-full resize-y rounded-control border border-control bg-raised p-3 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-70"
          />
        </div>
      </fieldset>

      {podeEditar ? (
        <div className="flex flex-col gap-2">
          <button type="submit" disabled={ocupado} className={BOTAO_PRIMARIO}>
            {salvando ? "Salvando…" : id === null ? "Criar atestado" : "Salvar alterações"}
          </button>
          <p
            role={aviso?.tom === "erro" ? "alert" : "status"}
            className={aviso?.tom === "erro" ? "min-h-5 text-[13px] text-negative" : "min-h-5 text-[13px] text-positive"}
          >
            {aviso?.texto ?? ""}
          </p>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">Este atestado não pode mais ser editado.</p>
      )}
    </form>
  );
}
