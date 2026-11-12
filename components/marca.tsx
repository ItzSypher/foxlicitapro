import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Raposa laranja: a marca é só ela, sem o nome ao lado.
 * O alt carrega o nome para leitores de tela.
 */
export function Marca({ className }: { className?: string }) {
  return (
    <Image
      src="/raposa.svg"
      alt="FoxLicita Pro"
      width={249}
      height={254}
      unoptimized
      priority
      className={cn("size-8 shrink-0 object-contain", className)}
    />
  );
}
