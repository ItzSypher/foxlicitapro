"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assinarAtestadoAction } from "@/app/atestado/[token]/actions";
import { PadAssinatura } from "@/components/assinatura/pad";

const CAMPO =
  "h-12 w-full rounded-xl border border-[#b8b8b8] bg-white px-3 text-base text-[#111] placeholder:text-[#8a8a8a] outline-none focus-visible:border-[#f57e11] focus-visible:ring-2 focus-visible:ring-[#f57e11]/40 disabled:opacity-70";

interface Props {
  token: string;
  nomeInicial: string;
  cargoInicial: string;
}

/** Formulário do cliente: identifica quem assina, desenha a assinatura e confirma a declaração. */
export function FormularioAssinatura({ token, nomeInicial, cargoInicial }: Props) {
  const router = useRouter();
  const [nome, setNome] = useState(nomeInicial);
  const [cargo, setCargo] = useState(cargoInicial);
  const [documento, setDocumento] = useState("");
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [declaro, setDeclaro] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function confirmar(): void {
    setErro(null);
    if (assinatura === null) {
      setErro("Assine no quadro antes de confirmar.");
      return;
    }
    iniciar(async () => {
      const r = await assinarAtestadoAction(token, { nome, cargo, documento, assinatura, declaracao: declaro });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        confirmar();
      }}
      className="flex flex-col gap-4 rounded-xl border border-[#cfcfcf] bg-white p-4"
    >
      <h2 className="text-lg font-semibold text-[#111]">Assinar o atestado</h2>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="at-nome" className="text-sm font-medium text-[#111]">
          Seu nome completo
        </label>
        <input id="at-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} autoComplete="name" disabled={enviando} className={CAMPO} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="at-cargo" className="text-sm font-medium text-[#111]">
          Cargo ou função
        </label>
        <input id="at-cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} maxLength={80} autoComplete="organization-title" disabled={enviando} className={CAMPO} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="at-cpf" className="text-sm font-medium text-[#111]">
          CPF <span className="font-normal text-[#555]">(opcional)</span>
        </label>
        <input id="at-cpf" value={documento} onChange={(e) => setDocumento(e.target.value)} inputMode="numeric" maxLength={14} placeholder="000.000.000-00" autoComplete="off" disabled={enviando} className={CAMPO} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-[#111]">Sua assinatura</span>
        <PadAssinatura aoMudar={setAssinatura} desabilitado={enviando} />
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug text-[#111]">
        <input
          type="checkbox"
          checked={declaro}
          onChange={(e) => setDeclaro(e.target.checked)}
          disabled={enviando}
          className="mt-0.5 size-6 shrink-0 cursor-pointer accent-[#f57e11]"
        />
        <span>Declaro que as informações deste atestado são verdadeiras.</span>
      </label>

      <button
        type="submit"
        disabled={enviando}
        className="inline-flex h-12 cursor-pointer items-center justify-center rounded-xl bg-[#f57e11] px-4 text-base font-semibold text-black outline-none hover:bg-[#e0730f] focus-visible:ring-2 focus-visible:ring-[#f57e11] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? "Registrando…" : "Assinar e confirmar"}
      </button>
      <p role={erro ? "alert" : "status"} className="min-h-5 text-sm text-[#b42318]">
        {erro ?? ""}
      </p>
      <p className="text-[13px] leading-snug text-[#555]">
        Ao confirmar, registramos a data, a hora e o aparelho usado, como prova de que foi você quem assinou.
      </p>
    </form>
  );
}
