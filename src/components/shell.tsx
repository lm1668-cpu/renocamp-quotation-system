import { Link, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";
import { loadMyQuotes, saveMyQuotes } from "@/lib/saas/api";
import { LOGIN_REQUIRED } from "@/lib/saas/open";
import { useQuoteStore } from "@/lib/quotes/store";
import { SaveQueue, type SyncStatus } from "@/lib/quotes/sync";
import type { Quote } from "@/lib/quotes/model";

const CREW = ["/sample-illustration.svg", "/sample-illustration.svg", "/sample-illustration.svg"];

type LoadState = "loading" | "ready" | "failed";

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const identity = user?.id ?? (LOGIN_REQUIRED ? null : "anonymous");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const queueRef = useRef<SaveQueue<{ quotes: Quote[]; seq: number }> | null>(null);
  const identityRef = useRef<string | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (isPending) {
      generationRef.current += 1;
      identityRef.current = null;
      cleanupRef.current?.();
      cleanupRef.current = null;
      queueRef.current?.dispose();
      queueRef.current = null;
      setLoadState("loading");
      setSyncStatus("loading");
      return;
    }
    const generation = ++generationRef.current;
    const activeIdentity = identity;
    identityRef.current = activeIdentity;
    queueRef.current?.dispose();
    queueRef.current = null;
    if (!activeIdentity) {
      useQuoteStore.setState({ quotes: [], seq: 0, hydrated: true });
      setLoadState("ready");
      setSyncStatus("ready");
      return;
    }

    setLoadState("loading");
    setSyncStatus("loading");
    useQuoteStore.setState({ quotes: [], seq: 0, hydrated: false });
    let cancelled = false;
    void loadMyQuotes()
      .then((bundle) => {
        if (
          cancelled ||
          generation !== generationRef.current ||
          identityRef.current !== activeIdentity
        )
          return;
        useQuoteStore.setState({ quotes: bundle.quotes, seq: bundle.seq, hydrated: true });
        setLoadState("ready");
        setSyncStatus("ready");

        const queue = new SaveQueue({
          read: () => {
            const { quotes, seq } = useQuoteStore.getState();
            return { quotes, seq };
          },
          save: (snapshot) => saveMyQuotes({ data: snapshot }),
          onStatus: (status) => {
            if (
              cancelled ||
              generation !== generationRef.current ||
              identityRef.current !== activeIdentity
            )
              return;
            setSyncStatus(status);
          },
        });
        queueRef.current = queue;
        const unsubscribe = useQuoteStore.subscribe((state, previous) => {
          if (
            cancelled ||
            generation !== generationRef.current ||
            identityRef.current !== activeIdentity
          )
            return;
          if (state.quotes !== previous.quotes || state.seq !== previous.seq) queue.changed();
        });
        // Keep subscription lifetime tied to this identity/load attempt.
        cleanupRef.current = () => {
          unsubscribe();
          queue.dispose();
        };
      })
      .catch(() => {
        if (
          cancelled ||
          generation !== generationRef.current ||
          identityRef.current !== activeIdentity
        )
          return;
        // Keep the store unavailable; never save an empty fallback over the remote bundle.
        setLoadState("failed");
        setSyncStatus("failed");
      });
    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (generationRef.current === generation) generationRef.current += 1;
    };
  }, [identity, isPending, loadAttempt]);

  const cleanupRef = useRef<(() => void) | null>(null);
  const retrySave = useCallback(() => queueRef.current?.retry(), []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (queueRef.current?.isDirty || queueRef.current?.isFailed) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const statusText =
    loadState === "loading"
      ? "報價簿讀緊"
      : loadState === "failed"
        ? "報價簿讀唔到，請重試"
        : syncStatus === "failed"
          ? "未儲存到，唔好閂頁，請重試"
          : syncStatus === "saving"
            ? "儲存中"
            : syncStatus === "saved"
              ? "已自動儲存"
              : "";

  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-line bg-sheet">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 md:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src="/sample-illustration.svg"
              alt="裝修工程示例"
              className="face size-9 rounded-full border-2 border-sea"
            />
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold leading-tight">
                裝修工程報價示例
              </span>
              <span className="block text-xs text-sea">報價自己話事</span>
            </span>
          </Link>
          <nav className="ml-auto flex flex-wrap items-center gap-2">
            <span className="hidden items-center sm:flex" aria-hidden>
              {CREW.map((src, index) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="face size-6 rounded-full border-2 border-sheet"
                  style={{ marginLeft: index === 0 ? 0 : -8 }}
                />
              ))}
            </span>
            <Link
              to="/"
              className={cn(
                "inline-flex h-11 items-center rounded-lg px-3 text-sm",
                path === "/" ? "bg-ink text-sun" : "text-ink hover:bg-sea-soft",
              )}
            >
              報價簿
            </Link>
            <Link
              to="/plan"
              className={cn(
                "inline-flex h-11 items-center rounded-lg px-3 text-sm",
                path === "/plan" ? "bg-ink text-sun" : "text-ink hover:bg-sea-soft",
              )}
            >
              收費
            </Link>
            <Link
              to="/admin"
              className={cn(
                "inline-flex h-11 items-center rounded-lg px-3 text-sm",
                path === "/admin" ? "bg-ink text-sun" : "text-ink hover:bg-sea-soft",
              )}
            >
              後台
            </Link>
            <UserButton />
          </nav>
        </div>
        <div className="h-1 bg-sun" />
      </header>
      {!LOGIN_REQUIRED ? (
        <p className="no-print bg-sun px-4 py-2 text-center text-sm text-ink">
          示例版本：目錄、單價及方案金額均屬虛構；請勿輸入真實客戶或工程資料。
        </p>
      ) : null}
      {statusText ? (
        <div
          className="no-print mx-auto flex max-w-6xl items-center justify-between px-4 pt-3 text-sm text-muted md:px-6"
          role="status"
          aria-live="polite"
        >
          <span>{statusText}</span>
          {loadState === "failed" ? (
            <button
              className="rounded-md px-3 py-1 text-sea underline"
              onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            >
              重新載入
            </button>
          ) : null}
          {loadState === "ready" && syncStatus === "failed" ? (
            <button className="rounded-md px-3 py-1 text-sea underline" onClick={retrySave}>
              重試儲存
            </button>
          ) : null}
        </div>
      ) : null}
      {isPending || loadState === "loading" || loadState === "failed" ? (
        <main className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted md:px-6">
          {isPending
            ? "登入資料載入緊…"
            : loadState === "loading"
              ? "讀取報價簿…"
              : "未能讀取報價簿，請重試。為免蓋走資料，暫時不能建立或修改報價。"}
        </main>
      ) : (
        children
      )}
      <footer className="no-print mx-auto max-w-6xl px-4 py-10 text-sm text-muted md:px-6">
        <p className="max-w-xl leading-relaxed">
          {LOGIN_REQUIRED
            ? "報價單跟住你嘅帳戶。"
            : "本機示例報價簿；請勿填真實客戶資料。"}
          工程及訂閱金額均為虛構示例；正式工程需按現場及物料重新核價。
        </p>
      </footer>
    </div>
  );
}
