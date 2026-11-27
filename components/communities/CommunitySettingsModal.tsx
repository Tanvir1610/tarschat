"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Globe, ImagePlus, Info, LogOut, Lock, Settings, ShieldAlert, UserX } from "lucide-react";
import { Modal, Spinner, errorMessage, useToast } from "../ui";
import { CommunityIcon } from "./CommunityIcon";
import { ChannelsTab, InvitesTab, ModerationTab } from "./CommunityAdminTabs";
import { CATEGORIES, LIMITS, categoryLabel, isStaff, type CommunitySummary, type Role } from "@/lib/communities";
import { Avatar } from "../Avatar";
import { cn, formatBytes } from "@/lib/utils";

type TabId = "about" | "general" | "channels" | "invites" | "moderation" | "danger";
type Category = (typeof CATEGORIES)[number]["id"];

export function CommunitySettingsModal({ community, myRole, reportCount, onClose, onLeft }: {
  community: CommunitySummary;
  myRole: Role;
  reportCount: number;
  onClose: () => void;
  onLeft: () => void;
}) {
  const staff = isStaff(myRole);
  const owner = myRole === "owner";
  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: "about", label: "About" },
    ...(owner ? [{ id: "general" as const, label: "General" }, { id: "channels" as const, label: "Channels" }] : []),
    ...(staff ? [{ id: "invites" as const, label: "Invites" }, { id: "moderation" as const, label: "Moderation", badge: reportCount }] : []),
    ...(owner ? [{ id: "danger" as const, label: "Danger zone" }] : []),
  ];
  const [tab, setTab] = useState<TabId>("about");

  return (
    <Modal title="Community settings" icon={<Settings className="h-5 w-5" />} onClose={onClose} className="sm:max-w-xl">
      <div className="sticky top-0 z-10 -mb-px flex gap-1 overflow-x-auto border-b border-line bg-elevated px-3 pt-2 scrollbar-hide" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("relative shrink-0 rounded-t-lg px-3.5 py-2.5 text-sm font-semibold transition-colors", tab === t.id ? "border-b-2 border-accent text-accent" : "text-muted hover:text-fg")}>
            {t.label}
            {!!t.badge && <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{t.badge}</span>}
          </button>
        ))}
      </div>
      {tab === "about" && <AboutTab community={community} myRole={myRole} onLeft={onLeft} />}
      {tab === "general" && <GeneralTab community={community} />}
      {tab === "channels" && <ChannelsTab communityId={community._id} />}
      {tab === "invites" && <InvitesTab communityId={community._id} isPrivate={community.visibility === "private"} />}
      {tab === "moderation" && <ModerationTab communityId={community._id} myRole={myRole} />}
      {tab === "danger" && <DangerTab community={community} onDeleted={onLeft} />}
    </Modal>
  );
}

