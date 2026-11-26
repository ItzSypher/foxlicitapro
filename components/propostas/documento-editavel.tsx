"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronUp, Lock, Plus, Trash2 } from "lucide-react";
import { CampoData, CampoInline } from "@/components/propostas/campo-inline";
import { quantidadeTexto } from "@/components/propostas/documento";
import { itemVazio, type Formulario, type ItemFormulario } from "@/components/propostas/estado";
import { dataPorExtenso, totalItemCentavos, totalProposta, valorPorExtenso } from "@/core/proposta";
import { enderecoCompleto, textoRepresentante, type Emitente } from "@/core/proposta-emitente";
import { acrescentarItem, alterarItem, moverItem, removerItem } from "@/core/proposta-itens";
import type { ResultadoProposta } from "@/core/proposta-custo";
import { obterModelo } from "@/core/proposta-modelos";
import type { DadosProposta } from "@/core/types-detalhe";
import { formatarMoeda } from "@/lib/formato";
import { cn } from "@/lib/utils";

/** Colunas da tabela de itens; abaixo dessa largura cada item vira um cartão. */
const COLUNAS_EDICAO = "@3xl:grid-cols-[2rem_minmax(0,1fr)_3.5rem_4.5rem_7rem_7rem_6.5rem]";
const COLUNAS_LEITURA = "@3xl:grid-cols-[2rem_minmax(0,1fr)_3.5rem_4.5rem_7rem_7rem]";

const BOTAO_LINHA =
  "inline-flex size-11 items-center justify-center rounded-sm text-black/60 outline-none hover:bg-black/5 hover:text-black focus-visible:ring-2 focus-visible:ring-[#f57e11] disabled:pointer-events-none disabled:opacity-30 @3xl:size-8";

type Editar = (alterar: (f: Formulario) => Formulario) => void;

interface Props {
  form: Formulario;
  /** Mesmos dados que seguem para o banco e para o PDF: de onde saem os totais */
  dados: DadosProposta;
  emitente: Emitente;
  /** true: textos viram campos; false: só leitura */
  editavel: boolean;
  aoEditar: Editar;
  /** Conta de custo por item (interna): só aparece no modo de edição, nunca no documento nem na impressão */
  resultado?: ResultadoProposta;
  className?: string;
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 @md:grid-cols-[9rem_minmax(0,1fr)] @md:gap-x-3">
      <dt className="font-semibold">{rotulo}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Celula({ rotulo, className, children }: { rotulo: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="mb-0.5 text-[13px] text-black/60 @3xl:hidden">{rotulo}</p>
      {children}
    </div>
  );
}

function LinkPerfil() {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-black/60 print:hidden">
      <Lock aria-hidden className="size-3.5 shrink-0" />
      <span>Dados da empresa, não editáveis aqui.</span>
      <Link
        href="/empresa"
        className="inline-flex min-h-8 items-center font-medium text-[#c2570a] underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[#f57e11]"
      >
        Editar no perfil da empresa
      </Link>
    </p>
  );
}

/**
 * Documento da proposta que corre na largura da tela: no celular o texto fica em tamanho de leitura e os itens
 * viram cartões. Em modo de edição cada texto é um campo no próprio documento. O A4 fica para o PDF.
 */
