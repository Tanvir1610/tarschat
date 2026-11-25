"use client";

import { Doc } from "@/convex/_generated/dataModel";
import { Avatar } from "./Avatar";

interface TypingIndicatorProps {
  users: Doc<"users">[];
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const names = users.map((u) => u.name.split(" ")[0]);
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
      ? `${names[0]} and ${names[1]} are typing`
      : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <div className="mt-3 flex animate-fade-in items-end gap-2" role="status" aria-live="polite">
      <Avatar user={users[0]} size="sm" />
      <div className="flex items-center gap-2.5 rounded-2xl rounded-bl-md border border-line bg-elevated px-3.5 py-2.5 shadow-soft">
        <div className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
              style={{ animation: "typing-dot 1.2s infinite", animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </div>
        <span className="text-xs text-muted">{label}</span>
      </div>
    </div>
  );
}
