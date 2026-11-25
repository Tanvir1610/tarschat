import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

/** A message as returned by `messages.getMessages` (sender, reply preview, file URL included) */
export type ChatMessage = FunctionReturnType<typeof api.messages.getMessages>[number];

/** A conversation row as returned by `conversations.getUserConversations` */
export type ConversationListItem = FunctionReturnType<
  typeof api.conversations.getUserConversations
>[number];
