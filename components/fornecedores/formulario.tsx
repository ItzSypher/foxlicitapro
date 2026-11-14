"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarFornecedorAction } from "@/app/(app)/fornecedores/actions";
import { formatarCnpj } from "@/core/brasilapi";
import type { DadosFornecedor } from "@/core/fornecedores";
import { BOTAO_PRIMARIO, CONTROLE } from "./estilo";

interface Props {
  /** null: cadastro novo */
  id: string | null;
  inicial: DadosFornecedor;
  podeEditar: boolean;
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
}: {
  id: string;
  rotulo: string;
  valor: string;
  onMudar: (v: string) => void;
  tipo?: "text" | "email" | "tel" | "url";
  placeholder?: string;
  modo?: "text" | "numeric" | "tel" | "email" | "url";
}) {
  return (
    <div className="flex flex-col gap-1.5">
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
        maxLength={300}
        onChange={(e) => onMudar(e.target.value)}
        className={CONTROLE}
      />
    </div>
  );
}

export function FormularioFornecedor({ id, inicial, podeEditar }: Props) {
  const router = useRouter();
  const [nome, setNome] = useState(inicial.nome);
  const [cnpj, setCnpj] = useState(inicial.cnpj === null ? "" : formatarCnpj(inicial.cnpj));
  const [contato, setContato] = useState(inicial.contato);
  const [telefone, setTelefone] = useState(inicial.telefone);
  const [email, setEmail] = useState(inicial.email);
  const [site, setSite] = useState(inicial.site);
  const [categorias, setCategorias] = useState(inicial.categorias);
  const [observacao, setObservacao] = useState(inicial.observacao);
  const [ativo, setAtivo] = useState(inicial.ativo);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [salvando, iniciar] = useTransition();

  function salvar(): void {
    if (!podeEditar) return;
    setAviso(null);
    iniciar(async () => {
      const r = await salvarFornecedorAction(id, { nome, cnpj, contato, telefone, email, site, categorias, observacao, ativo });
      if (!r.ok) {
        setAviso({ tom: "erro", texto: r.erro });
        return;
      }
      if (id === null) {
        router.push(`/fornecedores/${r.id}`);
        return;
      }
      setAviso({ tom: "ok", texto: "Fornecedor salvo." });
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
      <fieldset disabled={!podeEditar || salvando} className="flex min-w-0 flex-col gap-4">
        <Campo id="forn-nome" rotulo="Nome" valor={nome} onMudar={setNome} placeholder="Ex.: Distribuidora Alfa" />
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
          <Campo id="forn-cnpj" rotulo="CNPJ (opcional)" valor={cnpj} onMudar={setCnpj} modo="numeric" placeholder="00.000.000/0000-00" />
          <Campo id="forn-contato" rotulo="Contato" valor={contato} onMudar={setContato} placeholder="Nome de quem atende" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
          <Campo id="forn-telefone" rotulo="Telefone ou WhatsApp" valor={telefone} onMudar={setTelefone} tipo="tel" modo="tel" />
          <Campo id="forn-email" rotulo="E-mail" valor={email} onMudar={setEmail} tipo="email" modo="email" />
        </div>
        <Campo id="forn-site" rotulo="Site" valor={site} onMudar={setSite} tipo="url" modo="url" placeholder="https://" />
        <Campo
          id="forn-categorias"
          rotulo="Categorias ou palavras"
          valor={categorias}
          onMudar={setCategorias}
          placeholder="Ex.: informática, monitores, cabos"
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="forn-obs" className="text-[13px] font-medium text-ink">
            Observação
          </label>
          <textarea
            id="forn-obs"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full resize-y rounded-control border border-control bg-raised p-3 text-base leading-snug text-ink outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-70"
          />
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-5 accent-brand" />
          Fornecedor ativo (aparece nas sugestões de preço)
        </label>
      </fieldset>
      {podeEditar ? (
        <div className="flex flex-col gap-2">
          <button type="submit" disabled={salvando} className={BOTAO_PRIMARIO}>
            {salvando ? "Salvando…" : id === null ? "Cadastrar fornecedor" : "Salvar alterações"}
          </button>
          <p
            role={aviso?.tom === "erro" ? "alert" : "status"}
            className={aviso?.tom === "erro" ? "min-h-5 text-[13px] text-negative" : "min-h-5 text-[13px] text-positive"}
          >
            {aviso?.texto ?? ""}
          </p>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">Você pode consultar, mas não editar fornecedores.</p>
      )}
    </form>
  );
}
