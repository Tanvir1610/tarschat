"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useOnlineStatus(clerkId: string) {
  const setOnlineStatus = useMutation(api.users.setOnlineStatus);

  useEffect(() => {
    // Set online when component mounts
    setOnlineStatus({ clerkId, isOnline: true });

    // Set offline when tab closes/user leaves
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setOnlineStatus({ clerkId, isOnline: false });
      } else {
        setOnlineStatus({ clerkId, isOnline: true });
      }
    };

    const handleBeforeUnload = () => {
      setOnlineStatus({ clerkId, isOnline: false });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      setOnlineStatus({ clerkId, isOnline: false });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [clerkId, setOnlineStatus]);
}
