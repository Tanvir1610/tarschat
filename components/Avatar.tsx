"use client";

import Image from "next/image";
import { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface AvatarProps {
  user?: Doc<"users"> | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showOnlineStatus?: boolean;
  className?: string;
}

const sizes = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-xl",
  xl: "h-24 w-24 text-3xl",
};

const dotSizes = {
  xs: "h-1.5 w-1.5 border",
  sm: "h-2.5 w-2.5 border-2",
  md: "h-3 w-3 border-2",
  lg: "h-3.5 w-3.5 border-2",
  xl: "h-4 w-4 border-[3px]",
};

// 600-level fills keep white initials above AA contrast
const fills = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-rose-600",
  "from-pink-500 to-fuchsia-600",
  "from-cyan-500 to-blue-600",
];

export function Avatar({ user, size = "md", showOnlineStatus = false, className }: AvatarProps) {
  const initials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const fill = fills[user ? user.name.charCodeAt(0) % fills.length : 0];

  return (
    <div className={cn("relative inline-block shrink-0", className)}>
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10",
          sizes[size]
        )}
      >
        {user?.imageUrl ? (
          <Image
            src={user.imageUrl}
            alt={user.name}
            width={96}
            height={96}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center bg-gradient-to-br font-semibold text-white",
              fill
            )}
            aria-label={user?.name}
          >
            {initials}
          </div>
        )}
      </div>

      {showOnlineStatus && (
        <span
          role="img"
          aria-label={user?.isOnline ? "Online" : "Offline"}
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-surface",
            dotSizes[size],
            user?.isOnline ? "bg-success" : "bg-muted/60"
          )}
        />
      )}
    </div>
  );
}

/** Gradient tile used for group conversations */
export function GroupAvatar({
  name,
  size = "md",
  className,
}: {
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-brand flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-black/5 dark:ring-white/10",
        sizes[size],
        className
      )}
      aria-hidden
    >
      {name?.trim().charAt(0).toUpperCase() || "G"}
    </div>
  );
}
