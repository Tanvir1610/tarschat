"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Sidebar } from "./Sidebar";
import { ChatArea } from "./ChatArea";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface ChatLayoutProps {
  clerkId: string;
}

export function ChatLayout({ clerkId }: ChatLayoutProps) {
  const [selectedConversationId, setSelectedConversationId] =
    useState<Id<"conversations"> | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);

  const currentUser = useQuery(api.users.getCurrentUser, { clerkId });

  // Track online/offline status
  useOnlineStatus(clerkId);

  if (!currentUser) return null;

  const handleSelectConversation = (id: Id<"conversations">) => {
    setSelectedConversationId(id);
    setShowMobileChat(true);
  };

  const handleBack = () => {
    setShowMobileChat(false);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-white">
      {/* Sidebar — always visible on desktop, hidden on mobile when chat is open */}
      <div
        className={`
          ${showMobileChat ? "hidden" : "flex"} 
          md:flex flex-col
          w-full md:w-80 lg:w-96
          border-r border-gray-200
          flex-shrink-0
        `}
      >
        <Sidebar
          currentUser={currentUser}
          selectedConversationId={selectedConversationId}
          onSelectConversation={handleSelectConversation}
        />
      </div>

      {/* Chat Area */}
      <div
        className={`
          ${showMobileChat ? "flex" : "hidden"}
          md:flex flex-col flex-1 min-w-0
        `}
      >
        {selectedConversationId ? (
          <ChatArea
            conversationId={selectedConversationId}
            currentUser={currentUser}
            onBack={handleBack}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">💬</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                Select a conversation
              </h2>
              <p className="text-gray-400 text-sm">
                Choose a contact from the sidebar to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
