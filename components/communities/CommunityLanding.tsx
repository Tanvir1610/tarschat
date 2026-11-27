"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, Globe, Hash, Lock, Megaphone, MessageCircle, Users } from "lucide-react";
import { CommunityIcon } from "./CommunityIcon";
import { Spinner, errorMessage, useToast } from "../ui";
import { categoryLabel, type OkPreview } from "@/lib/communities";

/** What a non-member sees: a preview of the community with the right way in (join / accept invite / use link) */
export function CommunityLanding({ preview, inviteCode, onBack }: { preview: OkPreview; inviteCode?: string; onBack: () => void }) {
  const c = preview.community;
  const join = useMutation(api.communities.join);
  const joinWithCode = useMutation(api.communityInvites.joinWithCode);
  const respond = useMutation(api.communityInvites.respond);
  const myInvites = useQuery(api.communityInvites.myInvites, {});
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const direct = myInvites?.find((i) => i.community._id === c._id);

  const handleJoin = async () => {
    setBusy(true);
    try {
      if (c.visibility === "public") await join({ communityId: c._id });
      else if (inviteCode) await joinWithCode({ code: inviteCode });
      else if (direct) await respond({ inviteId: direct._id, accept: true });
      toast(`Welcome to ${c.name}!`);
    } catch (e) {
      toast(errorMessage(e, "Couldn't join this community."), "error");
    } finally {
      setBusy(false);
    }
  };

  const icon = (k: string) => (k === "announcements" ? Megaphone : k === "discussion" ? MessageCircle : Hash);
  const canJoin = c.visibility === "public" || !!inviteCode || !!direct;

  return (
    <div className="chat-wash h-full overflow-y-auto overscroll-contain scrollbar-thin">
      <div className="pt-safe sticky top-0 z-10 md:hidden">
        <button onClick={onBack} className="icon-btn m-2 bg-surface/80 backdrop-blur" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
      </div>
      <div className="mx-auto w-full max-w-2xl px-4 pb-12 sm:px-6">
        <div className="mt-2 overflow-hidden rounded-3xl border border-line bg-elevated shadow-soft md:mt-12">
          <div className="bg-brand relative h-28"><div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(255,255,255,0.35),transparent_60%)]" /></div>
          <div className="px-6 pb-6">
            <CommunityIcon name={c.name} url={c.iconUrl} size="xl" className="-mt-12 border-4 border-elevated" />
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-fg">{c.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span>@{c.slug}</span><span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c.memberCount} {c.memberCount === 1 ? "member" : "members"}</span><span aria-hidden>·</span>
              <span>{categoryLabel(c.category)}</span><span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">{c.visibility === "private" ? <><Lock className="h-3.5 w-3.5" />Private</> : <><Globe className="h-3.5 w-3.5" />Public</>}</span>
            </p>
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-fg">{c.description}</p>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Channels</p>
              <ul className="flex flex-wrap gap-2">
                {preview.channels.map((ch) => {
                  const I = icon(ch.kind);
                  return <li key={ch._id} className="flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1.5 text-sm text-fg"><I className="h-3.5 w-3.5 text-muted" />{ch.name}</li>;
                })}
              </ul>
              <p className="mt-2 text-xs text-muted">Join to read and post in these channels.</p>
            </div>

            <button onClick={handleJoin} disabled={busy || !canJoin} className="btn-primary mt-6 w-full py-3.5 text-base">
              {busy && <Spinner />}
              {direct && c.visibility === "private" && !inviteCode ? "Accept invitation" : `Join ${c.name}`}
            </button>
            {preview.invited && c.visibility === "private" && <p className="mt-2 text-center text-xs text-muted">You&apos;ve been invited to this private community.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
