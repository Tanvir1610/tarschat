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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 font-medium mb-2">Failed to connect to server.</p>
          <p className="text-gray-400 text-sm mb-4">Check your Convex URL in environment variables.</p>
          <button
            onClick={() => { setError(false); setInitialized(false); }}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-gray-500">Setting up your account...</p>
        </div>
      </div>
    );
  }

  return <ChatLayout clerkId={user.id} />;
}
