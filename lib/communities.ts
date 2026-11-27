import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import { CATEGORIES } from "@/convex/lib/constants";

export { CATEGORIES, LIMITS, REPORT_REASONS } from "@/convex/lib/constants";

export type CommunitySummary = FunctionReturnType<typeof api.communities.featured>[number];
export type CommunityPreview = FunctionReturnType<typeof api.communities.getPreview>;
export type OkPreview = Extract<CommunityPreview, { status: "ok" }>;
export type ChannelInfo = OkPreview["channels"][number];
export type CommunityMessage = FunctionReturnType<typeof api.communityMessages.list>["page"][number];
export type Role = "owner" | "moderator" | "member";

export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? "Other";

/** "My Cool Club!" → "my-cool-club" */
export function slugifyName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export const inviteUrl = (code: string) => `${window.location.origin}/?invite=${code}`;

/** Accepts a full invite URL or a bare code */
export function extractInviteCode(input: string) {
  const trimmed = input.trim();
  try {
    const code = new URL(trimmed).searchParams.get("invite");
    if (code) return code.toUpperCase();
  } catch {
    /* not a URL */
  }
  return trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const isStaff = (role: Role | null | undefined) => role === "owner" || role === "moderator";

export const compactNumber = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n);
