import Image from "next/image";
import { cn } from "@/lib/utils";

/** Raposa + nome do produto. O nome está em texto, por isso a imagem é decorativa. */
export function MarcaNome({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Image
        src="/raposa.svg"
        alt=""
        width={249}
        height={254}
        unoptimized
        priority
        className="size-11 shrink-0 object-contain"
      />
      <span className="text-xl font-semibold tracking-tight text-ink">FoxLicita Pro</span>
    </div>
  );
}
