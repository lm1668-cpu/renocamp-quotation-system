import { createMiddleware } from "@tanstack/react-start";
import { GUEST_USER_ID, LOGIN_REQUIRED } from "@/lib/saas/open";

export const openMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
    const { requireUserId } = await import("@/lib/auth/verify.server");
    assertSameSiteRequest();
    let userId = GUEST_USER_ID;
    if (LOGIN_REQUIRED) {
      userId = await requireUserId(context.bearerToken);
    } else {
      try {
        userId = await requireUserId(context.bearerToken);
      } catch {
        userId = GUEST_USER_ID;
      }
    }
    return next({ context: { userId } });
  });
