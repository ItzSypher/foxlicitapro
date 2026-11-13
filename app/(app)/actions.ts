"use server";


import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { encerrarSessao, exigirSessao } from "@/lib/sessao";
import { COOKIE_FRENTE, ehFrente } from "@/lib/frente";
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

/** Botão "Atualizar" do Radar: coleta o PNCP agora (se outra coleta não estiver rodando). */
export async function atualizarRadarAgora(): Promise<void> {
  await exigirSessao();
  await atualizarRadar();
  revalidatePath("/radar");
}
