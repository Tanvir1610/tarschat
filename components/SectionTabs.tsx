"use client";

import { MessageSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type Section = "chats" | "communities";

/** Top-level switch between direct/group chats and Tars Communities */
export function SectionTabs({
  section,
  onChange,
  inviteCount = 0,
}: {
  section: Section;
  onChange: (s: Section) => void;
  inviteCount?: number;
}) {
  const tabs = [
    { id: "chats" as const, label: "Chats", icon: MessageSquare },
    { id: "communities" as const, label: "Communities", icon: Users },
  ];
  return (
    <div className="pt-safe border-b border-line bg-surface px-3 pb-2.5 pt-3">
      <div role="tablist" aria-label="Sections" className="grid grid-cols-2 gap-1 rounded-2xl bg-subtle p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={section === id}
            onClick={() => onChange(id)}
            className={cn(
              "relative flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold transition",
              section === id ? "bg-elevated text-fg shadow-soft" : "text-muted hover:text-fg"
            )}
          >
            <Icon className={cn("h-4 w-4", section === id && "text-accent")} />
            {label}
            {id === "communities" && inviteCount > 0 && (
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {inviteCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
