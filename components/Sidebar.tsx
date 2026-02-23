"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Doc } from "@/convex/_generated/dataModel";
import { UserButton } from "@clerk/nextjs";
import { Search, Users, MessageSquare, Plus, X } from "lucide-react";
import { ConversationItem } from "./ConversationItem";
import { UserListItem } from "./UserListItem";
import { GroupChatModal } from "./GroupChatModal";
import { PendingRequests } from "./PendingRequests";
import { cn } from "@/lib/utils";

interface SidebarProps {
  currentUser: Doc<"users">;
  selectedConversationId: Id<"conversations"> | null;
  onSelectConversation: (id: Id<"conversations">) => void;
}

export function Sidebar({
  currentUser,
  selectedConversationId,
  onSelectConversation,
}: SidebarProps) {
  const [tab, setTab] = useState<"chats" | "users">("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [showGroupModal, setShowGroupModal] = useState(false);

  const conversations = useQuery(api.conversations.getUserConversations, {
    userId: currentUser._id,
  });

  const users = useQuery(api.users.searchUsers, {
    query: searchQuery,
    currentClerkId: currentUser.clerkId,
  });

  const filteredConversations = conversations?.filter((c) => {
    if (!searchQuery) return true;
    const otherMember = c.members?.find((m) => m && m._id !== currentUser._id);
    const name = c.type === "group" ? c.name : otherMember?.name;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/sign-in" />
            <div>
              <p className="font-semibold text-gray-900 text-sm leading-tight">
                {currentUser.name}
              </p>
              <p className="text-xs text-green-500 font-medium">● Online</p>
            </div>
          </div>
          <button
            onClick={() => setShowGroupModal(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="New Group Chat"
          >
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={tab === "chats" ? "Search conversations..." : "Search users..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setTab("chats")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
            tab === "chats" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <MessageSquare className="w-4 h-4" />
          Chats
        </button>
        <button
          onClick={() => setTab("users")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
            tab === "users" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Users className="w-4 h-4" />
          Users
        </button>
      </div>

      {/* Pending requests banner */}
      <PendingRequests
        currentUser={currentUser}
        onConversationCreated={(id) => {
          onSelectConversation(id);
          setTab("chats");
        }}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {tab === "chats" && (
          <>
            {!conversations ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                <MessageSquare className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-gray-500 font-medium">
                  {searchQuery ? "No conversations found" : "No conversations yet"}
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  {searchQuery ? "Try a different search" : "Go to Users tab to connect with people"}
                </p>
              </div>
            ) : (
              filteredConversations?.map((convo) => (
                <ConversationItem
                  key={convo._id}
                  conversation={convo}
                  currentUser={currentUser}
                  isSelected={selectedConversationId === convo._id}
                  onClick={() => onSelectConversation(convo._id)}
                />
              ))
            )}
          </>
        )}

        {tab === "users" && (
          <>
            {!users ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                <Users className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-gray-500 font-medium">
                  {searchQuery ? "No users found" : "No other users yet"}
                </p>
              </div>
            ) : (
              users.map((user) => (
                <UserListItem
                  key={user._id}
                  user={user}
                  currentUser={currentUser}
                  onConversationCreated={(id) => {
                    onSelectConversation(id);
                    setTab("chats");
                  }}
                />
              ))
            )}
          </>
        )}
      </div>

      {showGroupModal && (
        <GroupChatModal
          currentUser={currentUser}
          onClose={() => setShowGroupModal(false)}
          onCreated={(id) => {
            onSelectConversation(id);
            setShowGroupModal(false);
            setTab("chats");
          }}
        />
      )}
    </div>
  );
}
