"use client";

import Image from "next/image";
import { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface AvatarProps {
  user?: Doc<"users"> | null;
  size?: "sm" | "md" | "lg";
  showOnlineStatus?: boolean;
}

const sizes = {
  sm: "w-8 h-8 text-sm",
  md: "w-12 h-12 text-lg",
  lg: "w-16 h-16 text-2xl",
};

const dotSizes = {
  sm: "w-2 h-2 border",
  md: "w-3 h-3 border-2",
  lg: "w-4 h-4 border-2",
};

export function Avatar({ user, size = "md", showOnlineStatus = false }: AvatarProps) {
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const colors = [
    "from-blue-400 to-blue-600",
    "from-purple-400 to-purple-600",
    "from-green-400 to-green-600",
    "from-orange-400 to-orange-600",
    "from-pink-400 to-pink-600",
    "from-teal-400 to-teal-600",
  ];

  const colorIndex = user
    ? user.name.charCodeAt(0) % colors.length
    : 0;

  return (
    <div className="relative inline-block">
      <div
        className={cn(
          "rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden",
          sizes[size]
        )}
      >
        {user?.imageUrl ? (
          <Image
            src={user.imageUrl}
            alt={user.name}
            width={64}
            height={64}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={cn(
              "w-full h-full flex items-center justify-center bg-gradient-to-br text-white font-semibold",
              colors[colorIndex]
            )}
          >
            {initials}
          </div>
        )}
      </div>

      {showOnlineStatus && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-white",
            dotSizes[size],
            user?.isOnline ? "bg-green-500" : "bg-gray-400"
          )}
        />
      )}
    </div>
  );
}
