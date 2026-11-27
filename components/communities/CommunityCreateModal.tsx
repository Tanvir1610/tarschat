"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Globe, ImagePlus, Lock, Plus, X } from "lucide-react";
import { Modal, Spinner, errorMessage, useToast } from "../ui";
import { CommunityIcon } from "./CommunityIcon";
import { CATEGORIES, LIMITS, slugifyName } from "@/lib/communities";
import { cn, formatBytes } from "@/lib/utils";

const ICON_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

type Category = (typeof CATEGORIES)[number]["id"];

export function CommunityCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (slug: string) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("technology");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [icon, setIcon] = useState<{ file: File; preview: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const generateUrl = useMutation(api.communities.generateIconUploadUrl);
  const create = useMutation(api.communities.create);

  // Debounced live availability check against the server (the server re-checks on submit)
  const [debouncedSlug, setDebouncedSlug] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSlug(slug), 350);
    return () => clearTimeout(t);
  }, [slug]);
  const availability = useQuery(api.communities.isSlugAvailable, debouncedSlug ? { slug: debouncedSlug } : "skip");
  const slugChecking = !!slug && (debouncedSlug !== slug || availability === undefined);

  useEffect(() => () => { if (icon) URL.revokeObjectURL(icon.preview); }, [icon]);

  const onName = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugifyName(v));
  };

  const pickIcon = (file?: File) => {
    if (!file) return;
    if (!ICON_TYPES.includes(file.type)) return setError("Icon must be a PNG, JPG, WEBP or GIF image.");
    if (file.size > LIMITS.iconMaxBytes) return setError(`Icon is ${formatBytes(file.size)} — the limit is 2 MB.`);
    setError(null);
    setIcon({ file, preview: URL.createObjectURL(file) });
  };

  const nameOk = name.trim().length >= LIMITS.nameMin && name.trim().length <= LIMITS.nameMax;
  const descOk = description.trim().length >= LIMITS.descMin && description.trim().length <= LIMITS.descMax;
  const slugOk = availability?.available === true && debouncedSlug === slug;
  const canSubmit = nameOk && descOk && slugOk && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      let iconStorageId: Id<"_storage"> | undefined;
      if (icon) {
        const url = await generateUrl();
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": icon.file.type }, body: icon.file });
        if (!res.ok) throw new Error("Image upload failed");
        iconStorageId = ((await res.json()) as { storageId: Id<"_storage"> }).storageId;
      }
      const { slug: created } = await create({ name, slug, description, category, visibility, iconStorageId });
      toast(`${name.trim()} is live!`);
      onCreated(created);
    } catch (e) {
      setError(errorMessage(e, "Couldn't create the community."));
    } finally {
      setSubmitting(false);
    }
  };

  const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted";

  return (
    <Modal
      title="Create a community"
      icon={<Plus className="h-5 w-5" />}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          {error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <button onClick={handleSubmit} disabled={!canSubmit} className="btn-primary w-full py-3">
            {submitting && <Spinner />}
            {submitting ? "Creating…" : "Create community"}
          </button>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        {/* Icon */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative"
            aria-label={icon ? "Change community icon" : "Upload community icon"}
          >
            {icon ? (
              <CommunityIcon name={name || "C"} url={icon.preview} size="xl" />
            ) : (
              <div className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed border-line text-muted transition group-hover:border-accent/60 group-hover:text-accent">
                <ImagePlus className="h-6 w-6" />
                <span className="text-[11px] font-medium">Add icon</span>
              </div>
            )}
          </button>
          <div className="min-w-0 text-sm text-muted">
            <p className="font-medium text-fg">Community icon</p>
            <p className="text-xs">PNG, JPG, WEBP or GIF · up to 2 MB. Optional.</p>
            {icon && (
              <button onClick={() => setIcon(null)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline">
                <X className="h-3 w-3" /> Remove
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept={ICON_TYPES.join(",")} hidden onChange={(e) => { pickIcon(e.target.files?.[0]); e.target.value = ""; }} />
        </div>

        <div>
          <label htmlFor="c-name" className={label}>Name</label>
          <input id="c-name" data-autofocus value={name} onChange={(e) => onName(e.target.value)} maxLength={LIMITS.nameMax} placeholder="e.g. Design Guild" className="field" />
        </div>

        <div>
          <label htmlFor="c-slug" className={label}>Username</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">@</span>
            <input
              id="c-slug"
              value={slug}
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-")); }}
              maxLength={LIMITS.slugMax}
              placeholder="design-guild"
              className="field pl-8"
              aria-describedby="c-slug-status"
              aria-invalid={!!slug && !slugChecking && !slugOk}
            />
          </div>
          <p id="c-slug-status" className={cn("mt-1.5 min-h-[1rem] text-xs", slugChecking ? "text-muted" : slugOk ? "text-success" : "text-danger")}>
            {!slug ? "Letters, numbers and hyphens. This can't be changed later." : slugChecking ? "Checking…" : slugOk ? "Available ✓" : availability?.reason}
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="c-desc" className="text-xs font-semibold uppercase tracking-wider text-muted">Description</label>
            <span className={cn("text-xs tabular-nums", description.length > LIMITS.descMax - 40 ? "text-warn" : "text-muted")}>{description.length}/{LIMITS.descMax}</span>
          </div>
          <textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value.slice(0, LIMITS.descMax))} rows={3} placeholder="What is this community about?" className="field resize-none" />
          {description.length > 0 && !descOk && <p className="mt-1 text-xs text-danger">Write at least {LIMITS.descMin} characters.</p>}
        </div>

        <div>
          <label htmlFor="c-cat" className={label}>Category</label>
          <select id="c-cat" value={category} onChange={(e) => setCategory(e.target.value as Category)} className="field">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className={label}>Visibility</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {([
              { id: "public", icon: Globe, title: "Public", text: "Anyone can find and join." },
              { id: "private", icon: Lock, title: "Private", text: "Hidden. Invitation only." },
            ] as const).map(({ id, icon: Icon, title, text }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={visibility === id}
                onClick={() => setVisibility(id)}
                className={cn("flex items-start gap-3 rounded-xl border p-3 text-left transition", visibility === id ? "border-accent bg-accent/10" : "border-line hover:border-accent/40")}
              >
                <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", visibility === id ? "text-accent" : "text-muted")} />
                <span>
                  <span className="block text-sm font-semibold text-fg">{title}</span>
                  <span className="block text-xs text-muted">{text}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}
