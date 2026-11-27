"use client";

import { useEffect, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Check, Copy, Hash, Link2, Megaphone, MessageCircle, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { Avatar } from "../Avatar";
import { Skeleton, Spinner, errorMessage, useToast } from "../ui";
import { LIMITS, REPORT_REASONS, inviteUrl, type Role } from "@/lib/communities";
import { cn } from "@/lib/utils";

const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{children}</h3>;

/* ───────── Channels (owner) ───────── */
export function ChannelsTab({ communityId }: { communityId: Id<"communities"> }) {
  const channels = useQuery(api.communityChannels.list, { communityId });
  const create = useMutation(api.communityChannels.create);
  const update = useMutation(api.communityChannels.update);
  const remove = useMutation(api.communityChannels.remove);
  const [name, setName] = useState("");
  const [restricted, setRestricted] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const add = async () => {
    setBusy(true);
    try { await create({ communityId, name, postingRestricted: restricted }); setName(""); setRestricted(false); toast("Channel created"); }
    catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast(ok); } catch (e) { toast(errorMessage(e), "error"); } };

  return (
    <div className="space-y-5 p-5">
      <div>
        <H>Channels ({channels?.length ?? "…"}/{LIMITS.maxChannels})</H>
        {channels === undefined ? <Skeleton className="h-24 w-full rounded-2xl" /> : (
          <ul className="space-y-1.5">
            {channels.map((c) => (
              <li key={c._id} className="flex items-center gap-3 rounded-xl border border-line bg-subtle px-3 py-2.5">
                {c.kind === "announcements" ? <Megaphone className="h-4 w-4 text-muted" /> : c.kind === "discussion" ? <MessageCircle className="h-4 w-4 text-muted" /> : <Hash className="h-4 w-4 text-muted" />}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{c.name}</span>
                {c.kind === "custom" ? (
                  <>
                    <button onClick={() => act(() => update({ channelId: c._id, postingRestricted: !c.postingRestricted }))} className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", c.postingRestricted ? "bg-warn/15 text-warn" : "bg-subtle text-muted ring-1 ring-line")} aria-pressed={c.postingRestricted} title="Toggle who can post">
                      {c.postingRestricted ? "Mods only" : "Everyone"}
                    </button>
                    <button onClick={() => act(() => remove({ channelId: c._id }), "Channel deleted")} className="icon-btn h-8 w-8 text-danger hover:text-danger" aria-label={`Delete #${c.name}`}><Trash2 className="h-4 w-4" /></button>
                  </>
                ) : <span className="rounded-full bg-subtle px-2.5 py-1 text-[11px] font-semibold text-muted ring-1 ring-line">Built-in</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <H>New channel</H>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.channelNameMax} placeholder="e.g. showcase" aria-label="New channel name" className="field" onKeyDown={(e) => e.key === "Enter" && name.trim().length >= 2 && add()} />
          <button onClick={add} disabled={busy || name.trim().length < 2} className="btn-primary shrink-0 px-4">{busy ? <Spinner /> : <Plus className="h-4 w-4" />} Add</button>
        </div>
        <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-sm text-muted"><input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" /> Only moderators can post</label>
      </div>
    </div>
  );
}

/* ───────── Invites (owner + moderators) ───────── */
export function InvitesTab({ communityId, isPrivate }: { communityId: Id<"communities">; isPrivate: boolean }) {
  const invites = useQuery(api.communityInvites.listForCommunity, { communityId });
  const createLink = useMutation(api.communityInvites.createLink);
  const revoke = useMutation(api.communityInvites.revoke);
  const inviteUser = useMutation(api.communityInvites.inviteUser);
  const [hours, setHours] = useState(24 * 7);
  const [maxUses, setMaxUses] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const toast = useToast();
  useEffect(() => { const t = setTimeout(() => setTerm(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const found = useQuery(api.communityInvites.searchUsers, term.length >= 2 ? { communityId, query: term } : "skip");

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(inviteUrl(code)); setCopied(code); setTimeout(() => setCopied(null), 1800); } catch { toast("Couldn't copy — select the link and copy manually.", "error"); }
  };
  const make = async () => {
    setBusy(true);
    try { const { code } = await createLink({ communityId, expiresInHours: hours, maxUses: maxUses === "" ? undefined : maxUses }); await copy(code); toast("Invite link created and copied"); }
    catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 p-5">
      {!isPrivate && <p className="rounded-xl bg-accent/10 px-3 py-2 text-xs text-accent">This community is public — anyone can join from Discover. Invites are still handy for sharing.</p>}
      <div>
        <H>Invite link</H>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">Expires after
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="field mt-1">
              <option value={1}>1 hour</option><option value={24}>1 day</option><option value={168}>7 days</option><option value={720}>30 days</option>
            </select>
          </label>
          <label className="text-xs text-muted">Max uses
            <select value={maxUses} onChange={(e) => setMaxUses(e.target.value === "" ? "" : Number(e.target.value))} className="field mt-1">
              <option value="">Unlimited</option><option value={1}>1 use</option><option value={5}>5 uses</option><option value={25}>25 uses</option><option value={100}>100 uses</option>
            </select>
          </label>
        </div>
        <button onClick={make} disabled={busy} className="btn-primary mt-3 w-full">{busy ? <Spinner /> : <Link2 className="h-4 w-4" />} Create invite link</button>
      </div>

      <div>
        <H>Active invites</H>
        {invites === undefined ? <Skeleton className="h-16 w-full rounded-2xl" /> : invites.length === 0 ? <p className="text-sm text-muted">No active invites.</p> : (
          <ul className="space-y-1.5">
            {invites.map((i) => (
              <li key={i._id} className="flex items-center gap-2 rounded-xl border border-line bg-subtle px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-fg">{i.invitee ? `Direct → ${i.invitee.name}` : i.code}</p>
                  <p className="text-[11px] text-muted">Expires {new Date(i.expiresAt).toLocaleDateString()} · {i.uses}{i.maxUses ? `/${i.maxUses}` : ""} uses</p>
                </div>
                {!i.invitee && <button onClick={() => copy(i.code)} className="icon-btn h-8 w-8" aria-label="Copy invite link">{copied === i.code ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}</button>}
                <button onClick={() => revoke({ inviteId: i._id }).catch((e) => toast(errorMessage(e), "error"))} className="icon-btn h-8 w-8 text-danger hover:text-danger" aria-label="Revoke invite"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <H>Invite someone directly</H>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people by name" aria-label="Search people to invite" className="field pl-10" />
        </div>
        {term.length >= 2 && (
          <ul className="mt-2 space-y-1">
            {found === undefined ? <Skeleton className="h-10 w-full" /> : found.length === 0 ? <li className="px-1 py-2 text-sm text-muted">No one to invite with that name.</li> : found.map((u) => (
              <li key={u._id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-subtle">
                <Avatar user={u as never} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-fg">{u.name}</span>
                <button onClick={() => inviteUser({ communityId, userId: u._id }).then(() => toast(`Invitation sent to ${u.name}`)).catch((e) => toast(errorMessage(e), "error"))} className="btn-ghost h-8 border border-line px-3 text-xs"><UserPlus className="h-3.5 w-3.5" /> Invite</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ───────── Moderation (reports: owner + moderators; bans: owner) ───────── */
export function ModerationTab({ communityId, myRole }: { communityId: Id<"communities">; myRole: Role }) {
  const [status, setStatus] = useState<"open" | "resolved" | "dismissed">("open");
  const reports = usePaginatedQuery(api.moderation.listReports, { communityId, status }, { initialNumItems: 10 });
  const resolve = useMutation(api.moderation.resolveReport);
  const toast = useToast();
  const label = (id: string) => REPORT_REASONS.find((r) => r.id === id)?.label ?? id;

  const act = async (reportId: Id<"communityReports">, resolution: "resolved" | "dismissed", removeMessage = false) => {
    try { await resolve({ reportId, resolution, removeMessage }); toast(resolution === "dismissed" ? "Report dismissed" : removeMessage ? "Message removed" : "Report resolved"); }
    catch (e) { toast(errorMessage(e), "error"); }
  };

  return (
    <div className="space-y-6 p-5">
      <div>
        <div className="mb-3 flex gap-1.5" role="tablist" aria-label="Report status">
          {(["open", "resolved", "dismissed"] as const).map((s) => (
            <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold capitalize", status === s ? "bg-brand text-white" : "bg-subtle text-muted hover:text-fg")}>{s}</button>
          ))}
        </div>
        {reports.status === "LoadingFirstPage" ? <Skeleton className="h-24 w-full rounded-2xl" /> : reports.results.length === 0 ? (
          <p className="rounded-xl bg-subtle px-4 py-6 text-center text-sm text-muted">{status === "open" ? "No open reports. 🎉" : `No ${status} reports.`}</p>
        ) : (
          <ul className="space-y-2.5">
            {reports.results.map((r) => (
              <li key={r._id} className="rounded-2xl border border-line bg-subtle p-3.5">
                <p className="text-sm text-fg"><span className="font-semibold">{r.reporter?.name ?? "Someone"}</span> reported <span className="font-semibold">{r.reportedUser?.name ?? "a member"}</span> · <span className="text-warn">{label(r.reason)}</span></p>
                {r.message && <p className="mt-2 line-clamp-3 rounded-lg border-l-[3px] border-accent bg-surface px-3 py-2 text-sm text-muted">{r.message.isDeleted ? <em>Message already removed</em> : r.message.content}</p>}
                {r.details && <p className="mt-2 text-xs text-muted">“{r.details}”</p>}
                {status === "open" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.message && !r.message.isDeleted && <button onClick={() => act(r._id, "resolved", true)} className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white active:scale-95">Remove message</button>}
                    <button onClick={() => act(r._id, "resolved")} className="rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-white active:scale-95 dark:text-bg">Mark resolved</button>
                    <button onClick={() => act(r._id, "dismissed")} className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-muted ring-1 ring-line active:scale-95">Dismiss</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {reports.status === "CanLoadMore" && <button onClick={() => reports.loadMore(10)} className="btn-ghost mx-auto mt-3 border border-line px-4 text-xs">Load more</button>}
      </div>
      {myRole === "owner" && <BansList communityId={communityId} />}
    </div>
  );
}

function BansList({ communityId }: { communityId: Id<"communities"> }) {
  const bans = useQuery(api.communityMembers.listBans, { communityId });
  const unban = useMutation(api.communityMembers.unban);
  const toast = useToast();
  return (
    <div>
      <H>Banned people</H>
      {bans === undefined ? <Skeleton className="h-12 w-full rounded-xl" /> : bans.length === 0 ? <p className="text-sm text-muted">Nobody is banned.</p> : (
        <ul className="space-y-1.5">
          {bans.map((b) => (
            <li key={b.userId} className="flex items-center gap-3 rounded-xl border border-line bg-subtle px-3 py-2">
              <Avatar user={b.user as never} size="sm" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-fg">{b.user?.name ?? "Unknown"}</p>{b.reason && <p className="truncate text-xs text-muted">{b.reason}</p>}</div>
              <button onClick={() => unban({ communityId, userId: b.userId }).then(() => toast("Unbanned")).catch((e) => toast(errorMessage(e), "error"))} className="btn-ghost h-8 border border-line px-3 text-xs">Unban</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
