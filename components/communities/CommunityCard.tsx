"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Check, Lock, Users } from "lucide-react";
import { CommunityIcon } from "./CommunityIcon";
import { Spinner, errorMessage, useToast } from "../ui";
import { categoryLabel, compactNumber, type CommunitySummary } from "@/lib/communities";
import { cn } from "@/lib/utils";

interface CommunityCardProps {
  community: CommunitySummary;
  onOpen: (slug: string) => void;
  variant?: "card" | "row";
}

export function CommunityCard({ community: c, onOpen, variant = "card" }: CommunityCardProps) {
  const join = useMutation(api.communities.join);
  const toast = useToast();
  const [joining, setJoining] = useState(false);

  const handleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setJoining(true);
    try {
      await join({ communityId: c._id });
      toast(`Joined ${c.name}`);
      onOpen(c.slug);
    } catch (err) {
      toast(errorMessage(err, "Couldn't join this community."), "error");
    } finally {
      setJoining(false);
    }
  };

  const action = c.isMember ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
      <Check className="h-3 w-3" /> Joined
    </span>
  ) : c.visibility === "public" ? (
    <button onClick={handleJoin} disabled={joining} className="bg-brand inline-flex min-w-[4.5rem] items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-glow transition active:scale-95 disabled:opacity-60">
      {joining ? <Spinner className="h-3.5 w-3.5" /> : "Join"}
    </button>
  ) : null;

  const meta = (
    <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
      <span className="inline-flex shrink-0 items-center gap-1">
        <Users className="h-3.5 w-3.5" />
        <span className="tabular-nums">{compactNumber(c.memberCount)}</span> {c.memberCount === 1 ? "member" : "members"}
      </span>
      <span aria-hidden>·</span>
      <span className="min-w-0 truncate">{categoryLabel(c.category)}</span>
    </div>
  );

  if (variant === "row") {
    // A div (not a <button>) so the Join button inside it is valid HTML
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(c.slug)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(c.slug))}
        className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-line bg-elevated p-3 text-left shadow-soft transition hover:border-accent/40 hover:shadow-pop active:scale-[0.99]"
      >
        <CommunityIcon name={c.name} url={c.iconUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{c.name}</p>
          {meta}
        </div>
        {action}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(c.slug)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(c.slug))}
      className={cn(
        "group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-elevated shadow-soft transition",
        "hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-pop active:scale-[0.99]"
      )}
    >
      <div className="bg-brand relative h-16 opacity-90" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.35),transparent_60%)]" />
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4">
        <CommunityIcon name={c.name} url={c.iconUrl} size="lg" className="-mt-8 border-4 border-elevated" />
        <div className="mt-2 flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-[15px] font-semibold text-fg">{c.name}</h3>
          {c.visibility === "private" && <Lock className="mt-1 h-3.5 w-3.5 shrink-0 text-muted" aria-label="Private" />}
        </div>
        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[13px] leading-snug text-muted">{c.description}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          {meta}
          {action}
        </div>
      </div>
    </div>
  );
}
