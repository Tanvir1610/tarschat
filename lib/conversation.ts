import type { Doc } from "@/convex/_generated/dataModel";

type WithMembers = Pick<Doc<"conversations">, "type" | "name"> & {
  members: (Doc<"users"> | null)[];
};

/** The other participant of a direct conversation */
export function getOtherMember(convo: WithMembers, meId: string) {
  return convo.type === "direct"
    ? convo.members.find((m) => m && m._id !== meId) ?? null
    : null;
}

/** Display title: group name, or the other person's name */
export function getConversationTitle(convo: WithMembers, meId: string) {
  if (convo.type === "group") return convo.name ?? "Group";
  return getOtherMember(convo, meId)?.name ?? "Unknown";
}
