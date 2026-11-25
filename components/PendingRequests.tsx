"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Check, Clock, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { errorMessage, useToast } from "./ui";

type Requests = NonNullable<FunctionReturnType<typeof api.chatRequests.getPendingRequests>>;

interface PendingRequestsProps {
  requests: Requests;
  currentUser: Doc<"users">;
  onConversationCreated: (id: Id<"conversations">) => void;
}

function timeLeft(expiresAt: number) {
  const diff = Math.max(0, expiresAt - Date.now());
  const hours = Math.floor(diff / 3_600_000);
  if (hours > 0) return `${hours}h left`;
  return `${Math.floor((diff % 3_600_000) / 60_000)}m left`;
}

/** Panel listing incoming chat requests — opened from the bell in the sidebar header */
export function PendingRequests({ requests, currentUser, onConversationCreated }: PendingRequestsProps) {
  const acceptRequest = useMutation(api.chatRequests.acceptChatRequest);
  const rejectRequest = useMutation(api.chatRequests.rejectChatRequest);
  const toast = useToast();

  const handleAccept = async (requestId: Id<"chatRequests">) => {
    try {
      const convoId = await acceptRequest({ requestId, userId: currentUser._id });
      onConversationCreated(convoId);
    } catch (e) {
      toast(errorMessage(e, "Couldn't accept the request."), "error");
    }
  };

  const handleReject = async (requestId: Id<"chatRequests">) => {
    try {
      await rejectRequest({ requestId, userId: currentUser._id });
    } catch (e) {
      toast(errorMessage(e, "Couldn't decline the request."), "error");
    }
  };

  return (
    <section aria-label="Chat requests" className="mx-3 mb-2 animate-pop-in overflow-hidden rounded-2xl border border-warn/30 bg-warn/10">
      <h2 className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-warn">
        {requests.length} chat request{requests.length > 1 ? "s" : ""}
      </h2>
      <ul className="space-y-2 p-3">
        {requests.map((request) => (
          <li key={request._id} className="rounded-xl border border-line bg-elevated p-3 shadow-soft">
            <div className="mb-3 flex items-center gap-3">
              <Avatar user={request.sender as Doc<"users">} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{request.sender?.name}</p>
                <p className="flex items-center gap-1 text-xs text-warn">
                  <Clock className="h-3 w-3" />
                  {timeLeft(request.expiresAt)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAccept(request._id)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success py-2 text-xs font-semibold text-white transition active:scale-95 dark:text-bg"
              >
                <Check className="h-3.5 w-3.5" /> Accept
              </button>
              <button
                onClick={() => handleReject(request._id)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-danger/15 py-2 text-xs font-semibold text-danger transition active:scale-95"
              >
                <X className="h-3.5 w-3.5" /> Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
