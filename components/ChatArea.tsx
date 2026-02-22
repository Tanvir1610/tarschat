"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Avatar } from "./Avatar";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";

interface ChatAreaProps {
  conversationId: Id<"conversations">;
  currentUser: Doc<"users">;
  onBack: () => void;
}

export function ChatArea({ conversationId, currentUser, onBack }: ChatAreaProps) {
  const messages = useQuery(api.messages.getMessages, { conversationId });
  const conversation = useQuery(api.conversations.getConversation, {
    conversationId,
  });
  const typingUsers = useQuery(api.typing.getTypingUsers, {
    conversationId,
    currentUserId: currentUser._id,
  });
  const markAsRead = useMutation(api.messages.markAsRead);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showNewMessages, setShowNewMessages] = useState(false);

  // Mark as read when conversation opens
  useEffect(() => {
    markAsRead({ conversationId, userId: currentUser._id });
  }, [conversationId, currentUser._id, markAsRead]);

  // Also mark as read when new messages arrive
  useEffect(() => {
    if (isAtBottom && messages) {
      markAsRead({ conversationId, userId: currentUser._id });
    }
  }, [messages, isAtBottom, conversationId, currentUser._id, markAsRead]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setShowNewMessages(false);
    } else if (messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderId !== currentUser._id) {
        setShowNewMessages(true);
      }
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const atBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsAtBottom(atBottom);
    if (atBottom) setShowNewMessages(false);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
    setShowNewMessages(false);
  };

  const otherMember =
    conversation?.type === "direct"
      ? conversation?.members?.find((m) => m && m._id !== currentUser._id)
      : null;

  const displayName =
    conversation?.type === "group" ? conversation.name : otherMember?.name;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <button
          onClick={onBack}
          className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>

        {conversation?.type === "group" ? (
          <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
            {displayName?.charAt(0) ?? "G"}
          </div>
        ) : (
          <Avatar user={otherMember ?? undefined} size="sm" showOnlineStatus />
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
            {displayName ?? "Loading..."}
          </p>
          {conversation?.type === "group" ? (
            <p className="text-xs text-gray-400">
              {conversation.memberIds.length} members
            </p>
          ) : otherMember ? (
            <p
              className={`text-xs font-medium ${
                otherMember.isOnline ? "text-green-500" : "text-gray-400"
              }`}
            >
              {otherMember.isOnline ? "● Online" : "Offline"}
            </p>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-1"
      >
        {!messages ? (
          // Loading skeleton
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"} animate-pulse`}
              >
                <div
                  className={`rounded-2xl h-10 ${
                    i % 2 === 0 ? "bg-white w-48" : "bg-blue-200 w-36"
                  }`}
                />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
              <span className="text-3xl">👋</span>
            </div>
            <p className="text-gray-500 font-medium">No messages yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Say hello to start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const prevMsg = messages[index - 1];
            const showAvatar =
              !prevMsg || prevMsg.senderId !== msg.senderId;
            return (
              <MessageBubble
                key={msg._id}
                message={msg}
                currentUser={currentUser}
                showAvatar={showAvatar}
              />
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers && typingUsers.length > 0 && (
          <TypingIndicator users={typingUsers as Doc<"users">[]} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* New messages button */}
      {showNewMessages && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
          <button
            onClick={scrollToBottom}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
            New messages
          </button>
        </div>
      )}

      {/* Input */}
      <MessageInput
        conversationId={conversationId}
        currentUser={currentUser}
      />
    </div>
  );
}
