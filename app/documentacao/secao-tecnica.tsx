import Link from "next/link";
import { Cable, Layers, Lock, ShieldCheck, Timer } from "lucide-react";
import { lerSessao } from "@/lib/sessao";
import { Cartao, Codigo, Grade, Lista, Secao } from "./blocos";

/** Conteúdo técnico: só entra no HTML quando a sessão é de superadmin. */
export async function SecaoTecnica() {
  let superadmin = false;
  try {
    superadmin = (await lerSessao())?.superadmin === true;
  } catch {
    superadmin = false;
  }

  if (!superadmin) {
    return (
      <Secao id="tecnica" titulo="Técnica" resumo="Arquitetura, integrações, rotinas e segurança." icone={Lock}>
        <Cartao titulo="Área interna" icone={Lock}>
          <p>Área interna. Entre com uma conta de administrador.</p>
          <Link
            href="/login"
            className="mt-1 inline-flex h-11 w-fit items-center rounded-xl bg-brand-fill px-4 text-sm font-semibold text-black outline-none hover:bg-brand-fill/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Entrar
          </Link>
        </Cartao>
      </Secao>
    );
  }

  return (
    <Secao id="tecnica" titulo="Técnica" resumo="Arquitetura, integrações, rotinas e segurança (visível só para administradores)." icone={Lock}>
      <Cartao titulo="Arquitetura" icone={Layers}>
        <Lista
          itens={[
            "Next.js 16 (App Router, Server Components e Server Actions), TypeScript estrito e Tailwind.",
            <>
              Banco Postgres pelo pooler em modo sessão, com poucas conexões por instância. Migrations manuais em{" "}
              <Codigo>db/migrations</Codigo>, aplicadas só com autorização.
            </>,
            <>
              Camadas: <Codigo>core/</Codigo> regras puras e testadas; <Codigo>db/</Codigo> consultas, sempre filtradas pela empresa;{" "}
              <Codigo>lib/</Codigo> integrações e orquestração; <Codigo>app/</Codigo> telas e rotas; <Codigo>components/</Codigo> interface.
            </>,
            "Testes com Vitest, verificação de tipos e lint antes de cada publicação.",
            "As telas leem só o banco; nada chama o PNCP na hora de abrir (exceto a busca direta, sob pedido). Filtro, ordenação e paginação rodam no servidor, e a coleta longa nunca roda dentro da visita.",
          ]}
        />
      </Cartao>

      <Cartao titulo="Integrações" icone={Cable}>
        <Lista
          itens={[
            "PNCP: consulta por UF e modalidade, busca por texto em tempo real, itens e resultados (acesso público).",
            "Agregador de diários oficiais e prefeituras: segunda fonte de licitações, com limite diário de consultas.",
            "Consulta de CNPJ ao criar a empresa (API pública).",
            "WhatsApp: envio de mensagens e webhook com assinatura conferida.",
            "Modelo de linguagem: conselheiro, ficha do edital e rascunho de proposta.",
            "E-mail: resumo diário.",
          ]}
        />
      </Cartao>

      <Cartao titulo="Rotinas" icone={Timer}>
        <ul className="flex flex-col gap-2">
          {[
            ["7h", "Coleta do PNCP e da segunda fonte, resumo por e-mail, avisos, resultados e desertas."],
            ["7h30", "Rascunhos de proposta."],
            ["7h às 20h, de hora em hora", "Envio dos alertas de WhatsApp."],
            ["Sob demanda", "Coleta pedida pelo Radar ou por estado novo, em chamada separada."],
          ].map(([quando, o_que]) => (
            <li key={quando} className="flex flex-col gap-1 rounded-xl bg-raised p-3 sm:flex-row sm:gap-3">
              <span className="shrink-0 text-sm font-medium text-ink sm:w-52">{quando}</span>
              <span className="text-sm">{o_que}</span>
            </li>
          ))}
        </ul>
        <p>O Radar lê de um cache por UF e modalidade; cache com mais de 30 minutos pede nova coleta em segundo plano.</p>
      </Cartao>

      <Grade>
        <Cartao titulo="Segurança em vigor" icone={ShieldCheck}>
          <Lista
            itens={[
              "Senha com hash scrypt; sessão em cookie assinado, httpOnly, secure e sameSite, conferida no banco a cada pedido.",
              "Isolamento por empresa em toda consulta; empresa ativa do gestor validada a cada pedido.",
              "Permissões por papel conferidas no servidor.",
              "Rotas agendadas exigem segredo; o webhook confere a assinatura do corpo.",
              "Limite de tentativas de login por e-mail.",
              "Cabeçalhos de segurança: sem iframe de terceiros, nosniff, HSTS, política de referência e de permissões.",
              "Segredos só em variáveis de ambiente.",
            ]}
          />
        </Cartao>
        <Cartao titulo="A melhorar" icone={ShieldCheck}>
          <Lista
            itens={[
              "Mover o limite de login da memória para o banco.",
              "Papel de banco com RLS por empresa (hoje o isolamento depende do código).",
              "Política de CSP completa para scripts e estilos.",
              "Registro de auditoria de acesso a dados sensíveis.",
              "Recuperação de senha e verificação em duas etapas para dono e superadmin.",
            ]}
          />
        </Cartao>
      </Grade>
    </Secao>
  );
}
