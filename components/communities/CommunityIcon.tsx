"use client";

import { cn } from "@/lib/utils";

const fills = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-rose-600",
  "from-pink-500 to-fuchsia-600",
  "from-cyan-500 to-blue-600",
];

const sizes = {
  sm: "h-9 w-9 rounded-xl text-sm",
  md: "h-11 w-11 rounded-2xl text-base",
  lg: "h-16 w-16 rounded-2xl text-2xl",
  xl: "h-24 w-24 rounded-3xl text-4xl",
};

export function CommunityIcon({
  name,
  url,
  size = "md",
  className,
}: {
  name: string;
  url?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const fill = fills[(name.charCodeAt(0) || 0) % fills.length];
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center overflow-hidden font-bold text-white ring-1 ring-black/5 dark:ring-white/10", sizes[size], className)}
      aria-hidden
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", fill)}>
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}
