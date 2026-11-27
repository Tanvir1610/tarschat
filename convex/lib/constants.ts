import { v } from "convex/values";

// Shared by the Convex backend AND the Next.js UI (single source of truth)

export const CATEGORIES = [
  { id: "gaming", label: "Gaming" },
  { id: "technology", label: "Technology" },
  { id: "design", label: "Design" },
  { id: "music", label: "Music" },
  { id: "art", label: "Art" },
  { id: "sports", label: "Sports" },
  { id: "education", label: "Education" },
  { id: "science", label: "Science" },
  { id: "business", label: "Business" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "entertainment", label: "Entertainment" },
  { id: "other", label: "Other" },
] as const;

export type Category = (typeof CATEGORIES)[number]["id"];

export const categoryValidator = v.union(
  v.literal("gaming"),
  v.literal("technology"),
  v.literal("design"),
  v.literal("music"),
  v.literal("art"),
  v.literal("sports"),
  v.literal("education"),
  v.literal("science"),
  v.literal("business"),
  v.literal("lifestyle"),
  v.literal("entertainment"),
  v.literal("other")
);

export const visibilityValidator = v.union(v.literal("public"), v.literal("private"));
export const roleValidator = v.union(v.literal("owner"), v.literal("moderator"), v.literal("member"));
export const reportReasonValidator = v.union(
  v.literal("spam"),
  v.literal("harassment"),
  v.literal("hate"),
  v.literal("inappropriate"),
  v.literal("other")
);

export const REPORT_REASONS = [
  { id: "spam", label: "Spam" },
  { id: "harassment", label: "Harassment" },
  { id: "hate", label: "Hate or abuse" },
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "other", label: "Something else" },
] as const;

export const LIMITS = {
  nameMin: 3,
  nameMax: 50,
  slugMin: 3,
  slugMax: 32,
  descMin: 10,
  descMax: 500,
  channelNameMax: 30,
  channelDescMax: 120,
  messageMax: 2000,
  reportDetailsMax: 500,
  maxOwnedCommunities: 5,
  maxJoinedCommunities: 100,
  maxChannels: 10,
  maxModerators: 20,
  iconMaxBytes: 2 * 1024 * 1024,
  // flood control: no more than `rateLimitCount` messages per `rateLimitWindowMs`
  rateLimitCount: 5,
  rateLimitWindowMs: 10_000,
  pageSizeMax: 50,
} as const;

// Slugs that would collide with app routes or look official
export const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "about", "help", "support", "settings", "explore", "discover",
  "create", "new", "login", "logout", "sign-in", "sign-up", "tars", "tarschat", "official",
  "moderator", "system", "null", "undefined", "communities", "community", "invite",
]);

export const ALLOWED_ICON_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
