"use client";

import { useUser, RedirectToSignIn } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { ChatLayout } from "@/components/ChatLayout";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const ensureUser = useMutation(api.users.ensureUser);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(false);

  // Check if user already exists in Convex
  const existingUser = useQuery(
    api.users.getCurrentUser,
    user ? { clerkId: user.id } : "skip"
  );

  useEffect(() => {
    // If user already exists in Convex, skip ensureUser
    if (existingUser) {
      setInitialized(true);
      return;
    }

    if (user && !initialized && existingUser === null) {
      ensureUser({
        clerkId: user.id,
        name: user.fullName ?? user.emailAddresses[0]?.emailAddress ?? "User",
        email: user.emailAddresses[0]?.emailAddress ?? "",
        imageUrl: user.imageUrl,
      })
        .then(() => setInitialized(true))
        .catch(() => setError(true));
    }
  }, [user, ensureUser, initialized, existingUser]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg">
        <Loader2 className="h-8 w-8 animate-spin text-accent" aria-label="Loading" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  if (error) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-6">
        <div role="alert" className="max-w-sm text-center">
          <p className="mb-1.5 text-base font-semibold text-danger">Failed to connect to server.</p>
          <p className="mb-5 text-sm text-muted">Check your Convex URL in environment variables.</p>
          <button
            onClick={() => { setError(false); setInitialized(false); }}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg">
        <div className="text-center">
          <div className="bg-brand mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-glow">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
          <p className="text-sm text-muted">Setting up your account…</p>
        </div>
      </div>
    );
  }

  return <ChatLayout clerkId={user.id} />;
}
