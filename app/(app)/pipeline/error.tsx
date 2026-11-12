"use client";

import { BlocoErro } from "@/components/pipeline/bloco-erro";

export default function ErroPipeline({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <h1 className="text-[22px] font-semibold leading-tight text-ink">Pipeline</h1>
      <BlocoErro aoTentar={reset} />
    </div>
  );
}
