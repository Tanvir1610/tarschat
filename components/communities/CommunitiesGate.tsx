"use client";

import type { ReactNode } from "react";
import { useConvexAuth } from "convex/react";
import { ShieldAlert } from "lucide-react";
import { EmptyState, Skeleton } from "../ui";

/**
 * Communities rely on the verified Clerk → Convex token (the server decides who you are).
 * If that handshake isn't configured yet, say exactly what to do instead of failing silently.
 */
export function CommunitiesGate({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <EmptyState
        className={compact ? "py-8" : "h-full"}
        icon={<ShieldAlert className="h-6 w-6" />}
        title="Finish the Communities setup"
        description={
          compact
            ? "Convex can't verify your sign-in yet."
            : "Convex can't verify your Clerk sign-in yet. In Clerk, create a JWT template named “convex”, then set CLERK_JWT_ISSUER_DOMAIN in your Convex environment variables and redeploy."
        }
      />
    );
  }
  return <>{children}</>;
}
