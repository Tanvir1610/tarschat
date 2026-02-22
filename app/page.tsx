"use client";

import { useUser, RedirectToSignIn } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { ChatLayout } from "@/components/ChatLayout";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const ensureUser = useMutation(api.users.ensureUser);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (user && !initialized) {
      ensureUser({
        clerkId: user.id,
        name: user.fullName ?? user.emailAddresses[0]?.emailAddress ?? "User",
        email: user.emailAddresses[0]?.emailAddress ?? "",
        imageUrl: user.imageUrl,
      }).then(() => setInitialized(true));
    }
  }, [user, ensureUser, initialized]);

  // Still loading
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Not signed in — redirect to Clerk sign-in
  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  // Signed in but user not yet initialized in Convex
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
