/** Número de WhatsApp no formato da Evolution API: 55 + DDD + número, só dígitos. Funções puras. */

/** Aceita "(21) 99999-0000", "+55 21 99999-0000", "021999990000" e variações. Devolve null se não der para confiar no número. */
export function normalizarWhatsapp(entrada: string): string | null {
  let digitos = entrada.replace(/\D/g, "").replace(/^0+/, "");
  if (digitos === "") return null;
  // Com DDI: 55 + 10 ou 11 dígitos. Sem DDI: 10 ou 11 dígitos (o DDD 55 também existe, então o tamanho decide).
  if (digitos.length === 12 || digitos.length === 13) {
    if (!digitos.startsWith("55")) return null;
    digitos = digitos.slice(2);
  }
  if (digitos.length !== 10 && digitos.length !== 11) return null;
  if (Number(digitos.slice(0, 2)) < 11) return null;
  // Celular tem 9 dígitos e começa com 9; fixo tem 8 dígitos.
  if (digitos.length === 11 && digitos[2] !== "9") return null;
  return `55${digitos}`;
}

/** "5521999990000" vira "(21) 99999-0000", para mostrar na tela. */
export function formatarWhatsapp(numero: string): string {
  const nacional = numero.startsWith("55") ? numero.slice(2) : numero;
  const ddd = nacional.slice(0, 2);
  const resto = nacional.slice(2);
  const corte = resto.length - 4;
  return corte > 0 ? `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}` : numero;
}