export function DocumentoEditavel({ form, dados, emitente, editavel, aoEditar, resultado, className }: Props) {
  const modelo = obterModelo(form.modelo);
  const total = totalProposta(dados) / 100;

  function campo<K extends keyof Formulario>(chave: K) {
    return (valor: Formulario[K]) => aoEditar((f) => ({ ...f, [chave]: valor }));
  }

  function mudarItem(chave: number, parte: Partial<ItemFormulario>) {
    aoEditar((f) => ({ ...f, itens: alterarItem(f.itens, chave, parte) }));
  }

  const mostrar = (valor: string): boolean => editavel || valor.trim() !== "";
  const mostrarAssinatura = emitente.assinatura !== "" && form.assinar;
  const colunas = editavel ? COLUNAS_EDICAO : COLUNAS_LEITURA;

  return (
    <article
      className={cn(
        "box-border w-full max-w-[860px] rounded-card border border-border bg-white p-4 text-base leading-[1.5] text-black shadow-sm sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none",
        className,
      )}
      style={{ colorScheme: "light" }}
    >
      <div className="@container flex flex-col gap-5">
        {editavel && (
          <p className="rounded-sm bg-[#f57e11]/10 px-3 py-2 text-[13px] leading-snug text-black/80 print:hidden">
            Toque em qualquer texto do documento para editar. Os textos do modelo e os dados da empresa não mudam aqui.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-3 border-b border-black pb-3">
            <Image src="/raposa.svg" alt="" width={249} height={254} unoptimized className="h-12 w-auto shrink-0" />
            <div className="min-w-0 text-[15px] leading-snug">
              <p className="text-base font-bold">{emitente.razaoSocial}</p>
              <p>CNPJ {emitente.cnpj}</p>
              <p>{enderecoCompleto(emitente)}</p>
              {(emitente.telefone !== "" || emitente.email !== "") && (
                <p className="break-words">{[emitente.telefone, emitente.email].filter((p) => p !== "").join(" · ")}</p>
              )}
            </div>
          </div>
          {editavel && <LinkPerfil />}
        </div>

        <h1 className="text-center text-lg font-bold tracking-wide">PROPOSTA COMERCIAL</h1>

        <section className="flex flex-col">
          <p>À</p>
          <div className="font-bold">
            <CampoInline rotulo="Órgão" valor={form.orgao} aoMudar={campo("orgao")} editavel={editavel} linhaUnica maxLength={200} />
          </div>
          {mostrar(form.unidade) && (
            <CampoInline rotulo="Unidade" valor={form.unidade} aoMudar={campo("unidade")} editavel={editavel} linhaUnica maxLength={200} />
          )}
        </section>

        <dl className="flex flex-col gap-1.5">
          {mostrar(form.numeroCompra) && (
            <Linha rotulo="Compra">
              <CampoInline
                rotulo="Nº da compra"
                valor={form.numeroCompra}
                aoMudar={campo("numeroCompra")}
                editavel={editavel}
                linhaUnica
                maxLength={60}
              />
            </Linha>
          )}
          {mostrar(form.processo) && (
            <Linha rotulo="Processo">
              <CampoInline
                rotulo="Processo"
                valor={form.processo}
                aoMudar={campo("processo")}
                editavel={editavel}
                linhaUnica
                maxLength={60}
              />
            </Linha>
          )}
          {mostrar(form.objeto) && (
            <Linha rotulo="Objeto">
              <CampoInline rotulo="Objeto" valor={form.objeto} aoMudar={campo("objeto")} editavel={editavel} />
            </Linha>
          )}
        </dl>

        <p>{modelo.textos.abertura}</p>

        <section aria-label="Itens da proposta" className="flex flex-col gap-3">
          <div
            aria-hidden
            className={cn("hidden gap-x-2 bg-[#e8e8e8] px-1 py-1 text-[13px] font-semibold @3xl:grid", colunas)}
          >
            <span>Item</span>
            <span>Descrição</span>
            <span>Un.</span>
            <span className="text-right">Qtd.</span>
            <span className="text-right">Unitário</span>
            <span className="text-right">Total</span>
            {editavel && <span />}
          </div>

          {form.itens.length === 0 && editavel && <p className="text-black/60">Nenhum item. Adicione o primeiro.</p>}

          <ul className="flex flex-col gap-3 @3xl:gap-0">
            {form.itens.map((item, indice) => {
              const linha = dados.itens[indice];
              const totalLinha = linha ? totalItemCentavos(linha) / 100 : 0;
              const custoLinha = resultado?.itens[indice];
              return (
                <li
                  key={item.chave}
                  className={cn(
                    "grid grid-cols-2 gap-x-3 gap-y-2 rounded-sm border border-black/20 p-3 @3xl:items-start @3xl:gap-x-2 @3xl:gap-y-0 @3xl:rounded-none @3xl:border-0 @3xl:border-b @3xl:px-1 @3xl:py-1.5",
                    colunas,
                  )}
                >
                  <p className="col-span-2 font-semibold @3xl:col-span-1">
                    <span className="@3xl:hidden">Item </span>
                    {indice + 1}
                  </p>

                  <div className="col-span-2 flex min-w-0 flex-col gap-1 @3xl:col-span-1">
                    <Celula rotulo="Descrição">
                      <CampoInline
                        rotulo={`Descrição do item ${indice + 1}`}
                        valor={item.descricao}
                        aoMudar={(v) => mudarItem(item.chave, { descricao: v })}
                        editavel={editavel}
                      />
                    </Celula>
                    {mostrar(item.marcaModelo) && (
                      <div className="min-w-0 text-[15px]">
                        <p className="text-[13px] text-black/60">Marca/modelo</p>
                        <CampoInline
                          rotulo={`Marca e modelo do item ${indice + 1}`}
                          valor={item.marcaModelo}
                          aoMudar={(v) => mudarItem(item.chave, { marcaModelo: v })}
                          editavel={editavel}
                          linhaUnica
                          maxLength={200}
                        />
                      </div>
                    )}
                  </div>

                  <Celula rotulo="Unidade">
                    <CampoInline
                      rotulo={`Unidade do item ${indice + 1}`}
                      valor={item.unidade}
                      aoMudar={(v) => mudarItem(item.chave, { unidade: v })}
                      editavel={editavel}
                      linhaUnica
                      maxLength={20}
                    />
                  </Celula>

                  <Celula rotulo="Quantidade" className="@3xl:text-right">
                    {editavel ? (
                      <CampoInline
                        rotulo={`Quantidade do item ${indice + 1}`}
                        valor={item.quantidade}
                        aoMudar={(v) => mudarItem(item.chave, { quantidade: v })}
                        editavel
                        linhaUnica
                        inputMode="decimal"
                        maxLength={14}
                      />
                    ) : (
                      <p className="tabular-nums">{linha ? quantidadeTexto(linha.quantidade) : ""}</p>
                    )}
                  </Celula>

                  <Celula rotulo="Valor unitário" className="@3xl:text-right">
                    {editavel ? (
                      <>
                        <div className="flex items-baseline gap-1 tabular-nums @3xl:justify-end">
                          <span aria-hidden>R$</span>
                          <CampoInline
                            rotulo={`Valor unitário do item ${indice + 1}`}
                            valor={item.valorUnitario}
                            aoMudar={(v) => mudarItem(item.chave, { valorUnitario: v })}
                            editavel
                            linhaUnica
                            inputMode="decimal"
                            maxLength={16}
                            className="min-w-0 flex-1"
                          />
                        </div>
                        {item.referencia !== null && (
                          <p className="text-xs tabular-nums text-black/60 print:hidden">
                            ref. {formatarMoeda(item.referencia)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="tabular-nums">{formatarMoeda(linha?.valorUnitario ?? 0)}</p>
                    )}
                  </Celula>

                  <Celula rotulo="Total do item" className="@3xl:text-right">
                    <p className="font-semibold tabular-nums">{formatarMoeda(totalLinha)}</p>
                  </Celula>

                  {editavel && (
                    <div className="col-span-2 flex flex-col gap-1.5 rounded-sm bg-[#f57e11]/10 px-2.5 py-2 text-[13px] leading-snug text-black/80 print:hidden @3xl:col-span-full @3xl:mt-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Lock aria-hidden className="size-3 shrink-0" />
                          Custo unit.
                        </span>
                        <span className="inline-flex items-baseline gap-1 tabular-nums">
                          <span aria-hidden>R$</span>
                          <CampoInline
                            rotulo={`Custo unitário do item ${indice + 1}`}
                            valor={item.custoUnitario}
                            aoMudar={(v) => mudarItem(item.chave, { custoUnitario: v, fonteCusto: "" })}
                            editavel
                            linhaUnica
                            inputMode="decimal"
                            maxLength={16}
                            className="w-24"
                          />
                        </span>
                        <span className="text-black/60">só você vê, não sai no documento</span>
                      </div>
                      {item.custoUnitario === "" ? (
                        <p>
                          <span className="inline-flex rounded-sm bg-[#fef3c7] px-1.5 py-0.5 text-xs font-semibold text-[#92400e]">
                            Falta custo
                          </span>
                        </p>
                      ) : (
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
                          {custoLinha?.prejuizo && (
                            <span className="inline-flex rounded-sm bg-[#fee2e2] px-1.5 py-0.5 text-xs font-semibold text-[#b91c1c]">
                              Prejuízo
                            </span>
                          )}
                          {custoLinha !== undefined && custoLinha.precoMinimoUnitario !== null && (
                            <span>Preço mínimo sem prejuízo: {formatarMoeda(custoLinha.precoMinimoUnitario)}</span>
                          )}
                        </p>
                      )}
                      {item.fonteCusto !== "" && <p className="text-black/60">Custo preenchido pelo sistema: {item.fonteCusto}</p>}
                    </div>
                  )}

                  {editavel && (
                    <div className="col-span-2 flex justify-end gap-1 print:hidden @3xl:col-span-1 @3xl:col-start-7 @3xl:row-start-1 @3xl:justify-start">
                      <button
                        type="button"
                        aria-label={`Subir o item ${indice + 1}`}
                        disabled={indice === 0}
                        onClick={() => aoEditar((f) => ({ ...f, itens: moverItem(f.itens, indice, -1) }))}
                        className={BOTAO_LINHA}
                      >
                        <ChevronUp aria-hidden className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Descer o item ${indice + 1}`}
                        disabled={indice === form.itens.length - 1}
                        onClick={() => aoEditar((f) => ({ ...f, itens: moverItem(f.itens, indice, 1) }))}
                        className={BOTAO_LINHA}
                      >
                        <ChevronDown aria-hidden className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remover o item ${indice + 1}`}
                        onClick={() => aoEditar((f) => ({ ...f, itens: removerItem(f.itens, item.chave) }))}
                        className={cn(BOTAO_LINHA, "hover:text-[#b91c1c]")}
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {editavel && (
            <button
              type="button"
              onClick={() => aoEditar((f) => ({ ...f, itens: acrescentarItem(f.itens, itemVazio) }))}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-dashed border-[#f57e11] px-4 text-[15px] font-medium text-[#c2570a] outline-none hover:bg-[#f57e11]/10 focus-visible:ring-2 focus-visible:ring-[#f57e11] print:hidden @3xl:w-auto @3xl:self-start"
            >
              <Plus aria-hidden className="size-4" />
              Adicionar item
            </button>
          )}
        </section>

        <div className="text-right">
          <p className="text-lg font-bold tabular-nums">Valor total: {formatarMoeda(total)}</p>
          <p className="text-[15px]">({valorPorExtenso(total)})</p>
        </div>

        <section className="flex flex-col gap-1.5">
          <h2 className="font-bold">Condições da proposta</h2>
          <dl className="flex flex-col gap-1.5">
            <Linha rotulo="Validade">
              {editavel ? (
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <CampoInline
                    rotulo="Validade em dias"
                    valor={form.validadeDias}
                    aoMudar={campo("validadeDias")}
                    editavel
                    linhaUnica
                    inputMode="numeric"
                    maxLength={4}
                    className="w-14"
                  />
                  <span>dias, contados da data desta proposta</span>
                </span>
              ) : (
                <span>{dados.validadeDias} dias, contados da data desta proposta</span>
              )}
            </Linha>
            {mostrar(form.prazoEntrega) && (
              <Linha rotulo="Prazo de entrega">
                <CampoInline rotulo="Prazo de entrega" valor={form.prazoEntrega} aoMudar={campo("prazoEntrega")} editavel={editavel} />
              </Linha>
            )}
            {mostrar(form.localEntrega) && (
              <Linha rotulo="Local de entrega">
                <CampoInline rotulo="Local de entrega" valor={form.localEntrega} aoMudar={campo("localEntrega")} editavel={editavel} />
              </Linha>
            )}
            {mostrar(form.pagamento) && (
              <Linha rotulo="Pagamento">
                <CampoInline rotulo="Condições de pagamento" valor={form.pagamento} aoMudar={campo("pagamento")} editavel={editavel} />
              </Linha>
            )}
            {mostrar(form.garantia) && (
              <Linha rotulo="Garantia">
                <CampoInline rotulo="Garantia" valor={form.garantia} aoMudar={campo("garantia")} editavel={editavel} />
              </Linha>
            )}
            {mostrar(form.observacoes) && (
              <Linha rotulo="Observações">
                <CampoInline rotulo="Observações" valor={form.observacoes} aoMudar={campo("observacoes")} editavel={editavel} />
              </Linha>
            )}
            {emitente.dadosBancarios !== "" && (
              <Linha rotulo="Dados bancários">
                <span className="whitespace-pre-line">{emitente.dadosBancarios}</span>
              </Linha>
            )}
            {textoRepresentante(emitente) !== "" && (
              <Linha rotulo="Representante legal">
                <span>{textoRepresentante(emitente)}</span>
              </Linha>
            )}
          </dl>
        </section>

        <section className="flex flex-col gap-1.5">
          <h2 className="font-bold">Declarações</h2>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            {modelo.textos.declaracoes.map((texto) => (
              <li key={texto}>{texto}</li>
            ))}
          </ol>
        </section>

        <p>{modelo.textos.fechamento}</p>

        <div className="flex flex-col gap-2">
          <p>
            {emitente.cidade}, {dataPorExtenso(form.data)}.
          </p>
          {editavel && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-black/60 print:hidden">
              <span>Data da proposta</span>
              <CampoData rotulo="Data da proposta" valor={form.data} aoMudar={campo("data")} />
            </p>
          )}
          {editavel && emitente.assinatura !== "" && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-black/60 print:hidden">
              <input
                type="checkbox"
                checked={form.assinar}
                onChange={(e) => campo("assinar")(e.target.checked)}
                className="size-4 cursor-pointer accent-[#f57e11]"
              />
              Incluir assinatura
            </label>
          )}
          {mostrarAssinatura && (
            // data URL salva no perfil: next/image não se aplica a esse tipo de origem
            // eslint-disable-next-line @next/next/no-img-element
            <img src={emitente.assinatura} alt="Assinatura" className="mt-4 block h-[16mm] w-full max-w-[90mm] object-contain object-left" />
          )}
          <div className={`${mostrarAssinatura ? "mt-0" : "mt-8"} w-full max-w-[90mm] border-t border-black pt-1 text-[15px] leading-snug`}>
            {emitente.responsavel !== "" && <p className="font-bold">{emitente.responsavel}</p>}
            <p>{emitente.razaoSocial}</p>
            <p>CNPJ {emitente.cnpj}</p>
          </div>
          {editavel && <LinkPerfil />}
        </div>
      </div>
    </article>
  );
}
