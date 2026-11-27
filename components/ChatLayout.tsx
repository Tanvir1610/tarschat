"use client";

import { useCallback, useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MessagesSquare } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ChatArea } from "./ChatArea";
import { ToastProvider } from "./ui";
import { SectionTabs, type Section } from "./SectionTabs";
import { ProfileFooter } from "./ProfileFooter";
import { CommunitiesGate } from "./communities/CommunitiesGate";
import { CommunitySidebar, InvitationsModal } from "./communities/CommunitySidebar";
import { CommunitiesMain, type CommunityRoute } from "./communities/CommunitiesMain";
import { CommunityCreateModal } from "./communities/CommunityCreateModal";
import { JoinInviteModal } from "./communities/JoinInviteModal";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useNewMessageNotifier, useNotificationPrefs } from "@/hooks/useDesktopNotifications";
import { cn } from "@/lib/utils";

interface ChatLayoutProps {
  clerkId: string;
}

export function ChatLayout({ clerkId }: ChatLayoutProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Tars Communities
  const [section, setSection] = useState<Section>("chats");
  const [route, setRoute] = useState<CommunityRoute>({ kind: "discover" });
  const [showCreate, setShowCreate] = useState(false);
  const [showInvites, setShowInvites] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const { isAuthenticated } = useConvexAuth();

  const currentUser = useQuery(api.users.getCurrentUser, { clerkId });
  const conversations = useQuery(
    api.conversations.getUserConversations,
    currentUser ? { userId: currentUser._id } : "skip"
  );
  const unreadCounts = useQuery(
    api.messages.getUnreadCounts,
    currentUser ? { userId: currentUser._id } : "skip"
  );
  const notifications = useNotificationPrefs();
  const myInvites = useQuery(api.communityInvites.myInvites, isAuthenticated ? {} : "skip");

  // Track online/offline status
  useOnlineStatus(clerkId);

  const handleSelectConversation = useCallback(
    (id: Id<"conversations">) => {
      setSelectedConversationId(id);
      // Give the phone's back button/gesture something to pop
      if (!showMobileChat && window.matchMedia("(max-width: 767px)").matches) {
        window.history.pushState({ chat: true }, "");
      }
      setShowMobileChat(true);
    },
    [showMobileChat]
  );

  const openRoute = useCallback((r: CommunityRoute) => {
    setRoute(r);
    if (!showMobileChat && window.matchMedia("(max-width: 767px)").matches) {
      window.history.pushState({ chat: true }, "");
    }
    setShowMobileChat(true);
  }, [showMobileChat]);

  const changeSection = useCallback((next: Section) => {
    setSection(next);
    setShowMobileChat(false);
  }, []);

  // /?invite=CODE → open the join dialog in Communities, then tidy the URL
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("invite");
    if (!code) return;
    setSection("communities");
    setJoinCode(code);
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, []);

  const handleBack = useCallback(() => {
    if (window.history.state?.chat) window.history.back();
    else setShowMobileChat(false);
  }, []);

  useEffect(() => {
    const onPop = () => setShowMobileChat(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // "(3) TarsChat" in the tab when conversations have unread messages
  const unreadConversations = (unreadCounts ?? []).filter((u) => u.count > 0).length;
  useEffect(() => {
    document.title = `${unreadConversations > 0 ? `(${unreadConversations}) ` : ""}TarsChat — Real-time Messaging`;
  }, [unreadConversations]);

  if (!currentUser) return null;

  return (
    <ToastProvider>
      <NotifierBridge
        currentUser={currentUser}
        conversations={conversations}
        selectedId={selectedConversationId}
        enabled={notifications.enabled}
        onOpen={handleSelectConversation}
      />
      <div className="relative h-[100dvh] w-full overflow-hidden bg-bg md:flex">
        {/* Sidebar — slides away on phones when a chat is open */}
        <aside
          className={cn(
            "absolute inset-0 z-10 transition-[transform,visibility] duration-300 ease-out",
            "md:visible md:relative md:z-auto md:w-80 md:shrink-0 md:translate-x-0 md:border-r md:border-line lg:w-[22.5rem]",
            showMobileChat ? "invisible -translate-x-1/4" : "visible translate-x-0"
          )}
          aria-label="Navigation"
        >
          <div className="flex h-full flex-col bg-surface">
            <SectionTabs section={section} onChange={changeSection} inviteCount={myInvites?.length ?? 0} />
            {section === "chats" ? (
              <Sidebar
                currentUser={currentUser}
                selectedConversationId={selectedConversationId}
                onSelectConversation={handleSelectConversation}
                notifications={notifications}
              />
            ) : (
              <>
                <CommunitiesGate compact>
                  <CommunitySidebar
                    activeSlug={route.kind === "community" ? route.slug : null}
                    discoverActive={route.kind === "discover"}
                    onOpen={(slug) => openRoute({ kind: "community", slug })}
                    onDiscover={() => openRoute({ kind: "discover" })}
                    onJoinWithCode={() => setJoinCode("")}
                    onCreate={() => setShowCreate(true)}
                    onShowInvites={() => setShowInvites(true)}
                  />
                </CommunitiesGate>
                <ProfileFooter currentUser={currentUser} notifications={notifications} />
              </>
            )}
          </div>
        </aside>

        {/* Chat — slides in from the right on phones */}
        <main
          className={cn(
            "absolute inset-0 z-20 min-w-0 transition-[transform,visibility] duration-300 ease-out",
            "md:visible md:relative md:z-auto md:flex-1 md:translate-x-0",
            showMobileChat ? "visible translate-x-0" : "invisible translate-x-full"
          )}
        >
          {section === "communities" ? (
            <CommunitiesGate>
              <CommunitiesMain
                route={route}
                me={currentUser}
                onNavigate={openRoute}
                onBack={handleBack}
                onCreate={() => setShowCreate(true)}
                onJoinWithCode={() => setJoinCode("")}
              />
            </CommunitiesGate>
          ) : selectedConversationId ? (
            <ChatArea
              key={selectedConversationId}
              conversationId={selectedConversationId}
              currentUser={currentUser}
              onBack={handleBack}
            />
          ) : (
            <div className="chat-wash flex h-full flex-col items-center justify-center bg-bg px-6 text-center">
              <div className="bg-brand mb-5 flex h-20 w-20 items-center justify-center rounded-3xl text-white shadow-glow">
                <MessagesSquare className="h-9 w-9" />
              </div>
              <h2 className="text-xl font-semibold text-fg">Welcome, {currentUser.name.split(" ")[0]}</h2>
              <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
                Pick a conversation from the sidebar, or find someone in People to start a new one.
              </p>
            </div>
          )}
        </main>
      </div>

      {showCreate && (
        <CommunityCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(slug) => { setShowCreate(false); setSection("communities"); openRoute({ kind: "community", slug }); }}
        />
      )}
      {showInvites && (
        <InvitationsModal
          onClose={() => setShowInvites(false)}
          onAccepted={(slug) => { setShowInvites(false); openRoute({ kind: "community", slug }); }}
        />
      )}
      {joinCode !== null && (
        <JoinInviteModal
          initialCode={joinCode}
          onClose={() => setJoinCode(null)}
          onJoined={(slug, code) => { setJoinCode(null); setSection("communities"); openRoute({ kind: "community", slug, inviteCode: code }); }}
        />
      )}
    </ToastProvider>
  );
}

// Hook needs a stable component boundary so it can use props that exist only after the user loads
function NotifierBridge(props: Parameters<typeof useNewMessageNotifier>[0]) {
  useNewMessageNotifier(props);
  return null;
}
