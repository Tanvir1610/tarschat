"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Check, Compass, Inbox, KeyRound, Lock, Plus, Search, Shield, Users, X, Crown } from "lucide-react";
import { CommunityIcon } from "./CommunityIcon";
import { Modal, EmptyState, Skeleton, Spinner, errorMessage, useToast } from "../ui";
import { cn } from "@/lib/utils";

interface Props {
  activeSlug: string | null;
  discoverActive: boolean;
  onOpen: (slug: string) => void;
  onDiscover: () => void;
  onJoinWithCode: () => void;
  onCreate: () => void;
  onShowInvites: () => void;
}

export function CommunitySidebar({ activeSlug, discoverActive, onOpen, onDiscover, onJoinWithCode, onCreate, onShowInvites }: Props) {
  const [search, setSearch] = useState("");
  const mine = useQuery(api.communities.listMine, {});
  const invites = useQuery(api.communityInvites.myInvites, {});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (mine ?? []).filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [mine, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="px-4 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-fg">Communities</h1>
          <div className="flex items-center gap-0.5">
            <button onClick={onShowInvites} className="icon-btn relative" aria-label={invites?.length ? `${invites.length} community invitations` : "Community invitations"}>
              <Inbox className="h-[18px] w-[18px]" />
              {!!invites?.length && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-surface">{invites.length}</span>
              )}
            </button>
            <button onClick={onJoinWithCode} className="icon-btn" aria-label="Join with invite code" title="Join with invite code"><KeyRound className="h-[18px] w-[18px]" /></button>
            <button onClick={onCreate} className="icon-btn" aria-label="Create a community" title="Create a community"><Plus className="h-5 w-5" /></button>
          </div>
        </div>

        <button
          onClick={onDiscover}
          aria-current={discoverActive ? "page" : undefined}
          className={cn(
            "mt-3 flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm font-semibold transition active:scale-[0.99]",
            discoverActive ? "bg-brand text-white shadow-glow" : "bg-subtle text-fg hover:bg-line/60"
          )}
        >
          <Compass className="h-[18px] w-[18px]" /> Discover communities
        </button>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your communities" aria-label="Search your communities" className="field rounded-2xl pl-10 [&::-webkit-search-cancel-button]:hidden" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 scrollbar-thin">
        {mine === undefined ? (
          <div className="space-y-4 p-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3"><Skeleton className="h-11 w-11 rounded-2xl" /><Skeleton className="h-4 w-36" /></div>
            ))}
          </div>
        ) : mine.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No communities yet" description="Discover public communities or create your own." action={<button onClick={onDiscover} className="btn-primary">Discover</button>} />
        ) : filtered.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted">No communities match “{search}”.</p>
        ) : (
          <>
            <p className="px-5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Your communities</p>
            <ul>
              {filtered.map((c) => (
                <li key={c._id} className="mx-2">
                  <button
                    onClick={() => onOpen(c.slug)}
                    aria-current={activeSlug === c.slug ? "true" : undefined}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors", activeSlug === c.slug ? "bg-accent/12 ring-1 ring-inset ring-accent/25" : "hover:bg-subtle")}
                  >
                    <CommunityIcon name={c.name} url={c.iconUrl} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-fg">
                        <span className="truncate">{c.name}</span>
                        {c.visibility === "private" && <Lock className="h-3 w-3 shrink-0 text-muted" aria-label="Private" />}
                      </p>
                      <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                        {c.role === "owner" && <Crown className="h-3 w-3 text-warn" aria-label="Owner" />}
                        {c.role === "moderator" && <Shield className="h-3 w-3 text-accent" aria-label="Moderator" />}
                        {c.memberCount} {c.memberCount === 1 ? "member" : "members"}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

    </div>
  );
}

export function InvitationsModal({ onClose, onAccepted }: { onClose: () => void; onAccepted: (slug: string) => void }) {
  const invites = useQuery(api.communityInvites.myInvites, {});
  const respond = useMutation(api.communityInvites.respond);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const act = async (id: (typeof invites extends (infer T)[] | undefined ? T : never)["_id"], accept: boolean) => {
    setBusy(id);
    try {
      const r = await respond({ inviteId: id, accept });
      if (accept && r) { toast("You joined the community"); onAccepted(r.slug); }
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title="Invitations" icon={<Inbox className="h-5 w-5" />} onClose={onClose}>
      {invites === undefined ? (
        <div className="space-y-3 p-5"><Skeleton className="h-16 w-full rounded-2xl" /><Skeleton className="h-16 w-full rounded-2xl" /></div>
      ) : invites.length === 0 ? (
        <EmptyState icon={<Inbox className="h-6 w-6" />} title="No invitations" description="When a community owner invites you, it shows up here." />
      ) : (
        <ul className="space-y-2.5 p-4">
          {invites.map((i) => (
            <li key={i._id} className="flex items-center gap-3 rounded-2xl border border-line bg-subtle p-3">
              <CommunityIcon name={i.community.name} url={i.community.iconUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{i.community.name}</p>
                <p className="truncate text-xs text-muted">Invited by {i.invitedBy}</p>
              </div>
              {busy === i._id ? <Spinner /> : (
                <div className="flex gap-1.5">
                  <button onClick={() => act(i._id, true)} className="flex h-9 w-9 items-center justify-center rounded-full bg-success text-white active:scale-90 dark:text-bg" aria-label={`Accept invitation to ${i.community.name}`}><Check className="h-4 w-4" /></button>
                  <button onClick={() => act(i._id, false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-danger/15 text-danger active:scale-90" aria-label={`Decline invitation to ${i.community.name}`}><X className="h-4 w-4" /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