function AboutTab({ community: c, myRole, onLeft }: { community: CommunitySummary; myRole: Role; onLeft: () => void }) {
  const leave = useMutation(api.communities.leave);
  const blocked = useQuery(api.moderation.listBlocked, {});
  const unblock = useMutation(api.moderation.unblockUser);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const doLeave = async () => {
    setBusy(true);
    try { await leave({ communityId: c._id }); toast(`You left ${c.name}`); onLeft(); }
    catch (e) { toast(errorMessage(e), "error"); setBusy(false); }
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center gap-4">
        <CommunityIcon name={c.name} url={c.iconUrl} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-fg">{c.name}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span>@{c.slug}</span><span aria-hidden>·</span><span>{categoryLabel(c.category)}</span><span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">{c.visibility === "private" ? <><Lock className="h-3 w-3" /> Private</> : <><Globe className="h-3 w-3" /> Public</>}</span>
          </p>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{c.description}</p>
      <p className="text-xs text-muted">{c.memberCount} {c.memberCount === 1 ? "member" : "members"} · your role: <span className="font-semibold capitalize text-fg">{myRole}</span></p>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Blocked people</h3>
        {blocked === undefined ? null : blocked.length === 0 ? <p className="text-sm text-muted">You haven&apos;t blocked anyone. Blocked people&apos;s messages are hidden from you in communities.</p> : (
          <ul className="space-y-1.5">
            {blocked.map((u) => (
              <li key={u._id} className="flex items-center gap-3 rounded-xl border border-line bg-subtle px-3 py-2">
                <Avatar user={u as never} size="sm" /><span className="min-w-0 flex-1 truncate text-sm text-fg">{u.name}</span>
                <button onClick={() => unblock({ userId: u._id }).then(() => toast(`Unblocked ${u.name}`))} className="btn-ghost h-8 border border-line px-3 text-xs"><UserX className="h-3.5 w-3.5" /> Unblock</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {myRole !== "owner" && (
        confirm ? (
          <div className="rounded-2xl bg-danger/10 p-4">
            <p className="mb-3 text-sm font-medium text-danger">Leave {c.name}?{c.visibility === "private" ? " You'll need a new invitation to come back." : ""}</p>
            <div className="flex gap-2">
              <button onClick={doLeave} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-danger py-2.5 text-sm font-semibold text-white active:scale-95">{busy && <Spinner />} Leave</button>
              <button onClick={() => setConfirm(false)} className="flex-1 rounded-xl bg-subtle py-2.5 text-sm font-medium text-fg active:scale-95">Stay</button>
            </div>
          </div>
        ) : <button onClick={() => setConfirm(true)} className="btn-ghost w-full border border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"><LogOut className="h-4 w-4" /> Leave community</button>
      )}
    </div>
  );
}

function GeneralTab({ community: c }: { community: CommunitySummary }) {
  const update = useMutation(api.communities.update);
  const generateUrl = useMutation(api.communities.generateIconUploadUrl);
  const [name, setName] = useState(c.name);
  const [description, setDescription] = useState(c.description);
  const [category, setCategory] = useState<Category>(c.category as Category);
  const [visibility, setVisibility] = useState(c.visibility);
  const [icon, setIcon] = useState<File | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const preview = icon ? URL.createObjectURL(icon) : removeIcon ? null : c.iconUrl;
  const dirty = name.trim() !== c.name || description.trim() !== c.description || category !== c.category || visibility !== c.visibility || !!icon || removeIcon;
  const valid = name.trim().length >= LIMITS.nameMin && description.trim().length >= LIMITS.descMin;

  const pick = (f?: File) => {
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(f.type)) return setError("Icon must be a PNG, JPG, WEBP or GIF image.");
    if (f.size > LIMITS.iconMaxBytes) return setError(`Icon is ${formatBytes(f.size)} — the limit is 2 MB.`);
    setError(null); setIcon(f); setRemoveIcon(false);
  };

  const save = async () => {
    setBusy(true); setError(null);
    try {
      let iconStorageId: Id<"_storage"> | undefined;
      if (icon) {
        const url = await generateUrl();
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": icon.type }, body: icon });
        if (!res.ok) throw new Error("Image upload failed");
        iconStorageId = ((await res.json()) as { storageId: Id<"_storage"> }).storageId;
      }
      await update({ communityId: c._id, name, description, category, visibility, ...(iconStorageId ? { iconStorageId } : {}), ...(removeIcon ? { removeIcon: true } : {}) });
      setIcon(null); setRemoveIcon(false);
      toast("Community updated");
    } catch (e) { setError(errorMessage(e, "Couldn't save changes.")); } finally { setBusy(false); }
  };

  const L = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted";
  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center gap-4">
        <button onClick={() => fileRef.current?.click()} className="group relative" aria-label="Change community icon">
          <CommunityIcon name={name || "C"} url={preview} size="xl" />
          <span className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"><ImagePlus className="h-6 w-6" /></span>
        </button>
        <div className="text-xs text-muted"><p className="text-sm font-medium text-fg">Icon</p><p>PNG, JPG, WEBP or GIF · up to 2 MB</p>
          {(preview) && <button onClick={() => { setIcon(null); setRemoveIcon(true); }} className="mt-1 font-medium text-danger hover:underline">Remove icon</button>}</div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <div><label className={L} htmlFor="s-name">Name</label><input id="s-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.nameMax} className="field" /></div>
      <div><label className={L}>Username</label><div className="field flex items-center gap-2 text-muted">@{c.slug}<span className="ml-auto text-xs">can&apos;t be changed</span></div></div>
      <div><div className="mb-1.5 flex justify-between"><label className="text-xs font-semibold uppercase tracking-wider text-muted" htmlFor="s-desc">Description</label><span className="text-xs tabular-nums text-muted">{description.length}/{LIMITS.descMax}</span></div>
        <textarea id="s-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value.slice(0, LIMITS.descMax))} className="field resize-none" /></div>
      <div><label className={L} htmlFor="s-cat">Category</label><select id="s-cat" value={category} onChange={(e) => setCategory(e.target.value as Category)} className="field">{CATEGORIES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
      <fieldset><legend className={L}>Visibility</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {(["public", "private"] as const).map((v) => (
            <button key={v} role="radio" aria-checked={visibility === v} onClick={() => setVisibility(v)} className={cn("flex items-center gap-2.5 rounded-xl border p-3 text-sm font-semibold capitalize transition", visibility === v ? "border-accent bg-accent/10 text-fg" : "border-line text-muted hover:text-fg")}>
              {v === "public" ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}{v}
            </button>
          ))}
        </div>
        {visibility !== c.visibility && <p className="mt-2 flex items-start gap-1.5 text-xs text-warn"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{visibility === "private" ? "Private communities disappear from Discover. Existing members stay." : "Public communities appear in Discover and anyone can join."}</p>}
      </fieldset>
      {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
      <button onClick={save} disabled={!dirty || !valid || busy} className="btn-primary w-full py-3">{busy && <Spinner />} Save changes</button>
    </div>
  );
}

function DangerTab({ community: c, onDeleted }: { community: CommunitySummary; onDeleted: () => void }) {
  const staff = useQuery(api.communityMembers.listStaff, { communityId: c._id });
  const transfer = useMutation(api.communities.transferOwnership);
  const del = useMutation(api.communities.deleteCommunity);
  const [target, setTarget] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<"t" | "d" | null>(null);
  const toast = useToast();
  const mods = (staff ?? []).filter((s) => s.role === "moderator");

  return (
    <div className="space-y-6 p-5">
      <div className="rounded-2xl border border-line p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg"><ShieldAlert className="h-4 w-4 text-warn" /> Transfer ownership</h3>
        <p className="mt-1 text-xs text-muted">Hand the community to one of your moderators. You&apos;ll become a moderator. (Promote a member to moderator first if needed.)</p>
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="New owner" className="field mt-3" disabled={mods.length === 0}>
          <option value="">{mods.length === 0 ? "No moderators yet" : "Choose a moderator…"}</option>
          {mods.map((m) => <option key={m.userId} value={m.userId}>{m.user?.name}</option>)}
        </select>
        <button disabled={!target || busy !== null} onClick={async () => { setBusy("t"); try { await transfer({ communityId: c._id, newOwnerId: target as Id<"users"> }); toast("Ownership transferred"); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(null); } }} className="btn-ghost mt-3 w-full border border-line">{busy === "t" && <Spinner />} Transfer ownership</button>
      </div>
      <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4">
        <h3 className="text-sm font-semibold text-danger">Delete community</h3>
        <p className="mt-1 text-xs text-muted">This permanently deletes all channels, messages and memberships. This can&apos;t be undone. Type <span className="font-mono font-semibold text-fg">{c.slug}</span> to confirm.</p>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type the community username to confirm" placeholder={c.slug} className="field mt-3 font-mono" autoComplete="off" />
        <button disabled={typed !== c.slug || busy !== null} onClick={async () => { setBusy("d"); try { await del({ communityId: c._id }); toast("Community deleted"); onDeleted(); } catch (e) { toast(errorMessage(e), "error"); setBusy(null); } }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-danger py-2.5 text-sm font-semibold text-white transition active:scale-[0.97] disabled:opacity-40">{busy === "d" && <Spinner />} Delete this community</button>
      </div>
    </div>
  );
}
