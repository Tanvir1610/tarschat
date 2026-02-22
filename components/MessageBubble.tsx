"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { Avatar } from "./Avatar";
import { formatMessageTime } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

interface MessageWithSender extends Doc<"messages"> {
  sender: Doc<"users"> | null;
}

interface MessageBubbleProps {
  message: MessageWithSender;
  currentUser: Doc<"users">;
  showAvatar: boolean;
}

export function MessageBubble({
  message,
  currentUser,
  showAvatar,
}: MessageBubbleProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isOwn = message.senderId === currentUser._id;
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const toggleReaction = useMutation(api.messages.toggleReaction);

  const handleDelete = async () => {
    await deleteMessage({ messageId: message._id, userId: currentUser._id });
    setShowDeleteConfirm(false);
  };

  const handleReaction = async (emoji: string) => {
    await toggleReaction({
      messageId: message._id,
      userId: currentUser._id,
      emoji,
    });
    setShowReactions(false);
  };

  return (
    <div
      className={cn(
        "group flex gap-2 mb-1",
        isOwn ? "flex-row-reverse" : "flex-row"
      )}
      onMouseLeave={() => {
        setShowReactions(false);
        setShowDeleteConfirm(false);
      }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 self-end">
        {showAvatar && !isOwn ? (
          <Avatar user={message.sender} size="sm" />
        ) : (
          <div className="w-8" />
        )}
      </div>

      <div className={cn("flex flex-col max-w-xs lg:max-w-md", isOwn && "items-end")}>
        {/* Sender name (for group chats, non-own messages) */}
        {showAvatar && !isOwn && (
          <span className="text-xs text-gray-400 mb-1 ml-1">
            {message.sender?.name}
          </span>
        )}

        <div className="relative">
          {/* Bubble */}
          <div
            className={cn(
              "relative px-4 py-2 rounded-2xl shadow-sm",
              isOwn
                ? "bg-blue-500 text-white rounded-br-sm"
                : "bg-white text-gray-900 rounded-bl-sm",
              message.isDeleted && "opacity-70"
            )}
          >
            {message.isDeleted ? (
              <p className="text-sm italic opacity-75">This message was deleted</p>
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )}
          </div>

          {/* Action buttons - show on hover */}
          {!message.isDeleted && (
            <div
              className={cn(
                "absolute top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10",
                isOwn ? "right-full mr-2" : "left-full ml-2"
              )}
            >
              {/* Reaction button */}
              <div className="relative">
                <button
                  onClick={() => setShowReactions(!showReactions)}
                  className="w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center text-gray-500 hover:bg-gray-50 text-sm"
                >
                  😊
                </button>
                {showReactions && (
                  <div
                    className={cn(
                      "absolute top-8 bg-white rounded-2xl shadow-xl p-2 flex gap-1 z-20",
                      isOwn ? "right-0" : "left-0"
                    )}
                  >
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg text-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Delete button (only own messages) */}
              {isOwn && (
                <div className="relative">
                  <button
                    onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                    className="w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center text-red-400 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {showDeleteConfirm && (
                    <div className="absolute top-8 right-0 bg-white rounded-xl shadow-xl p-3 z-20 w-40">
                      <p className="text-xs text-gray-600 mb-2">Delete this message?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleDelete}
                          className="flex-1 bg-red-500 text-white text-xs py-1.5 rounded-lg hover:bg-red-600 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 bg-gray-100 text-gray-600 text-xs py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={() => handleReaction(reaction.emoji)}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors",
                  reaction.userIds.includes(currentUser._id)
                    ? "bg-blue-100 border-blue-300 text-blue-700"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.userIds.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-xs text-gray-400 mt-1 px-1">
          {formatMessageTime(message._creationTime)}
        </span>
      </div>
    </div>
  );
}
