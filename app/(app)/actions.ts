"use server";


import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { encerrarSessao, exigirSessao, gravarEmpresaAtiva } from "@/lib/sessao";
import { usuarioAcessaEmpresa } from "@/db/usuario-empresas";
import { COOKIE_FRENTE, ehFrente } from "@/lib/frente";
import { ufsDeColeta } from "@/core/areas";
import { perfilAtual } from "@/lib/empresa-atual";
import { atualizarRadar } from "@/lib/radar-dados";

export async function definirFrente(valor: string): Promise<void> {
  if (!ehFrente(valor)) return;
  const jar = await cookies();
  jar.set(COOKIE_FRENTE, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/radar");
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/login");
}

/** Botão "Atualizar" do Radar: coleta agora só as UFs da empresa (se outra coleta não estiver rodando). */
export async function atualizarRadarAgora(): Promise<void> {
  await exigirSessao();
  const perfil = await perfilAtual();
  await atualizarRadar({ ufs: ufsDeColeta(perfil.areas) });
  revalidatePath("/radar");
}

/** Seletor de empresa de quem gerencia várias: confere o acesso, grava a empresa ativa e volta ao Radar. */
export async function trocarEmpresaAction(empresaId: string): Promise<void> {
  const sessao = await exigirSessao();
  if (typeof empresaId === "string" && (await usuarioAcessaEmpresa(sessao.usuarioId, empresaId))) {
    await gravarEmpresaAtiva(empresaId);
    revalidatePath("/", "layout");
  }
  redirect("/radar");
}
