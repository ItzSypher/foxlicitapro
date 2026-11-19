import { FundoLogin } from "./fundo-login";
import { LoginForm } from "./login-form";
import { MarcaNome } from "./marca-nome";
import { PainelMarca } from "./painel-marca";

export default function LoginPage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-x-hidden bg-ground">
      <FundoLogin />
      <h1 className="sr-only">Entrar no FoxLicita Pro</h1>
      <div className="mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-10">
        <MarcaNome className="justify-center lg:hidden" />
        <PainelMarca />
        <div className="flex justify-center lg:justify-end">
          <LoginForm />
        </div>
      </div>
      <footer className="px-4 pb-6 text-center text-xs text-faint">© FoxTI Solutions</footer>
    </main>
  );
}
