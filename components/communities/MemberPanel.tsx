"use client";

import { useRef, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Ban, Crown, Flag, MoreHorizontal, Shield, ShieldOff, UserMinus, UserX, Users } from "lucide-react";
import { Avatar } from "../Avatar";
import { Skeleton, Spinner, errorMessage, useDismiss, useToast } from "../ui";
import { ReportModal } from "./ReportModal";
import { type Role } from "@/lib/communities";
import { cn } from "@/lib/utils";

interface Props {
  communityId: Id<"communities">;
  myRole: Role;
  me: Doc<"users">;
}

type Member = { userId: Id<"users">; role: Role; user: { _id: Id<"users">; name: string; imageUrl?: string; isOnline: boolean } | null };

export function MemberPanel({ communityId, myRole, me }: Props) {
  const staff = useQuery(api.communityMembers.listStaff, { communityId });
  const members = usePaginatedQuery(api.communityMembers.listMembers, { communityId }, { initialNumItems: 20 });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-4 scrollbar-thin">
        <SectionLabel>Staff — {staff?.length ?? "…"}</SectionLabel>
        {staff === undefined ? <ListSkeleton /> : (
          <ul>{staff.map((m) => <MemberRow key={m.userId} member={m as Member} me={me} myRole={myRole} communityId={communityId} />)}</ul>
        )}

        <SectionLabel>Members</SectionLabel>
        {members.status === "LoadingFirstPage" ? <ListSkeleton /> : members.results.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted">No other members yet — share the community to grow it.</p>
        ) : (
          <>
            <ul>{members.results.map((m) => <MemberRow key={m.userId} member={m as Member} me={me} myRole={myRole} communityId={communityId} />)}</ul>
            {members.status !== "Exhausted" && (
              <div className="flex justify-center pt-3">
                <button onClick={() => members.loadMore(20)} disabled={members.status === "LoadingMore"} className="btn-ghost border border-line px-4 py-1.5 text-xs">
                  {members.status === "LoadingMore" && <Spinner className="h-3.5 w-3.5" />} Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="px-3 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">{children}</p>
);
const ListSkeleton = () => (
  <div className="space-y-3 px-3 py-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-3.5 w-28" /></div>)}</div>
);

function MemberRow({ member, me, myRole, communityId }: { member: Member; me: Doc<"users">; myRole: Role; communityId: Id<"communities"> }) {
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirm, setConfirm] = useState<"remove" | "ban" | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, () => { setMenu(false); setConfirm(null); }, menu);
  const toast = useToast();

  const setRole = useMutation(api.communityMembers.setRole);
  const removeMember = useMutation(api.communityMembers.remove);
  const ban = useMutation(api.communityMembers.ban);
  const block = useMutation(api.moderation.blockUser);
  const report = useMutation(api.moderation.reportMember);

  const isSelf = member.userId === me._id;
  const name = member.user?.name ?? "Unknown";
  const isOwnerView = myRole === "owner";

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMenu(false);
    setConfirm(null);
    try { await fn(); toast(ok); } catch (e) { toast(errorMessage(e), "error"); }
  };

  return (
    <li className="group relative flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-subtle">
      <Avatar user={member.user as unknown as Doc<"users">} size="sm" showOnlineStatus />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-fg">
          <span className="truncate">{name}</span>
          {isSelf && <span className="text-xs font-normal text-muted">(you)</span>}
        </p>
        {member.role !== "member" && (
          <p className={cn("flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide", member.role === "owner" ? "text-warn" : "text-accent")}>
            {member.role === "owner" ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
            {member.role === "owner" ? "Owner" : "Moderator"}
          </p>
        )}
      </div>

      {!isSelf && member.role !== "owner" && (
        <div ref={ref} className="relative">
          <button onClick={() => setMenu((v) => !v)} aria-label={`Actions for ${name}`} aria-haspopup="menu" aria-expanded={menu} className="icon-btn h-8 w-8 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-70">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-52 animate-pop-in rounded-2xl border border-line bg-elevated p-1.5 shadow-pop">
              {isOwnerView && (
                <button role="menuitem" onClick={() => run(() => setRole({ communityId, userId: member.userId, role: member.role === "moderator" ? "member" : "moderator" }), member.role === "moderator" ? `${name} is no longer a moderator` : `${name} is now a moderator`)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg hover:bg-subtle">
                  {member.role === "moderator" ? <ShieldOff className="h-4 w-4 text-muted" /> : <Shield className="h-4 w-4 text-muted" />}
                  {member.role === "moderator" ? "Remove moderator" : "Make moderator"}
                </button>
              )}
              <button role="menuitem" onClick={() => { setMenu(false); setReporting(true); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg hover:bg-subtle"><Flag className="h-4 w-4 text-muted" /> Report</button>
              <button role="menuitem" onClick={() => run(() => block({ userId: member.userId }), `Blocked ${name}`)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg hover:bg-subtle"><UserX className="h-4 w-4 text-muted" /> Block</button>
              {isOwnerView && (
                confirm ? (
                  <div className="mt-1 rounded-xl bg-danger/10 p-2.5">
                    <p className="mb-2 text-xs font-medium text-danger">{confirm === "ban" ? `Ban ${name}? They can't rejoin.` : `Remove ${name} from the community?`}</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => run(() => (confirm === "ban" ? ban({ communityId, userId: member.userId }) : removeMember({ communityId, userId: member.userId })), confirm === "ban" ? `${name} was banned` : `${name} was removed`)} className="flex-1 rounded-lg bg-danger py-1.5 text-xs font-semibold text-white active:scale-95">Confirm</button>
                      <button onClick={() => setConfirm(null)} className="flex-1 rounded-lg bg-subtle py-1.5 text-xs font-medium text-fg active:scale-95">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button role="menuitem" onClick={() => setConfirm("remove")} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-danger hover:bg-danger/10"><UserMinus className="h-4 w-4" /> Remove from community</button>
                    <button role="menuitem" onClick={() => setConfirm("ban")} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-danger hover:bg-danger/10"><Ban className="h-4 w-4" /> Ban</button>
                  </>
                )
              )}
            </div>
          )}
        </div>
      )}

      {reporting && (
        <ReportModal title={`Report ${name}`} onClose={() => setReporting(false)} onSubmit={(reason, details) => report({ communityId, userId: member.userId, reason, details: details || undefined })} />
      )}
    </li>
  );
}

export function MemberCountIcon() {
  return <Users className="h-4 w-4" />;
}
