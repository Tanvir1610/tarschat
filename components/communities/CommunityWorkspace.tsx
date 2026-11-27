"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { ArrowLeft, Hash, Lock, Megaphone, MessageCircle, Settings, Users, X } from "lucide-react";
import { CommunityIcon } from "./CommunityIcon";
import { ChannelChat } from "./ChannelChat";
import { MemberPanel } from "./MemberPanel";
import { CommunitySettingsModal } from "./CommunitySettingsModal";
import { Modal } from "../ui";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { isStaff, type OkPreview, type Role } from "@/lib/communities";
import { cn } from "@/lib/utils";

const channelIcon = (kind: string) => (kind === "announcements" ? Megaphone : kind === "discussion" ? MessageCircle : Hash);

interface Props {
  preview: OkPreview;
  role: Role;
  me: Doc<"users">;
  channelSlug?: string;
  onChannel: (slug: string) => void;
  onBack: () => void;
  onLeft: () => void;
}

export function CommunityWorkspace({ preview, role, me, channelSlug, onChannel, onBack, onLeft }: Props) {
  const c = preview.community;
  const channel = preview.channels.find((ch) => ch.slug === channelSlug) ?? preview.channels[0];
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const reportCount = useQuery(api.moderation.openReportCount, isStaff(role) ? { communityId: c._id } : "skip") ?? 0;

  return (
    <div className="chat-wash flex h-full min-h-0 bg-bg">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="pt-safe z-10 border-b border-line bg-surface/85 backdrop-blur-xl">
          <div className="flex items-center gap-1.5 px-2 py-2.5 sm:gap-3 sm:px-4">
            <button onClick={onBack} className="icon-btn md:hidden" aria-label="Back to communities"><ArrowLeft className="h-5 w-5" /></button>
            <CommunityIcon name={c.name} url={c.iconUrl} size="md" />
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-1.5 truncate text-[15px] font-semibold leading-tight text-fg">
                <span className="truncate">{c.name}</span>
                {c.visibility === "private" && <Lock className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Private community" />}
              </h1>
              <p className="mt-0.5 truncate text-xs text-muted">{c.memberCount} {c.memberCount === 1 ? "member" : "members"}</p>
            </div>
            <button onClick={() => setShowMembers((v) => !v)} className={cn("icon-btn", showMembers && "bg-subtle text-fg")} aria-label="Members" aria-pressed={showMembers}><Users className="h-5 w-5" /></button>
            <button onClick={() => setShowSettings(true)} className="icon-btn relative" aria-label="Community settings">
              <Settings className="h-5 w-5" />
              {reportCount > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-surface">{reportCount}</span>}
            </button>
          </div>
          <nav aria-label="Channels" className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 scrollbar-hide sm:px-5">
            {preview.channels.map((ch) => {
              const I = channelIcon(ch.kind);
              const active = ch._id === channel?._id;
              return (
                <button key={ch._id} onClick={() => onChannel(ch.slug)} aria-current={active ? "page" : undefined} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition active:scale-95", active ? "bg-brand text-white shadow-glow" : "bg-subtle text-muted hover:text-fg")}>
                  <I className="h-3.5 w-3.5" />{ch.name}
                  {ch.postingRestricted && <Lock className="h-3 w-3 opacity-70" aria-label="Moderators only" />}
                </button>
              );
            })}
          </nav>
        </header>

        {channel && <ChannelChat key={channel._id} channel={channel} communityName={c.name} myRole={role} me={me} />}
      </div>

      {showMembers && isDesktop && (
        <aside aria-label="Members" className="flex w-72 shrink-0 flex-col border-l border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 className="text-sm font-semibold text-fg">Members</h2>
            <button onClick={() => setShowMembers(false)} className="icon-btn h-8 w-8" aria-label="Close members"><X className="h-4 w-4" /></button>
          </div>
          <MemberPanel communityId={c._id} myRole={role} me={me} />
        </aside>
      )}
      {showMembers && !isDesktop && (
        <Modal title="Members" icon={<Users className="h-5 w-5" />} onClose={() => setShowMembers(false)}>
          <div className="h-[60dvh]"><MemberPanel communityId={c._id} myRole={role} me={me} /></div>
        </Modal>
      )}
      {showSettings && <CommunitySettingsModal community={c} myRole={role} reportCount={reportCount} onClose={() => setShowSettings(false)} onLeft={() => { setShowSettings(false); onLeft(); }} />}
    </div>
  );
}
