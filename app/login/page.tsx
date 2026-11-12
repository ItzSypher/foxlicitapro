import { Marca } from "@/components/marca";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ground p-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-sheet border border-border bg-surface p-6">
        <div className="flex items-center">
          <Marca className="size-14" />
          <h1 className="sr-only">Entrar</h1>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
