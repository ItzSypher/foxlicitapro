import Link from "next/link";

const LINK = /(\/licitacao\/\d{14}\/\d{4}\/\d{1,9}|https:\/\/[^\s)]+)/g;
const CLASSE_LINK = "font-medium text-brand underline underline-offset-2 break-all";

/** Texto simples com quebras de linha; caminhos de licitação e endereços https viram links. */
export function TextoComLinks({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("\n").map((linha, i) => (
        <span key={i} className="block min-h-[1lh]">
          {linha.split(LINK).map((trecho, j) => {
            if (j % 2 === 0) return trecho;
            const pontuacao = /[.,;:!?]+$/.exec(trecho)?.[0] ?? "";
            const alvo = pontuacao === "" ? trecho : trecho.slice(0, -pontuacao.length);
            return (
              <span key={j}>
                {alvo.startsWith("/") ? (
                  <Link href={alvo} className={CLASSE_LINK}>
                    {alvo}
                  </Link>
                ) : (
                  <a href={alvo} target="_blank" rel="noopener noreferrer" className={CLASSE_LINK}>
                    {alvo}
                  </a>
                )}
                {pontuacao}
              </span>
            );
          })}
        </span>
      ))}
    </>
  );
}
