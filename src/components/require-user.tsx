import type { ReactNode } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LOGIN_REQUIRED } from "@/lib/saas/open";

export function RequireUser({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (!LOGIN_REQUIRED) return children;
  if (isPending) return <p className="px-4 py-16 text-sm text-muted">登入資料載入緊…</p>;
  if (!user) return <RedirectToSignIn />;
  return children;
}