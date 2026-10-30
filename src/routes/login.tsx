import { createFileRoute } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  return (
    <main className="grid min-h-screen place-items-center bg-sky px-4">
      <div className="w-full max-w-sm rounded-2xl bg-sheet p-6 shadow-card">
        <img src="/sample-illustration.svg" alt="" className="face size-14 rounded-full" />
        <h1 className="mt-4 font-serif text-3xl">登入報價簿</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          此公開示例使用虛構目錄及方案資料，請勿輸入真實客戶或工程資訊。
        </p>
        <div className="mt-5 grid gap-2">
          {authEnabled ? (
            GROK_PROVIDERS.map((provider) => (
              <button
                key={provider.providerId}
                type="button"
                onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
                className="h-11 rounded-lg bg-ink px-4 text-sm font-medium text-sun"
              >
                用 {provider.label} 登入
              </button>
            ))
          ) : (
            <p className="text-sm text-muted">登入未開。</p>
          )}
        </div>
      </div>
    </main>
  );
}
